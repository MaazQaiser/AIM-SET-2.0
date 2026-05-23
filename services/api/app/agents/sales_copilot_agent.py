from __future__ import annotations

import json
import uuid
from typing import Any, Dict, List, Optional, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

from app.config import get_settings
from app.domain.calls_service import CallsService
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.live_call_repository import get_live_call_repository
from app.domain.memory_store import get_memory_store

SYSTEM_PROMPT = """You are Sales Co-pilot — the orchestrator assistant for a discovery-call sales platform.
You have tools to search the knowledge base (vector store), list and inspect calls, read transcripts,
trigger backend agents (pre-DC brief, post-call pipeline, relevant content), and export call summaries.
Be concise, actionable, and cite sources when you used KB or call data.
When the user uploads a file to KB, acknowledge ingest and suggest how to use the asset on upcoming calls.
If a call_id is provided in context, prefer that call unless the user asks about others."""

MAX_TOOL_ITERATIONS = 3

TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "name": "search_knowledge_base",
        "description": "Semantic search over tenant knowledge base (documents, battlecards, case studies).",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "limit": {"type": "integer", "description": "Max chunks", "default": 5},
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_calls",
        "description": "List discovery calls for this tenant, optionally filtered by status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "upcoming | live | completed | no-show",
                },
                "limit": {"type": "integer", "default": 20},
            },
        },
    },
    {
        "name": "get_call_details",
        "description": "Full call record plus brief and live signals if available.",
        "input_schema": {
            "type": "object",
            "properties": {"call_id": {"type": "string"}},
            "required": ["call_id"],
        },
    },
    {
        "name": "get_call_transcript",
        "description": "Recent transcript segments for a call.",
        "input_schema": {
            "type": "object",
            "properties": {
                "call_id": {"type": "string"},
                "last_n": {"type": "integer", "default": 40},
            },
            "required": ["call_id"],
        },
    },
    {
        "name": "dispatch_agent",
        "description": (
            "Run a backend agent: pre_dc_brief, pre_dc_pipeline, relevant_content, "
            "post_call, call_end, kb_ingest (metadata only)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_name": {"type": "string"},
                "call_id": {"type": "string"},
                "params": {"type": "object"},
            },
            "required": ["agent_name", "call_id"],
        },
    },
    {
        "name": "export_call_summary",
        "description": "Export call brief + transcript as json or markdown for download.",
        "input_schema": {
            "type": "object",
            "properties": {
                "call_id": {"type": "string"},
                "format": {"type": "string", "enum": ["json", "markdown"], "default": "json"},
            },
            "required": ["call_id"],
        },
    },
]

DISPATCHABLE_AGENTS = [
    {
        "id": "pre_dc_brief",
        "name": "Pre-DC Brief",
        "description": "Generate or refresh the pre-discovery call brief for a call.",
    },
    {
        "id": "pre_dc_pipeline",
        "name": "Pre-DC Pipeline",
        "description": "Full workflow pipeline (summary, artifacts, relevant content) from DC notes.",
    },
    {
        "id": "relevant_content",
        "name": "Relevant Content",
        "description": "Load KB-matched documents and projects for the call account.",
    },
    {
        "id": "post_call",
        "name": "Post-Call Pipeline",
        "description": "Run task + coaching agents after a call ends.",
    },
    {
        "id": "call_end",
        "name": "End Live Call",
        "description": "Finalize live session and trigger post-call handling.",
    },
    {
        "id": "kb_ingest",
        "name": "KB Metadata Ingest",
        "description": "Register KB asset metadata (file upload uses separate upload API).",
    },
]


def list_dispatchable_agents() -> List[Dict[str, str]]:
    return DISPATCHABLE_AGENTS


def _kb_search(ctx: TenantContext, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    settings = get_settings()
    tenant_uuid, clerk_key = resolve_kb_tenant(ctx)
    repo = get_kb_repository()

    def vector_search(tid: str, embedding: List[float], lim: int) -> List[Dict[str, Any]]:
        return repo.match_chunks(tenant_uuid, embedding, limit=lim, clerk_key=clerk_key)

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    return retrieve_kb(
        tenant_uuid,
        query,
        limit=limit,
        chunks=get_memory_store().kb_chunks.get(clerk_key, []),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )


def _hits_to_citations(hits: List[Dict[str, Any]]) -> List[Citation]:
    out: List[Citation] = []
    for i, hit in enumerate(hits[:5]):
        out.append(
            Citation(
                source_type="kb_document",
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or hit.get("title") or "")[:200],
                confidence=float(hit.get("score", 0.8)),
            )
        )
    return out


