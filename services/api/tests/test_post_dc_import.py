from app.domain.post_dc_import import (
    apply_post_dc_records,
    build_post_review_from_post_dc,
    match_post_dc_to_call,
    post_dc_record_for_call,
)
from app.domain.calls_service import _resolve_call_status


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
