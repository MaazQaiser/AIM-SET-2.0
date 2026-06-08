from __future__ import annotations

import json
import re
import uuid
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext
from dc_llm.client import LlmClient
from dc_tools.retrieve_kb import default_embed_fn, retrieve_kb

from app.agents.relevant_content import filter_library_kb_hits
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

HANDOFF_TRANSCRIPT_LIMIT = 500
HANDOFF_SIGNAL_LIMIT = 80
HANDOFF_SENTIMENT_SIGNAL_LIMIT = 30
BANT_DIMENSIONS = ("budget", "authority", "need", "timeline")


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
        raw = repo.match_chunks(
            tenant_uuid,
            embedding,
            limit=max(lim * 6, lim + 30),
            clerk_key=clerk_key,
        )
        return filter_library_kb_hits(raw)[:lim]

    embed_fn = default_embed_fn if settings.openai_configured or settings.openai_api_key else None
    hits = retrieve_kb(
        tenant_uuid,
        query,
        limit=limit,
        chunks=filter_library_kb_hits(get_memory_store().kb_chunks.get(clerk_key, [])),
        embed_fn=embed_fn,
        vector_search_fn=vector_search if embed_fn else None,
    )
    return filter_library_kb_hits(hits)


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
    if not settings.openai_configured and not settings.llm_configured:
        return {"content": "Review the latest transcript segment and respond when ready."}, {
            "tokens": 0,
            "usd": 0.0,
            "model": "stub",
            "trace_id": str(uuid.uuid4()),
        }
    completion = LlmClient(
        api_key=settings.llm_api_key or None,
        openai_api_key=settings.openai_api_key or None,
    ).complete(
        system=system,
        user=user,
        model=runtime.get("model_name") or "gpt-5.4-mini",
        fallback_model=runtime.get("fallback_model_name") or "gpt-5.4-mini",
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


def _snapshot_result(snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not snapshot:
        return {}
    result = snapshot.get("result")
    return result if isinstance(result, dict) else snapshot


def _event_text(event: Dict[str, Any]) -> str:
    return str(event.get("text") or "").strip()


def _event_offset(event: Dict[str, Any]) -> float:
    try:
        return float(event.get("offset_seconds") or event.get("timestamp") or 0)
    except (TypeError, ValueError):
        return 0.0


def _event_speaker(event: Dict[str, Any]) -> str:
    return str(
        event.get("speaker_name")
        or event.get("speakerName")
        or event.get("speaker_id")
        or event.get("speakerId")
        or "Speaker"
    )


def _event_role(event: Dict[str, Any]) -> str:
    role = str(event.get("speaker_role") or event.get("speakerRole") or "").lower()
    if role in ("prospect", "guest"):
        return "customer"
    return role or "unknown"


def _transcript_line(event: Dict[str, Any]) -> Optional[str]:
    text = _event_text(event)
    if not text:
        return None
    offset = int(_event_offset(event))
    prefix = f"{_event_speaker(event)} @{offset}s" if offset else _event_speaker(event)
    return f"{prefix}: {text}"


def _handoff_transcript_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for event in events[-HANDOFF_TRANSCRIPT_LIMIT:]:
        text = _event_text(event)
        if not text:
            continue
        payload.append(
            {
                "id": event.get("id"),
                "speaker_id": event.get("speaker_id") or event.get("speakerId"),
                "speaker_name": _event_speaker(event),
                "speaker_role": _event_role(event),
                "offset_seconds": _event_offset(event),
                "text": text,
                "keywords": event.get("keywords") or [],
                "sentiment": event.get("sentiment"),
                "signal_type": event.get("signal_type") or event.get("signalType"),
            }
        )
    return payload


def _transcript_full_text(events: List[Dict[str, Any]]) -> str:
    return "\n".join(
        line
        for event in events[-HANDOFF_TRANSCRIPT_LIMIT:]
        if (line := _transcript_line(event))
    )


def _transcript_summary(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    event_count = len([event for event in events if _event_text(event)])
    speakers = {_event_speaker(event) for event in events if _event_text(event)}
    duration_seconds = int(max((_event_offset(event) for event in events), default=0))
    keyword_counts: Counter[str] = Counter()
    signal_counts: Counter[str] = Counter()
    sentiment_counts: Counter[str] = Counter()
    for event in events:
        for keyword in event.get("keywords") or []:
            if str(keyword).strip():
                keyword_counts[str(keyword)] += 1
        signal_type = event.get("signal_type") or event.get("signalType")
        if signal_type:
            signal_counts[str(signal_type)] += 1
        sentiment = event.get("sentiment")
        if sentiment:
            sentiment_counts[str(sentiment)] += 1

    headline = (
        f"{event_count} transcript segments captured"
        if event_count
        else "No transcript captured"
    )
    bullets = [
        f"Speakers captured: {len(speakers)}.",
        f"Conversation span: {duration_seconds}s.",
    ]
    if keyword_counts:
        bullets.append(
            "Top keywords: "
            + ", ".join(term for term, _ in keyword_counts.most_common(5))
            + "."
        )
    if signal_counts:
        bullets.append(
            "Defined signals: "
            + ", ".join(f"{name} ({count})" for name, count in signal_counts.most_common(5))
            + "."
        )
    if sentiment_counts:
        bullets.append(
            "Sentiment mix: "
            + ", ".join(f"{name} ({count})" for name, count in sentiment_counts.most_common())
            + "."
        )
    return {
        "headline": headline,
        "bullets": bullets,
        "event_count": event_count,
        "speaker_count": len(speakers),
        "duration_seconds": duration_seconds,
        "top_keywords": [
            {"term": term, "count": count}
            for term, count in keyword_counts.most_common(10)
        ],
        "signal_counts": dict(signal_counts),
        "sentiment_counts": dict(sentiment_counts),
    }


def _sentiment_handoff(
    events: List[Dict[str, Any]],
    live_snapshot: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    by_role: Dict[str, Counter[str]] = {}
    signals: List[Dict[str, Any]] = []
    for event in events:
        sentiment = event.get("sentiment")
        if not sentiment:
            continue
        role = _event_role(event)
        by_role.setdefault(role, Counter())[str(sentiment)] += 1
        if sentiment in ("positive", "negative"):
            signals.append(
                {
                    "speaker": _event_speaker(event),
                    "speaker_role": role,
                    "offset_seconds": _event_offset(event),
                    "sentiment": sentiment,
                    "text": _event_text(event)[:240],
                }
            )

    snapshot = live_snapshot or {}
    return {
        "ae_score": snapshot.get("sentiment_ae"),
        "customer_score": snapshot.get("sentiment_customer"),
        "sales_rep_tone": snapshot.get("sales_rep_tone"),
        "customer_sentiment": snapshot.get("customer_sentiment"),
        "sentiment_shift": snapshot.get("sentiment_shift"),
        "event_counts": {role: dict(counts) for role, counts in by_role.items()},
        "signals": signals[-HANDOFF_SENTIMENT_SIGNAL_LIMIT:],
    }


def _defined_signals_handoff(
    events: List[Dict[str, Any]],
    suggestions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    signals: List[Dict[str, Any]] = []
    counts: Counter[str] = Counter()
    for event in events:
        signal_type = event.get("signal_type") or event.get("signalType")
        if not signal_type:
            continue
        counts[str(signal_type)] += 1
        signals.append(
            {
                "source": "transcript",
                "signal_type": signal_type,
                "speaker": _event_speaker(event),
                "speaker_role": _event_role(event),
                "offset_seconds": _event_offset(event),
                "text": _event_text(event)[:240],
                "keywords": event.get("keywords") or [],
            }
        )

    for item in suggestions[-HANDOFF_SIGNAL_LIMIT:]:
        operation = str(item.get("operation") or "suggestion")
        payload = item.get("payload") if isinstance(item.get("payload"), dict) else {}
        signal_type = operation
        if operation == "objection_detected":
            signal_type = "objection_raised"
        elif operation == "unanswered_question_flag":
            signal_type = "unanswered_question"
        elif operation == "kb_surface":
            signal_type = "reference_asset"
        counts[signal_type] += 1
        signals.append(
            {
                "source": "live_call_suggestion",
                "signal_type": signal_type,
                "operation": operation,
                "target_role": item.get("target_role"),
                "offset_seconds": item.get("transcript_offset_seconds"),
                "confidence": item.get("confidence"),
                "status": item.get("status"),
                "payload": payload,
            }
        )

    return {
        "signal_counts": dict(counts),
        "signals": signals[-HANDOFF_SIGNAL_LIMIT:],
    }


def _bant_handoff(discovery_snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    result = _snapshot_result(discovery_snapshot)
    checklist = result.get("checklist") if isinstance(result.get("checklist"), dict) else {}
    items = checklist.get("items") if isinstance(checklist.get("items"), list) else []
    signals: List[Dict[str, Any]] = []
    for item in items:
        item_id = str(item.get("id") or "")
        if item_id not in BANT_DIMENSIONS:
            continue
        evidence = item.get("evidence") if isinstance(item.get("evidence"), list) else []
        for ev in evidence[-3:]:
            if not isinstance(ev, dict):
                continue
            signals.append(
                {
                    "dimension": item_id,
                    "label": item.get("label") or item_id.title(),
                    "status": item.get("status"),
                    "value": ev.get("value"),
                    "snippet": ev.get("snippet"),
                    "sentiment": ev.get("sentiment"),
                    "speaker_role": ev.get("speakerRole"),
                    "signal_type": ev.get("signalType"),
                    "offset_seconds": ev.get("transcriptOffsetSeconds"),
                    "confidence": ev.get("confidence"),
                }
            )

    return {
        "coverage": checklist.get("bantCoverage") or result.get("bantCoverage"),
        "status": checklist.get("bant") or {},
        "progression": result.get("bantProgression") or {},
        "open_gaps": result.get("openGaps") or checklist.get("openGaps") or [],
        "signals": signals,
    }


def build_call_agent_handoff(
    ctx: TenantContext,
    call_id: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]] = None,
    live_snapshot: Optional[Dict[str, Any]] = None,
    live_suggestions: Optional[List[Dict[str, Any]]] = None,
    transcript_events: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Canonical Live Call Agent handoff consumed by Post-DC."""
    repo = get_live_call_repository()
    events = transcript_events if transcript_events is not None else repo.list_transcript_events(ctx, call_id, limit=HANDOFF_TRANSCRIPT_LIMIT)
    suggestions = live_suggestions if live_suggestions is not None else repo.list_suggestions(ctx, call_id, limit=200)
    transcript_summary = _transcript_summary(events)
    suggestion_counts = Counter(str(s.get("operation") or "unknown") for s in suggestions)
    accepted = sum(1 for s in suggestions if s.get("status") == "accepted")
    dismissed = sum(1 for s in suggestions if s.get("status") == "dismissed")

    return {
        "agent": "live-call",
        "operation": "call_end_handoff",
        "call_id": call_id,
        "transcript": {
            "event_count": len(events),
            "events": _handoff_transcript_events(events),
            "full_text": _transcript_full_text(events),
        },
        "transcript_summary": transcript_summary,
        "defined_signals": _defined_signals_handoff(events, suggestions),
        "bant": _bant_handoff(discovery_snapshot),
        "sentiment": _sentiment_handoff(events, live_snapshot),
        "summary": {
            "headline": transcript_summary["headline"],
            "bullets": transcript_summary["bullets"],
            "intent_snapshot": (live_snapshot or {}).get("intent"),
            "focus_areas": (live_snapshot or {}).get("focus_areas") or [],
            "pains": (live_snapshot or {}).get("pains") or [],
            "suggestion_counts": dict(suggestion_counts),
            "accepted": accepted,
            "dismissed": dismissed,
            "total_suggestions": len(suggestions),
            "transcript_segments": len(events),
        },
    }


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
    *,
    mode: str = "group",
    sender_name: Optional[str] = None,
    sender_role: Optional[str] = None,
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

    sender = sender_name or "Pod member"
    role = sender_role or "ae"
    if mode == "direct":
        context_header = (
            f"PRIVATE direct message from {sender} ({role}) — not visible to other pod members. "
            "Give coaching they can use without repeating sensitive team context aloud."
        )
    else:
        context_header = (
            f"GROUP pod chat message from {sender} ({role}) — visible to AE, SE, designer, and QA on the call. "
            "Answer for the whole pod; be concise and actionable."
        )

    user = (
        f"{context_header}\n"
        f"Question: {message}\n"
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
    handoff = build_call_agent_handoff(ctx, call_id)
    # Preserve the legacy intent snapshot if the lightweight transcript session
    # has one that has not yet been folded into the richer handoff.
    state = get_session(call_id)
    if state.intent_snapshot and not handoff["summary"].get("intent_snapshot"):
        handoff["summary"]["intent_snapshot"] = state.intent_snapshot
    return handoff
