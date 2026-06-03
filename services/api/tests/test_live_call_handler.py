from __future__ import annotations

from dc_core.evidence import AgentEnvelope, Citation
from dc_core.tenancy import TenantContext

from app.agents.live_call.handler import handle_transcript_segment
from app.domain.live_call_repository import get_live_call_repository
from app.orchestrator.live_broadcast import envelope_to_ws_messages


def test_handle_transcript_segment_budget_signal():
    ctx = TenantContext(tenant_id="live-test-tenant", user_id="u1")
    call_id = "call-live-budget"
    segment = {
        "text": "We need to understand your budget for Q3 before we proceed",
        "speakerId": "prospect-1",
        "speakerRole": "customer",
        "timestamp": 42,
    }
    out = handle_transcript_segment(ctx, call_id, segment)
    assert "envelope" in out
    assert out.get("ws_messages")
    assert sum(1 for msg in out["ws_messages"] if msg.get("type") == "nudge") <= 1
    passive_ops = {"intent_snapshot", "intent_update"}
    assert all(
        (msg.get("payload") or {}).get("operation") not in passive_ops
        for msg in out["ws_messages"]
        if msg.get("type") == "suggestion_log"
    )
    events = get_live_call_repository().list_transcript_events(ctx, call_id)
    assert len(events) >= 1
    suggestions = get_live_call_repository().list_suggestions(ctx, call_id)
    assert isinstance(suggestions, list)


def test_handle_transcript_segment_preserves_snake_case_speaker_name():
    ctx = TenantContext(tenant_id="live-test-speaker-name", user_id="u1")
    call_id = "call-live-speaker-name"
    segment = {
        "text": "Webhook test",
        "speaker_id": "7",
        "speaker_name": "Local Tester",
        "speaker_role": "customer",
        "offset_seconds": 1,
        "provider": "recall",
        "provider_event_id": "recall-speaker-name-event",
    }

    out = handle_transcript_segment(ctx, call_id, segment)

    assert "envelope" in out
    events = get_live_call_repository().list_transcript_events(ctx, call_id)
    assert events[-1]["speaker_id"] == "7"
    assert events[-1]["speaker_name"] == "Local Tester"


def test_handle_transcript_segment_emits_analyzed_sentiment():
    ctx = TenantContext(tenant_id="live-test-sentiment", user_id="u1")
    call_id = "call-live-sentiment"
    segment = {
        "id": "sentiment-event-1",
        "text": "I'm not sure how you can help us",
        "speakerId": "prospect-1",
        "speakerName": "Alex Prospect",
        "speakerRole": "customer",
        "timestamp": 12,
    }

    out = handle_transcript_segment(ctx, call_id, segment)

    transcript_messages = [
        msg for msg in out["ws_messages"] if msg.get("type") == "transcript"
    ]
    assert transcript_messages
    assert transcript_messages[-1]["payload"]["sentiment"] == "negative"
    sentiment_messages = [
        msg for msg in out["ws_messages"] if msg.get("type") == "sentiment"
    ]
    assert sentiment_messages
    assert sentiment_messages[-1]["payload"]["customer"] < 0
    events = get_live_call_repository().list_transcript_events(ctx, call_id)
    assert events[-1]["sentiment"] == "negative"


def test_passive_intent_envelopes_do_not_create_suggestion_logs():
    citation = Citation(
        source_type="transcript",
        source_id="call-live-log-filter",
        snippet="Budget and timeline were discussed.",
        confidence=0.7,
    )

    for operation in ("intent_snapshot", "intent_update"):
        envelope = AgentEnvelope(
            agent="live-call",
            operation=operation,
            result={"call_direction": "Continue discovery"},
            citations=[citation],
            confidence=0.75,
            trace_id=f"trace-{operation}",
        )

        messages = envelope_to_ws_messages(envelope, suggestion_id="suggestion-1")

        assert not any(msg.get("type") == "suggestion_log" for msg in messages)
