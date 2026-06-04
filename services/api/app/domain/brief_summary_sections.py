"""Canonical Pre-DC summary section labels (shared by agents and CallsService)."""

from __future__ import annotations

from typing import Any, Dict, List

SUMMARY_SECTION_TITLES: Dict[str, str] = {
    "customer_profile": "Profile Summary",
    "customer_pain_points": "Client needs",
    "suggested_action": "Approach towards client",
    "relevance": "Relevance",
}


def canonicalize_summary_section_titles(
    sections: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    return [
        {**section, "title": SUMMARY_SECTION_TITLES[section["id"]]}
        for section in sections
        if section.get("id") in SUMMARY_SECTION_TITLES
    ]


def apply_summary_titles_to_brief(payload: Dict[str, Any]) -> Dict[str, Any]:
    sections = payload.get("summarySections")
    if not isinstance(sections, list) or not sections:
        return payload
    return {
        **payload,
        "summarySections": canonicalize_summary_section_titles(sections),
    }
