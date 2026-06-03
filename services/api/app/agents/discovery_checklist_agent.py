from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from dc_core.evidence import AgentEnvelope, Citation
from dc_tools.bant import (
    DEFAULT_PLAYBOOK,
    DiscoveryChecklistState,
    initial_checklist_state,
    record_nudge,
    score_bant_from_checklist,
    should_nudge,
    update_checklist_from_segment,
)

BANT_DIMENSION_LABELS = {
    "budget": "Budget signal",
    "authority": "Authority signal",
    "need": "Need signal",
    "timeline": "Timeline signal",
}


def seed_checklist(
    call_id: str,
    seed_bant: Optional[Dict[str, str]] = None,
    must_ask_questions: Optional[List[str]] = None,
) -> DiscoveryChecklistState:
    return initial_checklist_state(
        call_id,
        seed_bant=seed_bant,
        must_ask_questions=must_ask_questions,
    )


def handle_segment(
    call_id: str,
    text: str,
    state: Optional[DiscoveryChecklistState] = None,
    *,
    elapsed_seconds: int = 0,
    seed_bant: Optional[Dict[str, str]] = None,
    sentiment: Optional[str] = None,
    speaker_role: Optional[str] = None,
    signal_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Process one transcript segment; returns WS payloads + envelope."""
    if state is None:
        state = seed_checklist(call_id, seed_bant=seed_bant)

    updated, changed, new_dims = update_checklist_from_segment(
        state,
        text,
        elapsed_seconds=elapsed_seconds,
        sentiment=sentiment,
        speaker_role=speaker_role,
        signal_type=signal_type,
    )

    bant_signals: List[Dict[str, Any]] = []
    latest_evidence = {
        item.id: item.evidence[-1]
        for item in updated.items
        if item.id in BANT_DIMENSION_LABELS and item.evidence
    }
    for dim in new_dims:
        evidence = latest_evidence.get(dim)
        value = (evidence.value if evidence else "") or ""
        signal_label = BANT_DIMENSION_LABELS.get(dim, f"{dim} signal")
        if value:
            signal_label = f"{signal_label}: {value}"
        if evidence and evidence.sentiment == "negative":
            signal_label = f"{signal_label} · customer concern"
        bant_signals.append(
            {
                "id": str(uuid.uuid4()),
                "label": signal_label,
                "timestamp": elapsed_seconds,
                "dimension": dim,
                "value": value,
                "sentiment": evidence.sentiment if evidence else sentiment,
                "snippet": evidence.snippet if evidence else text[:200],
            }
        )

    nudge_payload: Optional[Dict[str, Any]] = None
    decision = should_nudge(updated)
    if decision:
        updated = record_nudge(updated, decision.item_id)
        nudge_payload = {
            "id": str(uuid.uuid4()),
            "message": decision.message,
            "role": "ae",
            "timestamp": elapsed_seconds * 1000,
            "source": "discovery-checklist",
            "checklistItemId": decision.item_id,
            "citation": {
                "id": f"citation-{call_id}",
                "title": "Transcript",
                "type": "transcript",
                "excerpt": text[:120] if text else DEFAULT_PLAYBOOK.get(decision.item_id, ""),
            },
        }

    envelope = AgentEnvelope(
        agent="discovery-checklist",
        operation="checklist_updated",
        result={
            "checklist": updated.to_dict(),
            "changed": changed,
            "nudge": nudge_payload,
            "bantSignals": bant_signals,
        },
        citations=[
            Citation(
                source_type="transcript",
                source_id=call_id,
                snippet=text[:120] if text else "segment",
                confidence=0.7,
            )
        ],
        confidence=0.75,
        trace_id=str(uuid.uuid4()),
    )

    return {
        "envelope": envelope,
        "state": updated,
        "checklist": updated.to_dict(),
        "nudge": nudge_payload,
        "bant_signals": bant_signals,
    }


def finalize_session(
    call_id: str,
    state: DiscoveryChecklistState,
) -> AgentEnvelope:
    progression = score_bant_from_checklist(state)
    checklist = state.to_dict()
    return AgentEnvelope(
        agent="discovery-checklist",
        operation="session_finalized",
        result={
            "callId": call_id,
            "checklist": checklist,
            "bantProgression": {
                "before": progression.before,
                "after": progression.after,
                "delta": progression.delta,
                "isQualifying": progression.is_qualifying,
            },
            "openGaps": checklist.get("openGaps") or [],
        },
        citations=[
            Citation(
                source_type="transcript",
                source_id=call_id,
                snippet=f"BANT coverage {checklist.get('bantCoverage', 0):.0%}",
                confidence=0.8,
            )
        ],
        confidence=0.85,
        trace_id=str(uuid.uuid4()),
    )