class SalesCopilotAgent:
    """RAG + tool-use Sales Co-pilot orchestrating calls, KB, and agents."""

    def __init__(
        self,
        ctx: TenantContext,
        *,
        orchestrator: Optional[Any] = None,
    ) -> None:
        self.ctx = ctx
        self.calls = CallsService()
        self._orch = orchestrator
        self._actions_taken: List[Dict[str, Any]] = []
        self._citations: List[Citation] = []

    def _get_orchestrator(self) -> Any:
        if self._orch is None:
            from app.orchestrator.dispatcher import Orchestrator

            self._orch = Orchestrator()
        return self._orch

    def run(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        *,
        call_id: Optional[str] = None,
    ) -> AgentEnvelope:
        history = history or []
        settings = get_settings()
        trace_id = str(uuid.uuid4())

        context_note = ""
        if call_id:
            call = self.calls.get_call(self.ctx, call_id)
            if call:
                context_note = (
                    f"\nActive call context: id={call_id}, account={call.get('accountName')}, "
                    f"status={call.get('status')}."
                )

        # Fast-path common operational prompts so the UI responds quickly.
        fast = self._run_fast_path(message, call_id=call_id)
        if fast is not None:
            answer, cost = fast
        else:
            use_anthropic = bool(settings.anthropic_api_key)
            if use_anthropic:
                try:
                    import anthropic  # type: ignore  # noqa: F401
                except ModuleNotFoundError:
                    use_anthropic = False

            if use_anthropic:
                answer, cost = self._run_anthropic_tools(message, history, context_note=context_note)
            else:
                answer, cost = self._run_fallback(message, call_id=call_id)

        if not self._citations:
            self._citations.append(
                Citation(
                    source_type="system",
                    source_id="sales-copilot",
                    snippet=(answer or "")[:200],
                    confidence=0.6,
                )
            )

        env = AgentEnvelope(
            agent="sales-copilot",
            operation="copilot_chat",
            result={
                "answer": answer,
                "actions_taken": self._actions_taken,
                "call_exports": [
                    a.get("export")
                    for a in self._actions_taken
                    if a.get("export")
                ],
            },
            citations=self._citations,
            confidence=0.88 if self._actions_taken else 0.75,
            cost=cost,
            trace_id=cost.get("trace_id", trace_id),
        )
        validate_envelope(env)
        return env

    def _run_fast_path(
        self,
        message: str,
        *,
        call_id: Optional[str] = None,
    ) -> Optional[Tuple[str, Dict[str, Any]]]:
        lower = message.lower()
        trace_id = str(uuid.uuid4())

        if ("summaris" in lower or "summary" in lower or "list" in lower) and "call" in lower:
            calls = self.calls.list_calls(self.ctx)
            ready = [c for c in calls if bool(c.get("briefReady"))]
            missing = [c for c in calls if not bool(c.get("briefReady"))]
            self._actions_taken.append({"tool": "list_calls", "count": len(calls), "fast_path": True})
            lines = [
                f"Calls found: **{len(calls)}**",
                f"Brief ready: **{len(ready)}**",
                f"Brief missing: **{len(missing)}**",
                "",
                "Top calls:",
            ]
            for c in calls[:10]:
                lines.append(f"- {c.get('accountName')} ({c.get('id')}) — {c.get('status')}")
            if missing:
                lines.append("")
                lines.append("Needs brief:")
                for c in missing[:10]:
                    lines.append(f"- {c.get('accountName')} ({c.get('id')})")
            return "\n".join(lines), {
                "tokens": len(message) // 4,
                "usd": 0.0,
                "model": "fast-path-list-calls",
                "trace_id": trace_id,
            }

        if any(w in lower for w in ("kb", "knowledge base", "document", "case study", "battlecard")):
            hits = _kb_search(self.ctx, message, limit=5)
            self._citations.extend(_hits_to_citations(hits))
            self._actions_taken.append(
                {"tool": "search_knowledge_base", "query": message[:120], "hit_count": len(hits), "fast_path": True}
            )
            titles = [str(h.get("title") or h.get("asset_id") or "Untitled") for h in hits[:5]]
            answer = "Found KB matches:\n" + "\n".join(f"- {t}" for t in titles) if titles else "No KB matches found."
            return answer, {
                "tokens": len(message) // 4,
                "usd": 0.0,
                "model": "fast-path-kb",
                "trace_id": trace_id,
            }

        if call_id and any(w in lower for w in ("export", "download")):
            export = self._build_export(call_id, "markdown" if "markdown" in lower else "json")
            self._actions_taken.append(
                {"tool": "export_call_summary", "call_id": call_id, "format": "markdown" if "markdown" in lower else "json", "export": export, "fast_path": True}
            )
            return "Prepared call summary export.", {
                "tokens": len(message) // 4,
                "usd": 0.0,
                "model": "fast-path-export",
                "trace_id": trace_id,
            }

        return None

    def _execute_tool(self, name: str, tool_input: Dict[str, Any]) -> str:
        try:
            if name == "search_knowledge_base":
                query = str(tool_input.get("query") or "")
                limit = int(tool_input.get("limit") or 5)
                hits = _kb_search(self.ctx, query, limit=limit)
                self._citations.extend(_hits_to_citations(hits))
                self._actions_taken.append(
                    {"tool": name, "query": query, "hit_count": len(hits)}
                )
                return json.dumps(hits[:limit], default=str)

            if name == "list_calls":
                status = (tool_input.get("status") or "").strip().lower()
                limit = int(tool_input.get("limit") or 20)
                calls = self.calls.list_calls(self.ctx)
                if status:
                    calls = [c for c in calls if (c.get("status") or "").lower() == status]
                calls = calls[:limit]
                self._actions_taken.append({"tool": name, "count": len(calls)})
                return json.dumps(calls, default=str)

            if name == "get_call_details":
                cid = str(tool_input.get("call_id") or "")
                call = self.calls.get_call(self.ctx, cid)
                brief = self.calls.get_brief(self.ctx, cid)
                payload = {"call": call, "brief": brief}
                if call:
                    meta = call.get("metadata") or {}
                    if meta.get("live_signals"):
                        payload["live_signals"] = meta["live_signals"]
                self._actions_taken.append({"tool": name, "call_id": cid})
                return json.dumps(payload, default=str)[:12000]

            if name == "get_call_transcript":
                cid = str(tool_input.get("call_id") or "")
                last_n = int(tool_input.get("last_n") or 40)
                events = get_live_call_repository().list_transcript_events(
                    self.ctx, cid, limit=last_n
                )
                self._actions_taken.append(
                    {"tool": name, "call_id": cid, "segments": len(events)}
                )
                if events:
                    self._citations.append(
                        Citation(
                            source_type="transcript",
                            source_id=cid,
                            snippet=(events[-1].get("text") or "")[:200],
                            confidence=0.75,
                        )
                    )
                return json.dumps(events, default=str)[:10000]

            if name == "dispatch_agent":
                agent_name = str(tool_input.get("agent_name") or "").strip().lower()
                cid = str(tool_input.get("call_id") or "")
                params = tool_input.get("params") or {}
                result = self._dispatch_named_agent(agent_name, cid, params)
                self._actions_taken.append(
                    {
                        "tool": name,
                        "agent": agent_name,
                        "call_id": cid,
                        "status": result.get("status", "ok"),
                        "summary": result.get("summary"),
                    }
                )
                return json.dumps(result, default=str)[:8000]

            if name == "export_call_summary":
                cid = str(tool_input.get("call_id") or "")
                fmt = (tool_input.get("format") or "json").strip().lower()
                export = self._build_export(cid, fmt)
                self._actions_taken.append(
                    {
                        "tool": name,
                        "call_id": cid,
                        "format": fmt,
                        "export": export,
                    }
                )
                return json.dumps(export, default=str)[:12000]

            return json.dumps({"error": f"Unknown tool: {name}"})
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    def _dispatch_named_agent(
        self, agent_name: str, call_id: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        orch = self._get_orchestrator()
        name = agent_name.replace("-", "_")

        if name in ("pre_dc_brief", "generate_brief", "brief"):
            env = orch.dispatch_pre_dc_brief(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Pre-DC brief generated", "envelope": env}

        if name in ("pre_dc_pipeline", "workflow", "pipeline"):
            fields = orch._pre_dc_fields_for_call(self.ctx, call_id)  # noqa: SLF001
            if not fields:
                return {"status": "error", "message": "No Pre-DC DC notes fields for this call"}
            env = orch.dispatch_pre_dc_pipeline(self.ctx, call_id, fields, trigger="manual")
            return {"status": "ok", "agent": agent_name, "summary": "Pre-DC pipeline completed", "envelope": env}

        if name in ("relevant_content", "relevant"):
            data = orch.dispatch_relevant_content(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Relevant content loaded", "result": data}

        if name in ("post_call", "postcall"):
            data = orch.dispatch_post_call(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Post-call pipeline completed", "result": data}

        if name in ("call_end", "end_live", "end"):
            data = orch.dispatch_call_end(self.ctx, call_id)
            return {"status": "ok", "agent": agent_name, "summary": "Call ended", "result": data}

        if name in ("kb_ingest", "knowledge"):
            asset = params.get("asset") or params
            env = orch.dispatch_kb_ingest(self.ctx, asset)
            return {"status": "ok", "agent": agent_name, "summary": "KB metadata ingested", "envelope": env}

        return {
            "status": "error",
            "message": f"Unknown agent_name: {agent_name}. Use one of: {[a['id'] for a in DISPATCHABLE_AGENTS]}",
        }

    def _build_export(self, call_id: str, fmt: str) -> Dict[str, Any]:
        call = self.calls.get_call(self.ctx, call_id)
        brief = self.calls.get_brief(self.ctx, call_id) or {}
        events = get_live_call_repository().list_transcript_events(self.ctx, call_id, limit=200)
        payload = {
            "call_id": call_id,
            "call": call,
            "brief": brief,
            "transcript": events,
        }
        if fmt == "markdown":
            lines = [
                f"# Call summary: {call_id}",
                "",
                f"**Account:** {(call or {}).get('accountName', '—')}",
                f"**Status:** {(call or {}).get('status', '—')}",
                "",
                "## Brief",
                (brief.get("aiSummary") or "_No summary_"),
                "",
                "## Transcript",
            ]
            for ev in events[-50:]:
                speaker = ev.get("speaker_role") or ev.get("speaker_id") or "?"
                lines.append(f"- **{speaker}:** {ev.get('text', '')}")
            payload["markdown"] = "\n".join(lines)
        return payload

    def _run_anthropic_tools(
        self,
        message: str,
        history: List[Dict[str, str]],
        *,
        context_note: str = "",
    ) -> Tuple[str, Dict[str, Any]]:
        import anthropic  # type: ignore

        settings = get_settings()
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=120.0)
        model = "claude-sonnet-4-6"
        fallback_model = "claude-3-haiku-20240307"

        messages: List[Dict[str, Any]] = []
        for turn in history[-20:]:
            role = turn.get("role")
            content = turn.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": str(content)})

        user_content = message
        if context_note:
            user_content = f"{message}{context_note}"
        messages.append({"role": "user", "content": user_content})

        tokens_in = 0
        tokens_out = 0
        trace_id = str(uuid.uuid4())

        active_model = model
        for _ in range(MAX_TOOL_ITERATIONS):
            try:
                response = client.messages.create(
                    model=active_model,
                    max_tokens=4096,
                    system=SYSTEM_PROMPT,
                    messages=messages,
                    tools=TOOL_DEFINITIONS,
                )
            except Exception:
                if active_model != fallback_model:
                    active_model = fallback_model
                    continue
                return self._run_fallback(message)
            usage = getattr(response, "usage", None)
            if usage:
                tokens_in += getattr(usage, "input_tokens", 0) or 0
                tokens_out += getattr(usage, "output_tokens", 0) or 0

            if response.stop_reason == "end_turn":
                text_parts = [
                    block.text
                    for block in response.content
                    if hasattr(block, "text") and block.type == "text"
                ]
                answer = "\n".join(text_parts).strip() or "Done."
                cost = {
                    "tokens": tokens_in + tokens_out,
                    "usd": 0.0,
                    "model": active_model,
                    "trace_id": trace_id,
                }
                return answer, cost

            if response.stop_reason != "tool_use":
                break

            tool_blocks = [b for b in response.content if b.type == "tool_use"]
            if not tool_blocks:
                break

            messages.append({"role": "assistant", "content": response.content})

            tool_results: List[Dict[str, Any]] = []
            for block in tool_blocks:
                result_str = self._execute_tool(block.name, block.input or {})
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str[:14000],
                    }
                )
            messages.append({"role": "user", "content": tool_results})

        llm = LlmClient(settings.anthropic_api_key)
        completion = llm.complete(
            SYSTEM_PROMPT,
            f"{message}{context_note}\n\nActions so far: {json.dumps(self._actions_taken, default=str)[:2000]}",
            model=active_model,
            fallback_model=fallback_model,
        )
        return completion.text, {
            "tokens": completion.tokens_in + completion.tokens_out,
            "usd": completion.cost_usd,
            "model": completion.model,
            "trace_id": completion.trace_id,
        }

    def _run_fallback(
        self,
        message: str,
        *,
        call_id: Optional[str] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        trace_id = str(uuid.uuid4())
        lower = message.lower()

        if any(w in lower for w in ("kb", "document", "battle", "case study", "knowledge")):
            hits = _kb_search(self.ctx, message, limit=5)
            self._citations.extend(_hits_to_citations(hits))
            self._actions_taken.append({"tool": "search_knowledge_base", "hit_count": len(hits)})
            titles = [h.get("title") or h.get("asset_id") for h in hits[:5]]
            answer = (
                f"Found {len(hits)} knowledge base matches: {', '.join(str(t) for t in titles if t)}. "
                "Connect Anthropic API for richer synthesis."
            )
        elif any(w in lower for w in ("list call", "calls", "upcoming", "completed")):
            calls = self.calls.list_calls(self.ctx)[:15]
            self._actions_taken.append({"tool": "list_calls", "count": len(calls)})
            lines = [f"- {c.get('accountName')} ({c.get('id')}) — {c.get('status')}" for c in calls]
            answer = "Calls:\n" + ("\n".join(lines) if lines else "_No calls found_")
        elif call_id and any(w in lower for w in ("brief", "detail", "summary")):
            self._execute_tool("get_call_details", {"call_id": call_id})
            brief = self.calls.get_brief(self.ctx, call_id) or {}
            answer = brief.get("aiSummary") or f"Loaded details for call {call_id} (offline mode)."
        elif call_id and "transcript" in lower:
            self._execute_tool("get_call_transcript", {"call_id": call_id, "last_n": 30})
            answer = f"Loaded transcript segments for {call_id} (offline mode)."
        elif call_id and any(w in lower for w in ("export", "download")):
            export = self._build_export(call_id, "markdown" if "markdown" in lower else "json")
            self._actions_taken.append(
                {"tool": "export_call_summary", "call_id": call_id, "export": export}
            )
            answer = export.get("markdown") or json.dumps(export, indent=2)[:2000]
        else:
            hits = _kb_search(self.ctx, message, limit=3)
            self._citations.extend(_hits_to_citations(hits))
            answer = (
                "Sales Co-pilot (offline): I can search KB, list calls, load briefs/transcripts, "
                "and run agents when Anthropic is configured. "
                f"Your question: {message[:200]}"
            )

        return answer, {
            "tokens": len(message) // 4,
            "usd": 0.0,
            "model": "fallback-local",
            "trace_id": trace_id,
        }


def copilot_chat_response(
    ctx: TenantContext,
    message: str,
    history: Optional[List[Dict[str, str]]] = None,
    *,
    call_id: Optional[str] = None,
    orchestrator: Optional[Any] = None,
) -> AgentEnvelope:
    agent = SalesCopilotAgent(ctx, orchestrator=orchestrator)
    return agent.run(message, history, call_id=call_id)
