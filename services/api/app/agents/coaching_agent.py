from __future__ import annotations

import uuid

from dc_core.evidence import AgentEnvelope, Citation


def generate_scorecard(call_id: str) -> AgentEnvelope:
    return AgentEnvelope(
        agent="coaching",
        operation="scorecard_produced",
        result={
            "callId": call_id,
            "headline": "Post-call scorecard",
            "podScorecard": [
                {
                    "member": "Pod",
                    "role": "Pod",
                    "score": 0.75,
                    "label": "review",
                    "strengths": "Good discovery pacing.",
                    "watch": "Anchor timeline earlier.",
                }
            ],
        },
        citations=[Citation(source_type="transcript", source_id=call_id, snippet="Call session")],
        confidence=0.7,
        trace_id=str(uuid.uuid4()),
    )
