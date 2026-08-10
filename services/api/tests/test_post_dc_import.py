from app.domain.post_dc_import import (
    apply_post_dc_records,
    build_post_review_from_post_dc,
    match_post_dc_to_call,
    post_dc_record_for_call,
)
from app.domain.calls_service import CallsService, _resolve_call_status
from app.domain.memory_store import get_memory_store
from dc_core.tenancy import TenantContext


def test_completed_status_is_not_rewound_by_pre_dc_import():
    assert _resolve_call_status("completed", "upcoming") == "completed"
    assert _resolve_call_status("upcoming", "completed") == "completed"
    assert _resolve_call_status("live", "upcoming") == "live"


def test_match_post_dc_to_call_by_company_name():
    pre_rows = [
        {
            "id": "pre-1",
            "fields": {
                "Company Name-PreDC": "Acme Robotics",
                "Lead Name-PreDC": "Jane Doe",
            },
        }
    ]
    calls = [
        {
            "id": "call-acme-robotics",
            "accountName": "Acme Robotics",
            "status": "upcoming",
        }
    ]
    post_row = {
        "id": "post-1",
        "fields": {
            "Bottom Line Context": "Acme Robotics wants a pilot in Q3.",
            "Budget": "yes",
            "Authority": "partial",
            "Need": "yes",
            "Timeline": "Q3",
            "Sales Strategy": "Send proposal and schedule CFO readout.",
        },
    }

    matched = match_post_dc_to_call(post_row, calls, pre_rows)
    assert matched == "call-acme-robotics"

    updated_calls, enriched = apply_post_dc_records(calls, [post_row], pre_rows)
    assert enriched[0]["matched_call_id"] == "call-acme-robotics"
    assert updated_calls[0]["status"] == "completed"
    assert updated_calls[0]["bant"]["budget"] == "confirmed"

    review = build_post_review_from_post_dc(post_row)
    assert review["nextStepProposal"] == "Send proposal and schedule CFO readout."
    assert review["summary"]

    resolved = post_dc_record_for_call("call-acme-robotics", enriched, pre_rows, updated_calls)
    assert resolved is not None


def test_reset_to_pre_dc_clears_post_dc_content_from_memory(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    from app.config import get_settings

    get_settings.cache_clear()

    ctx = TenantContext(tenant_id="tenant-reset", user_id="user-reset", clerk_org_id="tenant-reset")
    tenant_key = "dc-copilot-shared"
    call_id = "call-reset-corp"
    store = get_memory_store()
    for bucket in (
        store.pre_dc_records,
        store.post_dc_records,
        store.calls,
        store.call_post_reviews,
        store.call_live_signals,
        store.live_sessions,
        store.transcript_events,
        store.live_suggestions,
    ):
        bucket.pop(tenant_key, None)

    store.upsert_pre_dc_records(
        tenant_key,
        [
            {
                "id": "pre-reset",
                "fields": {
                    "Company Name-PreDC": "Reset Corp",
                    "Lead Name-PreDC": "Riley Reset",
                },
            }
        ],
    )
    store.upsert_post_dc_records(
        tenant_key,
        [
            {
                "id": "post-reset",
                "matched_call_id": call_id,
                "fields": {
                    "Bottom Line Context": "Reset Corp completed discovery.",
                    "Budget": "Yes",
                },
            }
        ],
    )
    store.upsert_calls(
        tenant_key,
        [
            {
                "id": call_id,
                "accountName": "Reset Corp",
                "scheduledAt": "2026-06-08T07:00:00+00:00",
                "status": "completed",
                "briefReady": True,
                "pod": [],
                "metadata": {"post_call": {"review": {"summary": ["Done"]}}},
            }
        ],
    )
    store.save_post_review(tenant_key, call_id, {"review": {"summary": ["Done"]}})
    store.transcript_events[tenant_key] = {call_id: [{"id": "t1", "text": "Call happened"}]}
    store.live_suggestions[tenant_key] = {call_id: [{"id": "s1"}]}
    store.live_sessions[tenant_key] = {call_id: {"call_id": call_id, "status": "live"}}

    updated = CallsService().mark_call_status(ctx, call_id, "upcoming")

    assert updated["status"] == "upcoming"
    assert store.get_post_review(tenant_key, call_id) is None
    assert store.list_post_dc_records(tenant_key) == []
    assert store.transcript_events.get(tenant_key, {}).get(call_id) is None
    assert store.live_suggestions.get(tenant_key, {}).get(call_id) is None
    assert store.live_sessions.get(tenant_key, {}).get(call_id) is None
    assert CallsService().get_post_review(ctx, call_id) is None
    assert CallsService().list_calls(ctx)[0]["status"] == "upcoming"
