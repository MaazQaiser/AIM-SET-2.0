from __future__ import annotations

import uuid

from dc_core.evidence import AgentEnvelope, Citation


def draft_post_call_artifacts(call_id: str) -> AgentEnvelope:
    return AgentEnvelope(
        agent="task",
        operation="email_drafted",
        result={
            "callId": call_id,
            "emailDraft": "Thank you for your time today. As discussed, I will follow up with...",
            "crmTasks": [
                {"title": "Send follow-up email", "status": "pending_approval"},
                {"title": "Internal debrief", "status": "pending_approval"},
            ],
        },
        citations=[Citation(source_type="transcript", source_id=call_id, snippet="Call summary")],
        confidence=0.8,
        trace_id=str(uuid.uuid4()),
    )
