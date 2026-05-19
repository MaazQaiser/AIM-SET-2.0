from __future__ import annotations

import uuid

from dc_core.evidence import AgentEnvelope, Citation


def handle_transcript_segment(call_id: str, text: str) -> AgentEnvelope:
    nudge = None
    lower = text.lower()
    if "budget" in lower or "compliance" in lower:
        nudge = {
            "id": str(uuid.uuid4()),
            "message": "Prospect mentioned budget/compliance — surface relevant case study?",
            "role": "ae",
        }
    return AgentEnvelope(
        agent="live-call",
        operation="proactive_nudge" if nudge else "signal_annotation",
        result={"nudge": nudge, "segment": text[:500]},
        citations=[Citation(source_type="transcript", source_id=call_id, snippet=text[:120])],
        confidence=0.65 if nudge else 0.5,
        trace_id=str(uuid.uuid4()),
    )
