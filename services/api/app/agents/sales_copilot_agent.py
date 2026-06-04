from __future__ import annotations

import json
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient, resolve_openai_model
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


_PROJECT_TITLE_KEYS = (
    "project name",
    "project",
    "case study",
    "customer project",
    "client project",
    "account name",
    "company name",
    "company",
    "client name",
    "client",
    "customer",
    "opportunity name",
    "name",
    "title",
)

_PROJECT_DETAIL_KEYS = (
    "linkedin industry",
    "industry",
    "linkedin category / sector",
    "category",
    "sector",
    "technical solution",
    "solution",
    "technology",
    "platform",
    "process",
    "skill",
    "tool",
    "architecture",
    "cloud service",
    "audit",
    "compliance",
)

_KB_SEARCH_TERMS = (
    "kb",
    "knowledge base",
    "document",
    "case study",
    "case studies",
    "battlecard",
    "project",
    "projects",
    "product",
    "products",
    "industry",
    "security",
    "cybersecurity",
    "compliance",
    "soc2",
    "soc 2",
)

_QUERY_STOPWORDS = {
    "about",
    "back",
    "base",
    "case",
    "come",
    "find",
    "for",
    "from",
    "give",
    "industry",
    "knowledge",
    "list",
    "match",
    "matches",
    "mention",
    "need",
    "product",
    "products",
    "project",
    "projects",
    "proper",
    "read",
    "recommend",
    "search",
    "share",
    "show",
    "source",
    "study",
    "tell",
    "the",
    "what",
    "which",
    "with",
}

_QUERY_TERM_ALIASES = {
    "searcuity": "security",
    "secuirty": "security",
    "secruity": "security",
    "secutity": "security",
    "cyber": "cybersecurity",
    "soc": "soc 2",
    "soc2": "soc 2",
}


def _norm_field_key(value: str) -> str:
    return " ".join(value.replace("_", " ").replace("-", " ").strip().lower().split())


def _clean_field_value(value: Any) -> str:
    text = str(value or "").strip()
    if not text or text.upper() in {"N/A", "NA", "NONE", "NULL", "-"}:
        return ""
    return text


def _field_lookup(fields: Dict[str, Any], keys: Tuple[str, ...]) -> str:
    normalized = {_norm_field_key(k): _clean_field_value(v) for k, v in fields.items()}
    for key in keys:
        value = normalized.get(_norm_field_key(key))
        if value:
            return value
    return ""


def _looks_like_kb_search(message: str) -> bool:
    lower = message.lower()
    return any(term in lower for term in _KB_SEARCH_TERMS)


