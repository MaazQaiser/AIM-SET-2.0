from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from dc_core.evidence import AgentEnvelope, Citation
from dc_tools.bant import score_bant_progression


def generate_scorecard(
    call_id: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]] = None,
) -> AgentEnvelope:
    bant_progression = None
    open_gaps: list[str] = []
    if discovery_snapshot:
        result = discovery_snapshot.get("result") or discovery_snapshot
        bant_progression = result.get("bantProgression")
        open_gaps = list(result.get("openGaps") or [])
    watch = "Anchor timeline earlier."
    if open_gaps:
        watch = f"Discovery gaps: {', '.join(open_gaps)}."

    before_flags = {"budget": False, "authority": False, "need": False, "timeline": False}
    after_flags = {"budget": False, "authority": False, "need": False, "timeline": False}
    if bant_progression:
        before = bant_progression.get("before") or {}
        after = bant_progression.get("after") or {}
        for dim in before_flags:
            before_flags[dim] = before.get(dim) == "confirmed"
            after_flags[dim] = after.get(dim) == "confirmed"
        scored = score_bant_progression(before_flags, after_flags)
        bant_progression = {
            "before": scored.before,
            "after": scored.after,
            "delta": scored.delta,
            "isQualifying": scored.is_qualifying,
        }

    return AgentEnvelope(
        agent="coaching",
        operation="scorecard_produced",
        result={
            "callId": call_id,
            "headline": "Post-call scorecard",
            "bantProgression": bant_progression,
            "openDiscoveryGaps": open_gaps,
            "podScorecard": [
                {
                    "member": "Pod",
                    "role": "Pod",
                    "score": 0.75,
                    "label": "review",
                    "strengths": "Good discovery pacing.",
                    "watch": watch,
                }
            ],
        },
        citations=[Citation(source_type="transcript", source_id=call_id, snippet="Call session")],
        confidence=0.7,
        trace_id=str(uuid.uuid4()),
    )
