from __future__ import annotations

from dc_core.tenancy import TenantContext

from app.agents.live_call.handler import handle_transcript_segment
from app.domain.live_call_repository import get_live_call_repository


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
    events = get_live_call_repository().list_transcript_events(ctx, call_id)
    assert len(events) >= 1
    suggestions = get_live_call_repository().list_suggestions(ctx, call_id)
    assert isinstance(suggestions, list)
