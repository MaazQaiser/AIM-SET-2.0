from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from dc_core.evidence import AgentEnvelope, Citation


def draft_post_call_artifacts(
    call_id: str,
    *,
    discovery_snapshot: Optional[Dict[str, Any]] = None,
) -> AgentEnvelope:
    open_gaps: List[str] = []
    if discovery_snapshot:
        result = discovery_snapshot.get("result") or discovery_snapshot
        open_gaps = list(result.get("openGaps") or [])

    crm_tasks = [
        {"title": "Send follow-up email", "status": "pending_approval"},
        {"title": "Internal debrief", "status": "pending_approval"},
    ]
    for gap in open_gaps:
        crm_tasks.append(
            {
                "title": f"Clarify discovery gap: {gap}",
                "status": "pending_approval",
            }
        )

    email_suffix = ""
    if open_gaps:
        email_suffix = (
            "\n\nOpen items from our discovery: "
            + ", ".join(g.replace("_", " ") for g in open_gaps)
            + "."
        )

    return AgentEnvelope(
        agent="task",
        operation="email_drafted",
        result={
            "callId": call_id,
            "emailDraft": (
                "Thank you for your time today. As discussed, I will follow up with..."
                + email_suffix
            ),
            "openDiscoveryGaps": open_gaps,
            "crmTasks": crm_tasks,
        },
        citations=[Citation(source_type="transcript", source_id=call_id, snippet="Call summary")],
        confidence=0.8,
        trace_id=str(uuid.uuid4()),
    )
