from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dc_core.evidence import AgentEnvelope, Citation, validate_envelope
from dc_core.tenancy import TenantContext

from app.agents.live_call.intent_detection import analyze_segment
from app.agents.live_call_agent import bot_chat_response, build_session_summary, process_transcript_segment
from app.domain.call_channel import get_call_channel
from app.domain.calls_service import CallsService
from app.domain.kb_tenancy import resolve_kb_tenant
from app.domain.live_call_repository import get_live_call_repository
from app.orchestrator.live_broadcast import envelope_to_ws_messages, transcript_event_to_ws


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _analysis_to_envelope(call_id: str, analysis: Dict[str, Any]) -> AgentEnvelope:
    citations = analysis.get("citations") or []
    cit_models = [
        Citation(
            source_type=c.source_type if hasattr(c, "source_type") else c.get("source_type", "transcript"),
            source_id=c.source_id if hasattr(c, "source_id") else c.get("source_id", call_id),
            snippet=c.snippet if hasattr(c, "snippet") else c.get("snippet", ""),
            confidence=float(c.confidence if hasattr(c, "confidence") else c.get("confidence", 0.7)),
        )
        for c in citations
    ]
    op = analysis.get("operation") or "intent_snapshot"
    result: Dict[str, Any] = {
        "intent_update": analysis.get("intent_update"),
        "keyword_stats": analysis.get("keyword_stats"),
        "transcript": analysis.get("transcript"),
    }
    if analysis.get("nudge"):
        result["nudge"] = analysis["nudge"]
        op = "proactive_nudge"
    return AgentEnvelope(
        agent="live-call",
        operation=op,
        result=result,
        citations=cit_models or [Citation(source_type="transcript", source_id=call_id, snippet="", confidence=0.5)],
        confidence=0.75,
        trace_id=str(uuid.uuid4()),
    )