def _parse_field_line(line: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    for part in line.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        key = key.strip()
        value = _clean_field_value(value)
        if key and value:
            fields[key] = value
    return fields


def _project_rows_from_text(text: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for line in (text or "").splitlines():
        fields = _parse_field_line(line)
        if fields:
            rows.append(fields)
    if rows:
        return rows
    fields = _parse_field_line(text or "")
    return [fields] if fields else []


def _query_focus_terms(query: str) -> List[str]:
    terms: List[str] = []
    for raw in re.findall(r"[a-zA-Z0-9]+", query.lower()):
        token = _QUERY_TERM_ALIASES.get(raw, raw)
        if token in _QUERY_STOPWORDS or len(token) < 4:
            continue
        if token not in terms:
            terms.append(token)
    return terms[:6]


def _text_matches_focus(text: str, focus_terms: List[str]) -> int:
    haystack = text.lower()
    score = 0
    for term in focus_terms:
        if term == "security":
            if any(t in haystack for t in ("security", "cybersecurity", "cyber security", "soc 2", "soc2")):
                score += 1
            continue
        if term in haystack:
            score += 1
    return score


def _format_project_detail(fields: Dict[str, Any], fallback: str) -> str:
    detail_parts: List[str] = []
    normalized = {_norm_field_key(k): _clean_field_value(v) for k, v in fields.items()}
    for key in _PROJECT_DETAIL_KEYS:
        value = normalized.get(_norm_field_key(key))
        if not value or value.startswith("http"):
            continue
        label = key.title().replace(" / ", "/")
        detail_parts.append(f"{label}: {value}")
        if len(detail_parts) >= 3:
            break
    if detail_parts:
        return "; ".join(detail_parts)

    if fields:
        return "No useful industry, solution, technology, or compliance detail in this KB row."

    snippet = fallback.strip().replace("\n", " ")
    if len(snippet) > 220:
        snippet = f"{snippet[:217]}..."
    return snippet


def _hit_asset_title(hit: Dict[str, Any]) -> str:
    metadata = hit.get("metadata") or {}
    return (
        _clean_field_value(hit.get("title"))
        or _field_lookup(metadata, ("company", "title", "name"))
        or _clean_field_value(metadata.get("asset_id"))
        or _clean_field_value(hit.get("asset_id"))
        or "Knowledge base item"
    )


def _source_name_for_hit(hit: Dict[str, Any]) -> str:
    metadata = hit.get("metadata") or {}
    return (
        _clean_field_value(metadata.get("title"))
        or _clean_field_value(hit.get("title"))
        or _clean_field_value(metadata.get("source"))
        or _clean_field_value(hit.get("asset_id"))
        or "Knowledge base"
    )


def _kb_items_from_hits(
    hits: List[Dict[str, Any]],
    *,
    query: str = "",
) -> Tuple[List[Dict[str, Any]], bool]:
    focus_terms = _query_focus_terms(query)
    items: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for hit in hits:
        metadata = hit.get("metadata") or {}
        chunk_text = str(hit.get("chunk_text") or "")
        source = _source_name_for_hit(hit)
        rows = _project_rows_from_text(chunk_text)
        if not rows:
            rows = [metadata] if metadata else [{}]

        for fields in rows:
            title = _field_lookup(fields, _PROJECT_TITLE_KEYS) or _hit_asset_title(hit)
            detail = _format_project_detail(fields, chunk_text)
            searchable = " ".join(
                [
                    title,
                    source,
                    detail,
                    " ".join(_clean_field_value(v) for v in fields.values()),
                    " ".join(_clean_field_value(v) for v in metadata.values()),
                ]
            )
            focus_score = _text_matches_focus(searchable, focus_terms)
            dedupe_key = f"{title.lower()}::{source.lower()}::{detail.lower()[:120]}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            items.append(
                {
                    "title": title,
                    "detail": detail,
                    "source": source,
                    "asset_id": str(hit.get("asset_id") or ""),
                    "focus_score": focus_score,
                    "retrieval_score": float(hit.get("score") or 0),
                    "is_exact": not focus_terms or focus_score > 0,
                }
            )

    items.sort(
        key=lambda item: (
            1 if item["is_exact"] else 0,
            int(item["focus_score"]),
            float(item["retrieval_score"]),
        ),
        reverse=True,
    )
    if focus_terms:
        exact = [item for item in items if item["is_exact"]]
        if exact:
            return exact[:5], True
        return items[:5], False
    return items[:5], True


def _md_cell(value: Any) -> str:
    text = str(value or "").replace("\n", " ").replace("|", "/").strip()
    return text or "—"


def _format_kb_hits(hits: List[Dict[str, Any]], *, query: str, empty: str) -> str:
    if not hits:
        return empty

    items, has_exact = _kb_items_from_hits(hits, query=query)
    if not items:
        return empty

    if has_exact:
        lines = [
            "I found these KB-backed matches. I would use the first one if you need the closest fit:",
            "",
            "| Project / product | Relevant information | KB source |",
            "|---|---|---|",
        ]
    else:
        lines = [
            "I could not find a clean KB-backed match for that exact industry/product ask.",
            "I filtered out the nearest KB hits because they do not match the requested terms:",
            "",
            "| KB source | Why I filtered it out |",
            "|---|---|---|",
        ]

    for item in items:
        if has_exact:
            lines.append(
                f"| {_md_cell(item['title'])} | {_md_cell(item['detail'])} | {_md_cell(item['source'])} |"
            )
        else:
            reason = f"{item['title']}: {item['detail']}"
            lines.append(f"| {_md_cell(item['source'])} | {_md_cell(reason)} |")
    return "\n".join(lines)


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
            use_openai = settings.llm_configured
            if use_openai:
                try:
                    from openai import OpenAI  # noqa: F401
                except ModuleNotFoundError:
                    use_openai = False

            if use_openai:
                answer, cost = self._run_openai_tools(
                    message,
                    history,
                    context_note=context_note,
                    call_id=call_id,
                )
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

        if _looks_like_kb_search(message):
            hits = _kb_search(self.ctx, message, limit=20)
            self._citations.extend(_hits_to_citations(hits))
            self._actions_taken.append(
                {"tool": "search_knowledge_base", "query": message[:120], "hit_count": len(hits), "fast_path": True}
            )
            return _format_kb_hits(
                hits,
                query=message,
                empty="No matching knowledge base or project entries found.",
            ), {
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
                hits = _kb_search(self.ctx, query, limit=max(limit * 4, 20))
                items, has_exact = _kb_items_from_hits(hits, query=query)
                self._citations.extend(_hits_to_citations(hits))
                self._actions_taken.append(
                    {
                        "tool": name,
                        "query": query,
                        "hit_count": len(hits),
                        "result_count": len(items),
                        "exact_match": has_exact,
                    }
                )
                return json.dumps(
                    {
                        "query": query,
                        "exact_match": has_exact,
                        "results": [
                            {
                                "project_or_product": item["title"],
                                "relevant_information": item["detail"],
                                "kb_source": item["source"],
                                "asset_id": item["asset_id"],
                            }
                            for item in items[:limit]
                        ],
                    },
                    default=str,
                )

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

    def _openai_tool_specs(self) -> List[Dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": tool.get("input_schema", {"type": "object", "properties": {}}),
                },
            }
            for tool in TOOL_DEFINITIONS
        ]

    def _run_openai_tools(
        self,
        message: str,
        history: List[Dict[str, str]],
        *,
        context_note: str = "",
        call_id: Optional[str] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        from openai import OpenAI

        settings = get_settings()
        client = OpenAI(api_key=settings.llm_api_key, timeout=120.0)
        model = resolve_openai_model("claude-sonnet-4-20250514")
        fallback_model = resolve_openai_model("claude-3-haiku-20240307")

        messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
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
                response = client.chat.completions.create(
                    model=active_model,
                    max_tokens=4096,
                    messages=messages,
                    tools=self._openai_tool_specs(),
                )
            except Exception:
                if active_model != fallback_model:
                    active_model = fallback_model
                    continue
                return self._run_fallback(message, call_id=call_id)
            usage = getattr(response, "usage", None)
            if usage:
                tokens_in += getattr(usage, "prompt_tokens", 0) or 0
                tokens_out += getattr(usage, "completion_tokens", 0) or 0

            choice = response.choices[0] if response.choices else None
            if not choice:
                break

            if choice.finish_reason == "stop" and choice.message.content:
                answer = (choice.message.content or "").strip() or "Done."
                cost = {
                    "tokens": tokens_in + tokens_out,
                    "usd": 0.0,
                    "model": active_model,
                    "trace_id": trace_id,
                }
                return answer, cost

            tool_calls = choice.message.tool_calls or []
            if not tool_calls:
                if choice.message.content:
                    return (choice.message.content or "").strip(), {
                        "tokens": tokens_in + tokens_out,
                        "usd": 0.0,
                        "model": active_model,
                        "trace_id": trace_id,
                    }
                break

            messages.append(choice.message.model_dump(exclude_none=True))

            for tool_call in tool_calls:
                fn = tool_call.function
                raw_args = fn.arguments if fn else "{}"
                try:
                    args = json.loads(raw_args) if raw_args else {}
                except json.JSONDecodeError:
                    args = {}
                result_str = self._execute_tool(fn.name if fn else "", args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_str[:14000],
                    }
                )

        llm = LlmClient(settings.llm_api_key)
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

        if _looks_like_kb_search(message):
            hits = _kb_search(self.ctx, message, limit=20)
            self._citations.extend(_hits_to_citations(hits))
            self._actions_taken.append({"tool": "search_knowledge_base", "hit_count": len(hits)})
            answer = _format_kb_hits(
                hits,
                query=message,
                empty="No matching knowledge base or project entries found.",
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
            hits = _kb_search(self.ctx, message, limit=20)
            self._citations.extend(_hits_to_citations(hits))
            if hits:
                self._actions_taken.append({"tool": "search_knowledge_base", "hit_count": len(hits)})
                answer = _format_kb_hits(
                    hits,
                    query=message,
                    empty="No matching knowledge base or project entries found.",
                )
            else:
                answer = (
                    "Sales Co-pilot (offline): I can search KB, list calls, load briefs/transcripts, "
                    "and run agents when OpenAI is configured. "
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
