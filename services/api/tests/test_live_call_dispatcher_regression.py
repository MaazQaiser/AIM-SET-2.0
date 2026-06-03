from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.orchestrator.dispatcher import Orchestrator


def _messages_of_type(out: dict, message_type: str) -> list[dict]:
    return [msg for msg in out.get("ws_messages") or [] if msg.get("type") == message_type]


def test_live_segment_sentiment_survives_discovery_failure(monkeypatch):
    ctx = TenantContext(tenant_id="live-regression-sentiment", user_id="u1")
    call_id = "call-live-regression-sentiment"
    orchestrator = Orchestrator()

    def fail_get_call(*_args, **_kwargs):
        raise RuntimeError("simulated call lookup failure")

    monkeypatch.setattr(orchestrator.calls, "get_call", fail_get_call)

    out = orchestrator.dispatch_live_segment(
        ctx,
        call_id,
        {
            "id": "regression-sentiment-1",
            "text": "I'm not sure how you can help us with these requirements.",
            "speakerId": "buyer-1",
            "speakerName": "Sam Buyer",
            "speakerRole": "customer",
            "timestamp": 35,
        },
        elapsed_seconds=35,
    )

    assert out["discovery"] is None
    sentiment_messages = _messages_of_type(out, "sentiment")
    assert sentiment_messages
    assert sentiment_messages[-1]["payload"]["customer"] < 0


def test_live_segment_pain_point_nudge_reaches_ws_messages():
    ctx = TenantContext(tenant_id="live-regression-pain", user_id="u1")
    call_id = "call-live-regression-pain"

    out = Orchestrator().dispatch_live_segment(
        ctx,
        call_id,
        {
            "id": "regression-pain-1",
            "text": "Operators live in spreadsheets and manual compliance audits are a bottleneck before expansion.",
            "speakerId": "buyer-1",
            "speakerName": "Sam Buyer",
            "speakerRole": "customer",
            "timestamp": 68,
        },
        elapsed_seconds=68,
    )

    nudge_messages = _messages_of_type(out, "nudge")
    assert any(
        (msg.get("payload") or {}).get("message", "").startswith("Customer raised:")
        for msg in nudge_messages
    )
    intent_messages = _messages_of_type(out, "intent_update")
    assert intent_messages
    assert intent_messages[-1]["payload"]["pains"]
    assert _messages_of_type(out, "sentiment")


def test_discovery_checklist_nudge_is_included_in_ws_messages():
    ctx = TenantContext(tenant_id="live-regression-checklist", user_id="u1")
    call_id = "call-live-regression-checklist"

    out = Orchestrator().dispatch_live_segment(
        ctx,
        call_id,
        {
            "id": "regression-checklist-1",
            "text": "Thanks for walking through the context.",
            "speakerId": "buyer-1",
            "speakerName": "Sam Buyer",
            "speakerRole": "customer",
            "timestamp": 1800,
        },
        elapsed_seconds=1800,
    )

    nudge_messages = _messages_of_type(out, "nudge")
    assert any(
        "budget range" in (msg.get("payload") or {}).get("message", "").lower()
        for msg in nudge_messages
    )
    assert _messages_of_type(out, "checklist_update")
