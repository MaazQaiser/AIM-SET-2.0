import pytest

from dc_tools.bant import (
    initial_checklist_state,
    score_bant_progression,
    should_nudge,
    update_checklist_from_segment,
)


def test_score_bant_progression_full_progression():
    before = {"budget": False, "authority": False, "need": True, "timeline": False}
    after = {"budget": True, "authority": True, "need": True, "timeline": True}
    result = score_bant_progression(before, after)
    assert result.delta == 3
    assert result.is_qualifying is True


def test_initial_checklist_seeds_partial_bant():
    state = initial_checklist_state("call-1", seed_bant={"need": "partial"})
    assert state.bant["need"] == "partial"
    assert state.bant["budget"] == "unknown"


def test_update_checklist_detects_budget_signal():
    state = initial_checklist_state("call-1")
    updated, changed, dims = update_checklist_from_segment(
        state,
        "We have budget approved for this initiative next quarter.",
        elapsed_seconds=120,
    )
    assert "budget" in changed
    assert updated.bant["budget"] in ("partial", "confirmed")
    assert "budget" in dims


def test_update_checklist_extracts_live_bant_outputs_from_customer_transcript():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        (
            "For budget we carved $450K to $600K for year one, but the CFO and board "
            "need to approve it before the Q3 pilot kickoff and Q1 production go-live."
        ),
        elapsed_seconds=120,
        sentiment="negative",
        speaker_role="customer",
    )

    assert {"budget", "authority", "timeline"}.issubset(set(changed))
    assert {"budget", "authority", "timeline"}.issubset(set(dims))
    assert updated.bant["budget"] in ("partial", "confirmed")
    assert updated.bant["authority"] in ("partial", "confirmed")
    assert updated.bant["timeline"] in ("partial", "confirmed")

    items = {item.id: item for item in updated.items}
    budget_evidence = items["budget"].evidence[-1]
    authority_evidence = items["authority"].evidence[-1]
    timeline_evidence = items["timeline"].evidence[-1]

    assert "$450K to $600K" in budget_evidence.value
    assert "negative" == budget_evidence.sentiment
    assert "cfo" in authority_evidence.value.lower()
    assert "board" in authority_evidence.value.lower()
    assert "Q3 pilot" in timeline_evidence.value
    assert "Q1 production go-live" in timeline_evidence.value


def test_update_checklist_ignores_ae_proposal_language_for_bant_dimensions():
    state = initial_checklist_state("call-1")

    with_customer_budget, _, _ = update_checklist_from_segment(
        state,
        "Our approved budget range is $450K to $600K for year one.",
        elapsed_seconds=90,
        speaker_role="customer",
    )
    budget_item = next(item for item in with_customer_budget.items if item.id == "budget")
    original_budget_evidence_count = len(budget_item.evidence)
    original_budget_value = budget_item.evidence[-1].value

    updated, changed, dims = update_checklist_from_segment(
        with_customer_budget,
        "I will send a proposal that includes the budget and timeline for implementation.",
        elapsed_seconds=130,
        speaker_role="ae",
        signal_type="timeline_signal",
    )

    assert "budget" not in changed
    assert "timeline" not in changed
    assert "budget" not in dims
    assert "timeline" not in dims
    assert updated.bant["budget"] == with_customer_budget.bant["budget"]
    assert updated.bant["timeline"] == "unknown"

    updated_budget_item = next(item for item in updated.items if item.id == "budget")
    timeline_item = next(item for item in updated.items if item.id == "timeline")
    assert len(updated_budget_item.evidence) == original_budget_evidence_count
    assert updated_budget_item.evidence[-1].value == original_budget_value
    assert timeline_item.evidence == []


@pytest.mark.parametrize("speaker_role", [None, "customer"])
def test_update_checklist_ignores_mislabeled_ae_proposal_commitment(speaker_role):
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        (
            "Good. I will send a proposal that includes the healthcare workflow map, "
            "integration plan, team structure, pilot timeline, and budget breakdown. "
            "We can also schedule a CIO review."
        ),
        elapsed_seconds=372,
        speaker_role=speaker_role,
        signal_type="timeline_signal",
    )

    assert "budget" not in changed
    assert "authority" not in changed
    assert "timeline" not in changed
    assert "budget" not in dims
    assert "authority" not in dims
    assert "timeline" not in dims
    assert updated.bant["budget"] == "unknown"
    assert updated.bant["authority"] == "unknown"
    assert updated.bant["timeline"] == "unknown"


def test_update_checklist_keeps_customer_budget_statement_with_share_language():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "I can share our approved budget is $650K to $800K for year one.",
        elapsed_seconds=130,
        speaker_role="customer",
    )

    assert "budget" in changed
    assert "budget" in dims
    assert updated.bant["budget"] == "confirmed"
    budget_item = next(item for item in updated.items if item.id == "budget")
    assert "$650K to $800K" in budget_item.evidence[-1].value


