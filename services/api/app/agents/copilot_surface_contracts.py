from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple


@dataclass(frozen=True)
class CopilotSurfaceContract:
    surface: str
    purpose: str
    evidence: Tuple[str, ...]
    output_sections: Tuple[str, ...]
    behaviors: Tuple[str, ...]
    suggested_actions: Tuple[str, ...]
    test_prompts: Tuple[str, ...]


COPILOT_SURFACE_CONTRACTS: Dict[str, CopilotSurfaceContract] = {
    "home": CopilotSurfaceContract(
        surface="home",
        purpose="Prioritize the AE's day from real call data.",
        evidence=("call list", "brief readiness", "call status", "schedule"),
        output_sections=("Snapshot", "Needs attention", "Next"),
        behaviors=(
            "Never invent meetings or risks that are not in the call list.",
            "Use counts and account names from stored calls.",
            "If no calls exist, say the workspace has no calls yet.",
        ),
        suggested_actions=("Today's priorities", "Missing briefs", "Upcoming prep"),
        test_prompts=("Today's priorities", "Missing briefs", "What needs attention today?"),
    ),
    "pre_dc": CopilotSurfaceContract(
        surface="pre_dc",
        purpose="Prepare the pod for a specific upcoming discovery call.",
        evidence=("call record", "pre-call brief", "BANT state", "approved company knowledge"),
        output_sections=("Prep snapshot", "Gaps to close", "Recommended talk track"),
        behaviors=(
            "Anchor every recommendation to the active call and brief.",
            "If the brief is missing, explain what can still be inferred from call data.",
            "Do not create fake pains, stakeholders, competitors, or proof points.",
        ),
        suggested_actions=("BANT gaps", "Opening talk track", "Objection prep"),
        test_prompts=("BANT gaps", "Opening talk track", "Objection prep"),
    ),
    "post_dc": CopilotSurfaceContract(
        surface="post_dc",
        purpose="Turn the completed call into next steps, client messaging, and handoff clarity.",
        evidence=("call record", "post-call review", "pre-call brief", "transcript summary"),
        output_sections=("Outcome", "Open risks", "Next-step path"),
        behaviors=(
            "Use the post-call review as the primary source.",
            "Keep client-facing wording safe and avoid unsupported claims.",
            "If the review is missing, say the post-call review is not available yet.",
        ),
        suggested_actions=("Client email", "Open risks", "Jira handoff"),
        test_prompts=("Client email", "Open risks", "Jira handoff"),
    ),
}
