from __future__ import annotations

import json
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

from app.agents.live_call_session import (
    bant_from_signal,
    cheap_pass,
    check_unanswered_questions,
    get_session,
    should_invoke_llm,
    track_prospect_question,
)
from app.config import get_settings
from app.domain.agent_runtime import get_live_call_runtime
from app.domain.calls_service import CallsService
from app.domain.kb_repository import get_kb_repository
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.live_call_repository import get_live_call_repository
from app.domain.memory_store import get_memory_store

_OBJECTION_PATTERNS = re.compile(
    r"\b(too expensive|not in budget|concerned about|worried about|pushback|objection|"
    r"not sure we can|competitor|alternative vendor|compared to)\b",
    re.I,
)


def _transcript_citation(call_id: str, snippet: str, confidence: float = 0.7) -> Citation:
    return Citation(
        source_type="transcript",
        source_id=call_id,
        snippet=snippet[:200],
        confidence=confidence,
    )


def _unique_kb_asset_payloads(hits: List[Dict[str, Any]], limit: int = 4) -> List[Dict[str, Any]]:
    """One card per KB asset — vector search often returns multiple chunks per asset."""
    seen: set[str] = set()
    assets: List[Dict[str, Any]] = []
    for h in hits:
        asset_id = str(h.get("asset_id") or h.get("id") or "")
        if not asset_id or asset_id in seen:
            continue
        seen.add(asset_id)
        assets.append(
            {
                "id": asset_id,
                "title": h.get("title") or asset_id,
                "excerpt": (h.get("chunk_text") or "")[:180],
                "type": h.get("asset_type", "document"),
            }
        )
        if len(assets) >= limit:
            break
    return assets


def _kb_citations(hits: List[Dict[str, Any]]) -> List[Citation]:
    out: List[Citation] = []
    for i, hit in enumerate(hits[:3]):
        out.append(
            Citation(
                source_type="kb_document",
                source_id=str(hit.get("asset_id", f"kb-{i}")),
                snippet=(hit.get("chunk_text") or hit.get("title") or "")[:200],
                confidence=float(hit.get("score", 0.8)),
            )
        )
    return out


def _retrieve_kb_for_call(ctx: TenantContext, query: str, limit: int = 5) -> List[Dict[str, Any]]:
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


def _parse_json_block(text: str) -> Dict[str, Any]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"content": text[:200]}