def test_update_checklist_keeps_client_authority_out_of_budget():
    state = initial_checklist_state("call-1")
    with_budget, _, _ = update_checklist_from_segment(
        state,
        (
            "For budget, we have six hundred fifty thousand to eight hundred thousand "
            "approved for year one."
        ),
        elapsed_seconds=272,
        speaker_role="customer",
    )
    budget_item = next(item for item in with_budget.items if item.id == "budget")
    original_budget_evidence = budget_item.evidence[-1]

    updated, changed, dims = update_checklist_from_segment(
        with_budget,
        (
            "I own operations approval. Priya owns the financial model. Our CIO, "
            "Daniel Reed, needs to approve security and integration assumptions before we sign."
        ),
        elapsed_seconds=354,
        speaker_role="customer",
    )

    assert "authority" in changed
    assert "authority" in dims
    assert "budget" not in changed
    assert "budget" not in dims
    assert updated.bant["authority"] == "confirmed"

    updated_budget_item = next(item for item in updated.items if item.id == "budget")
    authority_item = next(item for item in updated.items if item.id == "authority")
    assert updated_budget_item.evidence[-1].value == original_budget_evidence.value
    assert "I own operations approval" in authority_item.evidence[-1].value
    assert "CIO" in authority_item.evidence[-1].value


def test_update_checklist_confirms_carebridge_customer_bant_values():
    state = initial_checklist_state("call-1")
    for text in (
        "Need three is a dedicated team of three to four people. We need product, engineering, quality, and support continuity.",
        "For budget, we have six hundred fifty thousand to eight hundred thousand approved for year one.",
        "Timeline is also clear. We need partner selection by July twentieth, discovery and design in late July, pilot build in August, and a working pilot in two clinics by October.",
        "I own operations approval. Priya owns the financial model. Our CIO, Daniel Reed, needs to approve security and integration assumptions before we sign.",
    ):
        state, _, _ = update_checklist_from_segment(
            state,
            text,
            elapsed_seconds=120,
            speaker_role="customer",
        )

    assert state.bant["budget"] == "confirmed"
    assert state.bant["authority"] == "confirmed"
    assert state.bant["need"] in ("partial", "confirmed")
    assert state.bant["timeline"] == "confirmed"


def test_update_checklist_authority_ignores_general_platform_need():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        (
            "Appreciate it. Bottom line — we need an AI-native platform to actually run "
            "franchise operations, not another dashboard."
        ),
        elapsed_seconds=180,
        speaker_role="customer",
        signal_type="authority_signal",
    )

    authority_item = next(item for item in updated.items if item.id == "authority")
    assert "authority" not in changed
    assert "authority" not in dims
    assert updated.bant["authority"] == "unknown"
    assert authority_item.evidence == []


def test_update_checklist_authority_extracts_only_decision_makers():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "Security owns requirements, but the CFO and board need to approve budget before Q3 pilot.",
        elapsed_seconds=180,
        speaker_role="customer",
    )

    assert "authority" in changed
    assert "authority" in dims
    authority_item = next(item for item in updated.items if item.id == "authority")
    value = authority_item.evidence[-1].value.lower()
    assert "cfo" in value
    assert "board" in value
    assert "security" not in value
    assert "requirements" not in value


def test_update_checklist_extracts_project_eta_from_customer_transcript():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "Our project ETA is six weeks from kickoff after procurement.",
        elapsed_seconds=180,
        speaker_role="customer",
    )

    assert "timeline" in changed
    assert "timeline" in dims
    assert updated.bant["timeline"] in ("partial", "confirmed")

    timeline_item = next(item for item in updated.items if item.id == "timeline")
    timeline_evidence = timeline_item.evidence[-1]
    assert timeline_evidence.speaker_role == "customer"
    assert "project ETA is six weeks from kickoff" in timeline_evidence.value


def test_update_checklist_preserves_delivery_month_in_timeline_evidence():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "We need implementation complete by September and delivery within 8 weeks.",
        elapsed_seconds=180,
        speaker_role="customer",
    )

    assert "timeline" in changed
    assert "timeline" in dims

    timeline_item = next(item for item in updated.items if item.id == "timeline")
    timeline_evidence = timeline_item.evidence[-1]
    assert "complete by September" in timeline_evidence.value
    assert "delivery within 8 weeks" in timeline_evidence.value


def test_update_checklist_extracts_deadline_not_more_than_duration():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "The deadline for our project timeline will be not more than three months.",
        elapsed_seconds=62,
        speaker_role="customer",
    )

    assert "timeline" in changed
    assert "timeline" in dims
    assert updated.bant["timeline"] == "confirmed"

    timeline_item = next(item for item in updated.items if item.id == "timeline")
    assert "project timeline will be not more than three months" in timeline_item.evidence[-1].value


