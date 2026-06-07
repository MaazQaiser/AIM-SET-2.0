from __future__ import annotations

import time
from typing import Any, Dict, List


_GREETINGS = {
    "gm",
    "good afternoon",
    "good evening",
    "good morning",
    "hello",
    "hello there",
    "hey",
    "hey there",
    "hi",
    "hi there",
    "hii",
    "yo",
}


def _normalize(message: str) -> str:
    return " ".join(message.strip().lower().rstrip("!?.。,،;:").split())


def is_simple_greeting(message: str) -> bool:
    return _normalize(message) in _GREETINGS


def _suggestions(surface: str) -> List[str]:
    if surface == "live_dc":
        return ["Next best question", "Call summary", "Objection response"]
    if surface == "pre_dc":
        return ["Prep this call", "BANT gaps", "Proof points"]
    if surface == "post_dc":
        return ["Client email", "Open risks", "Next steps"]
    if surface == "knowledge":
        return ["Search knowledge base", "Best case study", "Compare assets"]
    if surface == "content":
        return ["Content gaps", "Draft asset", "Proof points"]
    if surface == "agents":
        return ["Agent status", "Recent runs", "Run briefing"]
    if surface == "settings":
        return ["Import status", "Agent settings", "Data sources"]
    return ["Today's priorities", "Missing briefs", "Upcoming prep"]


def _content(surface: str) -> str:
    if surface == "live_dc":
        return "Hi. What can I help you with on this call?"
    if surface == "pre_dc":
        return "Hi. What can I help you prepare?"
    if surface == "post_dc":
        return "Hi. What can I help you wrap up?"
    return "Hi. What can I help you with?"


def simple_greeting_response(message: str, surface: str = "global") -> Dict[str, Any] | None:
    if not is_simple_greeting(message):
        return None

    message_id = f"greeting-{int(time.time() * 1000)}"
    return {
        "answer": _content(surface),
        "content": _content(surface),
        "message_id": message_id,
        "citations": [],
        "actions_taken": [],
        "call_exports": [],
        "suggestions": _suggestions(surface),
        "confidence": 1.0,
        "missing_evidence": [],
        "ws_messages": [],
    }
