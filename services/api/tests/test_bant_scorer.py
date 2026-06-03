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