def _persist_and_collect_messages(
    ctx: TenantContext,
    call_id: str,
    envelopes: List[AgentEnvelope],
    transcript_event: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Persist suggestions and collect WS messages. Does NOT broadcast —
    the async caller is responsible for broadcasting the returned messages."""
    repo = get_live_call_repository()
    ws_messages: List[Dict[str, Any]] = []

    transcript_ws_msg = transcript_event_to_ws(transcript_event)
    ws_messages.append(transcript_ws_msg)

    for envelope in envelopes:
        validate_envelope(envelope)
        suggestion_id = str(uuid.uuid4())
        shown_at = _now_iso()
        target_role = None
        if envelope.operation == "proactive_nudge":
            target_role = (envelope.result.get("nudge") or {}).get("role")
        elif envelope.operation == "objection_detected":
            target_role = envelope.result.get("target_role") or "ae"

        if envelope.operation not in ("signal_annotation", "intent_snapshot"):
            repo.append_suggestion(
                ctx,
                call_id,
                operation=envelope.operation,
                payload=envelope.result,
                target_role=target_role,
                transcript_offset_seconds=float(
                    transcript_event.get("offset_seconds")
                    or transcript_event.get("timestamp")
                    or 0
                ),
                confidence=envelope.confidence,
                trace_id=envelope.trace_id,
                suggestion_id=suggestion_id,
            )

        for ws_msg in envelope_to_ws_messages(
            envelope, suggestion_id=suggestion_id, shown_at=shown_at
        ):
            ws_messages.append(ws_msg)

    analysis_intent = None
    for envelope in envelopes:
        if envelope.result.get("intent_update"):
            analysis_intent = envelope.result["intent_update"]
            break
    if analysis_intent and not any(m.get("type") == "intent_update" for m in ws_messages):
        ws_messages.append({"type": "intent_update", "payload": analysis_intent})

    return ws_messages


def handle_transcript_segment(
    ctx: TenantContext,
    call_id: str,
    segment: Dict[str, Any],
) -> Dict[str, Any]:
    repo = get_live_call_repository()
    repo.get_or_create_session(ctx, call_id)

    normalized = {
        "id": segment.get("id") or str(uuid.uuid4()),
        "speaker_id": segment.get("speakerId") or segment.get("speaker_id") or "unknown",
        "speaker_role": segment.get("speakerRole") or segment.get("speaker_role") or "customer",
        "text": segment.get("text") or "",
        "offset_seconds": float(
            segment.get("timestamp")
            if segment.get("timestamp") is not None
            else segment.get("offset_seconds") or 0
        ),
        "provider": segment.get("provider", "websocket"),
        "provider_event_id": segment.get("provider_event_id"),
    }
    stored = repo.append_transcript_event(ctx, call_id, normalized)
    stored["speaker_name"] = segment.get("speakerName") or segment.get("speaker_name") or stored.get(
        "speaker_id"
    )

    analysis = analyze_segment(
        ctx,
        call_id,
        {
            "id": stored["id"],
            "text": stored["text"],
            "speakerId": stored["speaker_id"],
            "speakerName": segment.get("speakerName") or stored["speaker_id"],
            "speakerRole": stored["speaker_role"],
            "timestamp": stored["offset_seconds"],
        },
    )

    brief = CallsService().get_brief(ctx, call_id)
    advanced = process_transcript_segment(
        ctx,
        call_id,
        {
            "text": stored["text"],
            "speaker_id": stored["speaker_id"],
            "speaker_role": stored["speaker_role"],
            "offset_seconds": stored["offset_seconds"],
            "keywords": (analysis.get("transcript") or {}).get("keywords"),
        },
        brief=brief,
    )

    envelopes: List[AgentEnvelope] = [_analysis_to_envelope(call_id, analysis)]
    channel = get_call_channel()
    for env in advanced:
        if env.operation == "signal_annotation":
            bant = (env.result or {}).get("bant")
            if bant:
                bant_ws = {"type": "bant_signal", "payload": bant}
                channel.broadcast_sync(call_id, bant_ws)
            if envelopes[0].operation != "proactive_nudge":
                continue
        if env.operation in (
            "proactive_nudge",
            "objection_detected",
            "unanswered_question_flag",
            "kb_surface",
            "intent_update",
        ):
            envelopes.append(env)

    ws_messages = _persist_and_collect_messages(ctx, call_id, envelopes, stored)

    primary = envelopes[0]
    for e in envelopes:
        if e.operation == "proactive_nudge":
            primary = e
            break

    if analysis.get("keyword_stats"):
        ws_messages.append({"type": "keyword_stats", "payload": analysis["keyword_stats"]})

    if analysis.get("sentiment"):
        sent = analysis["sentiment"]
        payload = {"ae": sent.get("ae", 0), "customer": sent.get("customer", 0)}
        if sent.get("shift"):
            payload["shift"] = sent["shift"]
        ws_messages.append({"type": "sentiment", "payload": payload})

    nudge = analysis.get("nudge")
    for e in envelopes:
        if e.operation == "proactive_nudge":
            nudge = (e.result or {}).get("nudge") or nudge
            break

    return {
        "envelope": primary.model_dump(),
        "ws_messages": ws_messages,
        "nudge": nudge,
    }


def handle_call_end(ctx: TenantContext, call_id: str) -> Dict[str, Any]:
    summary = build_session_summary(ctx, call_id)
    repo = get_live_call_repository()
    repo.end_session(ctx, call_id, summary)
    from app.agents.live_call_session import clear_session

    clear_session(call_id)
    _, clerk_key = resolve_kb_tenant(ctx)
    from app.domain.live_call_session import clear_live_session

    clear_live_session(clerk_key, call_id)
    from app.orchestrator.dispatcher import Orchestrator

    post = Orchestrator().dispatch_post_call(ctx, call_id)
    return {"summary": summary, "post_call": post}
