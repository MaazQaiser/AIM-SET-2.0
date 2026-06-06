from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List

from app.domain.post_dc_import import post_dc_field

BUDGET_LINES = {
    "Yes": "Budget is approved for the scope we discussed — we can move on a signed SOW.",
    "100K+": "We have north of a hundred thousand earmarked for this initiative.",
    "50-100K": "Phase one budget is in the fifty to one hundred thousand range and funded.",
    "10-50K": "We can approve roughly ten to fifty thousand for an initial phase.",
    "Less than 10K": "Budget is tight — under ten thousand unless we split into a smaller pilot.",
    "Partial": "Budget direction is there, but final sign-off still needs CFO or board review.",
    "No": "We do not have software budget approved yet — timing depends on other priorities.",
}

AUTHORITY_LINES = {
    "Yes": "I can sponsor this internally and bring the economic buyer into the next session.",
    "Partial": "I am a strong champion, but finance or the board still has to approve spend.",
    "No": "I am not the final decision maker — we will need my leadership team in the loop.",
}

TIMELINE_LINES = {
    "Less than 30 days": "We need to decide and kick off within the next thirty days.",
    "30-60 days": "Realistically we are targeting a decision in the next thirty to sixty days.",
    "60+ days": "This is a longer cycle — sixty days or more before we can commit.",
}


def _extract_parties(bottom_line: str) -> tuple[str, str]:
    match = re.match(
        r"^(.+?) at (.+?) (?:confirmed|needs|is scoping|wants|validated|highlighted|described|acknowledged|see value|is exploring|is consolidating|is interested|stated|asked)",
        bottom_line,
        re.I,
    )
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return "Customer", "the account"


def _budget_line(value: str) -> str:
    key = (value or "").strip()
    return BUDGET_LINES.get(key) or (f"On budget: {key}." if key else BUDGET_LINES["Partial"])


def _authority_line(value: str) -> str:
    key = (value or "").strip()
    return AUTHORITY_LINES.get(key) or (f"On authority: {key}." if key else AUTHORITY_LINES["Partial"])


def _timeline_line(value: str) -> str:
    key = (value or "").strip()
    return TIMELINE_LINES.get(key) or (f"Timeline: {key}." if key else TIMELINE_LINES["30-60 days"])


def _next_step_lines(strategy: str) -> List[str]:
    cleaned = (strategy or "").strip()
    if not cleaned:
        return ["Let's regroup next week with a written follow-up plan."]
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    return [part.strip() for part in parts if part.strip()][:3]


def build_transcript_events_from_post_dc(call_id: str, row: Dict[str, Any]) -> List[Dict[str, Any]]:
    fields = row.get("fields") or {}
    bottom_line = post_dc_field(fields, "bottomLineContext")
    lead, company = _extract_parties(bottom_line)
    need = post_dc_field(fields, "need") or bottom_line
    budget = post_dc_field(fields, "budget")
    authority = post_dc_field(fields, "authority")
    timeline = post_dc_field(fields, "timeline")
    strategy = post_dc_field(fields, "salesStrategy")
    steps = _next_step_lines(strategy)

    script: List[tuple[str, str, str, float, str]] = [
        (
            "ae-host",
            "Saad",
            "ae",
            8,
            f"Thanks for joining today — goal is to confirm pain, budget, and what happens after this call for {company}.",
        ),
        (
            "customer-lead",
            lead,
            "customer",
            28,
            bottom_line or f"We need a unified platform — our current tools are breaking at scale for {company}.",
        ),
        ("customer-lead", lead, "customer", 52, need),
        (
            "ae-host",
            "Saad",
            "ae",
            78,
            "Help me understand budget — is phase one funded or still pending approval?",
        ),
        ("customer-lead", lead, "customer", 96, _budget_line(budget)),
        (
            "ae-host",
            "Saad",
            "ae",
            118,
            "Who else needs to be in the room before you can sign — CFO, board, or IT leadership?",
        ),
        ("customer-lead", lead, "customer", 136, _authority_line(authority)),
        (
            "se-lead",
            "Shoaib",
            "se",
            158,
            "From a delivery standpoint we can phase this — discovery first, then a fixed MVP scope once interfaces are validated.",
        ),
        ("customer-lead", lead, "customer", 182, _timeline_line(timeline)),
        (
            "ae-host",
            "Saad",
            "ae",
            208,
            f"Recapping next steps: {steps[0]}",
        ),
    ]
    offset = 228.0
    if len(steps) > 1:
        script.append(("ae-host", "Saad", "ae", offset, steps[1]))
        offset += 20
    script.append(
        (
            "customer-lead",
            lead,
            "customer",
            offset,
            "That works — please send the follow-up materials and we'll confirm owners on our side.",
        )
    )

    events: List[Dict[str, Any]] = []
    for speaker_id, speaker_name, speaker_role, offset_seconds, text in script:
        events.append(
            {
                "id": str(uuid.uuid4()),
                "speaker_id": speaker_id,
                "speaker_name": speaker_name,
                "speaker_role": speaker_role,
                "text": text,
                "offset_seconds": float(offset_seconds),
                "provider": "post_dc_import",
                "provider_event_id": f"post-dc-{call_id}-{int(offset_seconds)}",
                "sentiment": "positive"
                if speaker_role == "customer" and re.search(r"approved|works|confirmed|targeting", text, re.I)
                else "neutral",
            }
        )
    return events