def test_update_checklist_captures_natural_timeline_phrases():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "We need this by Friday and want to move quickly — ideally within 2 weeks, end of the month at latest.",
        elapsed_seconds=210,
        speaker_role="customer",
    )

    assert "timeline" in changed
    assert "timeline" in dims
    assert updated.bant["timeline"] in ("partial", "confirmed")

    timeline_item = next(item for item in updated.items if item.id == "timeline")
    value = timeline_item.evidence[-1].value.lower()
    assert "friday" in value or "within 2 weeks" in value or "end of the month" in value or "move quickly" in value


def test_update_checklist_captures_repeated_timeline_mentions():
    state = initial_checklist_state("call-1")

    updated, _, _ = update_checklist_from_segment(
        state,
        "Timeline is critical for us.",
        elapsed_seconds=60,
        speaker_role="customer",
    )
    updated, changed, dims = update_checklist_from_segment(
        updated,
        "We keep saying the timeline — decision by Q2 2026 and go-live by September.",
        elapsed_seconds=180,
        speaker_role="customer",
    )

    assert "timeline" in changed
    assert "timeline" in dims
    assert updated.bant["timeline"] in ("partial", "confirmed")
    timeline_item = next(item for item in updated.items if item.id == "timeline")
    value = timeline_item.evidence[-1].value
    assert "Q2" in value or "September" in value or "decision by" in value.lower()


def test_should_nudge_budget_after_threshold():
    state = initial_checklist_state("call-1")
    state.elapsed_seconds = 31 * 60
    decision = should_nudge(state)
    assert decision is not None
    assert decision.item_id == "budget"


def test_should_nudge_respects_throttle_window():
    state = initial_checklist_state("call-1")
    state.elapsed_seconds = 31 * 60
    for item_id in ("budget", "authority", "need", "timeline"):
        state.nudge_history[item_id] = float(state.elapsed_seconds)
    assert should_nudge(state, max_nudges_per_window=3) is None


def test_update_checklist_need_from_need_an_platform_alone():
    """ASR often delivers the Need line without 'must have' — still update Need."""
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "We need an operations platform for scheduling, payroll, billing, and incident reporting.",
        elapsed_seconds=90,
        speaker_role="customer",
    )

    assert "need" in changed
    assert "need" in dims
    assert updated.bant["need"] in ("partial", "confirmed")
    need_item = next(item for item in updated.items if item.id == "need")
    assert need_item.evidence
    assert "operations platform" in need_item.evidence[-1].value.lower()


def test_update_checklist_need_ignores_approval_only_language():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "Procurement still needs to approve the vendor list before we can sign.",
        elapsed_seconds=100,
        speaker_role="customer",
    )

    assert "need" not in changed
    assert "need" not in dims
    assert updated.bant["need"] == "unknown"


def test_update_checklist_timeline_urgency_keeps_display_value():
    state = initial_checklist_state("call-1")

    updated, changed, dims = update_checklist_from_segment(
        state,
        "Timeline is urgent for us — this is the main constraint.",
        elapsed_seconds=110,
        speaker_role="customer",
    )

    assert "timeline" in changed
    assert "timeline" in dims
    assert updated.bant["timeline"] in ("partial", "confirmed")
    timeline_item = next(item for item in updated.items if item.id == "timeline")
    assert timeline_item.evidence
    assert timeline_item.evidence[-1].value
    value = timeline_item.evidence[-1].value.lower()
    assert "urgent" in value or "constraint" in value


def test_update_checklist_need_and_timeline_from_fragmented_customer_lines():
    state = initial_checklist_state("call-1")

    updated, changed, _ = update_checklist_from_segment(
        state,
        "Biggest pain point: spreadsheet plus QuickBooks is causing payroll errors.",
        elapsed_seconds=60,
        speaker_role="customer",
    )
    assert "need" in changed
    assert updated.bant["need"] in ("partial", "confirmed")

    updated, changed, _ = update_checklist_from_segment(
        updated,
        "We need an operations platform. This is a top priority and a must have.",
        elapsed_seconds=75,
        speaker_role="customer",
    )
    assert "need" in changed
    assert updated.bant["need"] == "confirmed"

    updated, changed, dims = update_checklist_from_segment(
        updated,
        "Kickoff within 2 weeks, decision by Friday, and go-live by end of the month.",
        elapsed_seconds=120,
        speaker_role="customer",
    )
    assert "timeline" in changed
    assert "timeline" in dims
    assert updated.bant["timeline"] in ("partial", "confirmed")
    timeline_item = next(item for item in updated.items if item.id == "timeline")
    value = timeline_item.evidence[-1].value.lower()
    assert "2 weeks" in value or "friday" in value or "end of the month" in value
