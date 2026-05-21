from dc_tools.bant import checklist_from_dict, initial_checklist_state

from app.agents.discovery_checklist_agent import finalize_session, handle_segment


def test_handle_segment_returns_checklist_and_nudge_at_threshold():
    state = initial_checklist_state("call-1")
    out = handle_segment("call-1", "We need this yesterday for the board.", state=state, elapsed_seconds=0)
    assert out["checklist"]["callId"] == "call-1"
    assert out["envelope"].agent == "discovery-checklist"
    assert out["envelope"].operation == "checklist_updated"


def test_finalize_session_produces_bant_progression():
    state = initial_checklist_state("call-1", seed_bant={"need": "partial"})
    state.elapsed_seconds = 100
    env = finalize_session("call-1", state)
    assert env.operation == "session_finalized"
    assert "bantProgression" in env.result
    assert env.result["callId"] == "call-1"


def test_checklist_round_trip_dict():
    state = initial_checklist_state("call-2")
    data = state.to_dict()
    restored = checklist_from_dict(data)
    assert restored.call_id == "call-2"
    assert len(restored.items) == len(state.items)
