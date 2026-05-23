from dc_tools.salient_keywords import filter_salient_terms, is_salient_term
from dc_tools.bant import build_next_actions, initial_checklist_state, update_checklist_from_segment


def test_filters_filler_words():
    terms = filter_salient_terms(["if", "so", "they", "budget", "franchise", "api"])
    assert "budget" in terms
    assert "franchise" in terms
    assert "if" not in terms
    assert "so" not in terms


def test_budget_segment_updates_checklist():
    state = initial_checklist_state("c1")
    updated, changed, dims = update_checklist_from_segment(
        state,
        "For budget we carved four hundred fifty to six hundred thousand for year one.",
    )
    assert "budget" in changed
    assert updated.bant["budget"] in ("partial", "confirmed")
    assert dims == ["budget"] or "budget" in dims


def test_build_next_actions_from_open_gaps():
    state = initial_checklist_state("c2")
    updated, _, _ = update_checklist_from_segment(
        state, "We need a Q3 pilot and production by Q1 next year."
    )
    actions = build_next_actions(updated.to_dict(), intent_label="timeline_planning")
    assert len(actions) >= 1
    assert any("timeline" in a.lower() or "go-live" in a.lower() or "pilot" in a.lower() for a in actions)