def _invoke_llm_json(
    runtime: Dict[str, Any],
    *,
    user: str,
    schema_hint: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    settings = get_settings()
    system = (runtime.get("system_prompt") or "") + f"\n\nRespond with JSON only:\n{schema_hint}"
    if not settings.anthropic_configured and not settings.anthropic_api_key:
        return {"content": "Review the latest transcript segment and respond when ready."}, {
            "tokens": 0,
            "usd": 0.0,
            "model": "stub",
            "trace_id": str(uuid.uuid4()),
        }
    completion = LlmClient(api_key=settings.anthropic_api_key or None).complete(
        system=system,
        user=user,
        model=runtime.get("model_name") or "claude-3-haiku-20240307",
        fallback_model=runtime.get("fallback_model_name") or "claude-sonnet-4-6",
        max_tokens=512,
    )
    parsed = _parse_json_block(completion.text)
    cost = {
        "tokens": completion.tokens_in + completion.tokens_out,
        "usd": completion.cost_usd,
        "model": completion.model,
        "trace_id": completion.trace_id,
    }
    return parsed, cost


def process_transcript_segment(
    ctx: TenantContext,
    call_id: str,
    segment: Dict[str, Any],
    *,
    brief: Optional[Dict[str, Any]] = None,
) -> List[AgentEnvelope]:
    runtime = get_live_call_runtime(ctx)
    cfg = runtime.get("config") or {}
    routing = cfg.get("signal_routing") or []
    throttle = cfg.get("throttle") or {}
    max_nudges = int(throttle.get("max_nudges_per_window") or 3)

    state = get_session(call_id)
    state.append_segment(segment)
    text = segment.get("text") or ""
    speaker_role = segment.get("speaker_role")
    offset = float(segment.get("offset_seconds") or 0)

    hits, keywords = cheap_pass(text, speaker_role, routing)
    segment["keywords"] = keywords
    track_prospect_question(state, segment)
    unanswered = check_unanswered_questions(state, segment)

    envelopes: List[AgentEnvelope] = []
    trace_base = str(uuid.uuid4())

    for hit in hits:
        bant = bant_from_signal(
            hit.get("signal_type", ""),
            hit.get("signal_type", "").replace("_", " ").title(),
            offset,
        )
        if bant:
            env = AgentEnvelope(
                agent="live-call",
                operation="signal_annotation",
                result={
                    "signal_type": hit.get("signal_type"),
                    "speaker": segment.get("speaker_id"),
                    "transcript_offset_seconds": offset,
                    "extracted_value": text[:120],
                    "bant": bant,
                },
                citations=[_transcript_citation(call_id, text)],
                confidence=float(hit.get("confidence_threshold") or 0.7),
                trace_id=str(uuid.uuid4()),
            )
            validate_envelope(env)
            envelopes.append(env)

    if unanswered:
        for flag in unanswered:
            env = AgentEnvelope(
                agent="live-call",
                operation="unanswered_question_flag",
                result=flag,
                citations=[_transcript_citation(call_id, flag.get("text", ""))],
                confidence=0.75,
                trace_id=str(uuid.uuid4()),
            )
            validate_envelope(env)
            envelopes.append(env)

    window = state.rolling_text(60)
    if window and len(window) > 40:
        kb_hits = _retrieve_kb_for_call(ctx, window, limit=8)
        assets = _unique_kb_asset_payloads(kb_hits, limit=4)
        if assets:
            env = AgentEnvelope(
                agent="live-call",
                operation="kb_surface",
                result={"assets": assets, "query": window[:200]},
                citations=_kb_citations(kb_hits) or [_transcript_citation(call_id, window[:120])],
                confidence=0.78,
                trace_id=str(uuid.uuid4()),
            )
            validate_envelope(env)
            envelopes.append(env)

    if should_invoke_llm(hits, max_nudges_per_window=max_nudges, state=state):
        kb_hits = _retrieve_kb_for_call(ctx, window or text, limit=3)
        brief_snip = ""
        if brief:
            brief_snip = str(brief.get("aiSummary") or brief.get("headline") or "")[:400]
        user = (
            f"Call ID: {call_id}\n"
            f"Latest segment: {text}\n"
            f"Rolling window: {window}\n"
            f"Triggers: {json.dumps(hits)}\n"
            f"Brief context: {brief_snip}\n"
            f"KB hits: {json.dumps(kb_hits[:2], default=str)}"
        )
        if _OBJECTION_PATTERNS.search(text):
            parsed, cost = _invoke_llm_json(
                runtime,
                user=user,
                schema_hint='{"objection_text":"","counter_points":[""],"suggested_action":"acknowledge"}',
            )
            env = AgentEnvelope(
                agent="live-call",
                operation="objection_detected",
                result={
                    "objection_text": parsed.get("objection_text") or text[:120],
                    "counter_points": parsed.get("counter_points") or ["Acknowledge concern", "Quantify impact"],
                    "suggested_action": parsed.get("suggested_action") or "acknowledge",
                    "target_role": "ae",
                },
                citations=_kb_citations(kb_hits) + [_transcript_citation(call_id, text)],
                confidence=0.8,
                cost=cost,
                trace_id=cost.get("trace_id", trace_base),
            )
            validate_envelope(env)
            envelopes.append(env)
            state.record_nudge("ae")
        else:
            parsed, cost = _invoke_llm_json(
                runtime,
                user=user,
                schema_hint=(
                    '{"target_role":"AE","nudge_type":"discovery_question",'
                    '"content":"","suggested_action":"ask_question","asset_refs":[]}'
                ),
            )
            role = parsed.get("target_role", "AE")
            role_key = {"AE": "ae", "SE": "se", "Designer": "designer"}.get(role, "ae")
            env = AgentEnvelope(
                agent="live-call",
                operation="proactive_nudge",
                result={
                    "nudge": {
                        "id": str(uuid.uuid4()),
                        "message": parsed.get("content") or "Consider a clarifying discovery question.",
                        "role": role_key,
                        "nudge_type": parsed.get("nudge_type") or hits[0].get("nudge_type"),
                        "suggested_action": parsed.get("suggested_action") or "ask_question",
                        "asset_refs": parsed.get("asset_refs") or [h.get("asset_id") for h in kb_hits[:2]],
                    },
                    "segment": text[:500],
                },
                citations=_kb_citations(kb_hits) + [_transcript_citation(call_id, text)],
                confidence=0.82,
                cost=cost,
                trace_id=cost.get("trace_id", trace_base),
            )
            validate_envelope(env)
            envelopes.append(env)
            state.record_nudge(role_key)

            intent_parsed, intent_cost = _invoke_llm_json(
                runtime,
                user=user,
                schema_hint='{"intent_label":"","pain_points":[""],"call_direction":""}',
            )
            intent_env = AgentEnvelope(
                agent="live-call",
                operation="intent_update",
                result=intent_parsed,
                citations=[_transcript_citation(call_id, window or text)],
                confidence=0.75,
                cost=intent_cost,
                trace_id=intent_cost.get("trace_id", str(uuid.uuid4())),
            )
            validate_envelope(intent_env)
            envelopes.append(intent_env)
            state.intent_snapshot = intent_parsed

    elif hits and state.nudge_count_in_window() < max_nudges:
        hit = hits[0]
        env = AgentEnvelope(
            agent="live-call",
            operation="proactive_nudge",
            result={
                "nudge": {
                    "id": str(uuid.uuid4()),
                    "message": _heuristic_nudge_message(hit, text),
                    "role": hit.get("target_role", "ae"),
                    "nudge_type": hit.get("nudge_type", "discovery_question"),
                    "suggested_action": "ask_question",
                },
                "segment": text[:500],
            },
            citations=[_transcript_citation(call_id, text)],
            confidence=float(hit.get("confidence_threshold") or 0.65),
            trace_id=str(uuid.uuid4()),
        )
        validate_envelope(env)
        envelopes.append(env)
        state.record_nudge(hit.get("target_role", "ae"))

    if not envelopes:
        env = AgentEnvelope(
            agent="live-call",
            operation="signal_annotation",
            result={
                "signal_type": "segment_logged",
                "speaker": segment.get("speaker_id"),
                "transcript_offset_seconds": offset,
                "extracted_value": text[:120],
            },
            citations=[_transcript_citation(call_id, text, 0.5)],
            confidence=0.5,
            trace_id=str(uuid.uuid4()),
        )
        validate_envelope(env)
        envelopes.append(env)

    return envelopes


def _heuristic_nudge_message(hit: Dict[str, Any], text: str) -> str:
    st = hit.get("signal_type", "")
    if st == "competitor_mentioned":
        return "Competitor mentioned — surface battlecard or differentiation."
    if st == "budget_signal":
        return "Budget signal — clarify investment scope and timing."
    if st == "timeline_signal":
        return "Timeline signal — ask what must be true for the board."
    if st == "objection_raised":
        return "Objection detected — acknowledge and reframe with proof."
    return "New signal — consider a targeted discovery question."


def handle_transcript_segment(call_id: str, text: str) -> AgentEnvelope:
    """Legacy single-envelope entry; prefer process_transcript_segment."""
    ctx = TenantContext(tenant_id="legacy", user_id="legacy")
    segment = {
        "text": text,
        "speaker_id": "unknown",
        "speaker_role": "customer",
        "offset_seconds": 0,
    }
    envs = process_transcript_segment(ctx, call_id, segment)
    for e in envs:
        if e.operation == "proactive_nudge":
            return e
    return envs[0]


def bot_chat_response(
    ctx: TenantContext,
    call_id: str,
    message: str,
) -> AgentEnvelope:
    runtime = get_live_call_runtime(ctx)
    state = get_session(call_id)
    repo = get_live_call_repository()
    events = repo.list_transcript_events(ctx, call_id, limit=80)
    if events:
        for ev in events[-30:]:
            state.append_segment(ev)
    window = state.rolling_text(120) or message
    calls = CallsService()
    brief = calls.get_brief(ctx, call_id)
    kb_hits = _retrieve_kb_for_call(ctx, f"{message}\n{window}", limit=5)

    user = (
        f"Pod member question: {message}\n"
        f"Transcript window: {window}\n"
        f"Brief: {json.dumps(brief or {}, default=str)[:600]}\n"
        f"KB: {json.dumps(kb_hits[:3], default=str)}"
    )
    parsed, cost = _invoke_llm_json(
        runtime,
        user=user,
        schema_hint='{"answer":"","asset_refs":[]}',
    )
    env = AgentEnvelope(
        agent="live-call",
        operation="bot_chat_response",
        result={
            "answer": parsed.get("answer") or "I need more transcript context to answer precisely.",
            "asset_refs": parsed.get("asset_refs") or [h.get("asset_id") for h in kb_hits[:3]],
        },
        citations=_kb_citations(kb_hits) + [_transcript_citation(call_id, window[:200] if window else message)],
        confidence=0.85,
        cost=cost,
        trace_id=cost.get("trace_id", str(uuid.uuid4())),
    )
    validate_envelope(env)
    return env


def build_session_summary(ctx: TenantContext, call_id: str) -> Dict[str, Any]:
    state = get_session(call_id)
    repo = get_live_call_repository()
    suggestions = repo.list_suggestions(ctx, call_id, limit=200)
    accepted = sum(1 for s in suggestions if s.get("status") == "accepted")
    dismissed = sum(1 for s in suggestions if s.get("status") == "dismissed")
    by_op: Dict[str, int] = {}
    for s in suggestions:
        op = s.get("operation", "unknown")
        by_op[op] = by_op.get(op, 0) + 1
    return {
        "call_id": call_id,
        "intent_snapshot": state.intent_snapshot,
        "suggestion_counts": by_op,
        "accepted": accepted,
        "dismissed": dismissed,
        "total_suggestions": len(suggestions),
        "transcript_segments": len(repo.list_transcript_events(ctx, call_id)),
    }
