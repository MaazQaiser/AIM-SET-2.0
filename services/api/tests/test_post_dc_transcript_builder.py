from app.domain.post_dc_transcript_builder import build_transcript_events_from_post_dc


def test_build_transcript_events_includes_bant_and_next_steps():
    row = {
        "id": "post-1",
        "matched_call_id": "call-medaxis-diagnostics",
        "fields": {
            "Bottom Line Context": (
                "Joe Troiano at MedAxis Diagnostics confirmed they must replace "
                "a brittle RIS/PACS patchwork with a unified outpatient ERP."
            ),
            "Budget": "50-100K",
            "Authority": "Yes",
            "Need": "Custom healthcare ERP unifying scheduling and billing.",
            "Timeline": "30-60 days",
            "Sales Strategy": (
                "Send NDA and healthcare ERP deck today. "
                "Schedule a technical workshop with their Director of Technical Support."
            ),
        },
    }

    events = build_transcript_events_from_post_dc("call-medaxis-diagnostics", row)

    assert len(events) >= 10
    texts = " ".join(event["text"] for event in events)
    assert "fifty to one hundred thousand" in texts
    assert "sponsor this internally" in texts
    assert "thirty to sixty days" in texts
    assert "Send NDA" in texts
    assert events[0]["provider"] == "post_dc_import"
    assert all(event["speaker_role"] in ("ae", "se", "customer") for event in events)
