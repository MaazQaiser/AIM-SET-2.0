from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class OpenQuestion:
    question_id: str
    text: str
    asked_at_offset: float
    speaker_id: str


@dataclass
class LiveCallSessionState:
    call_id: str
    buffer: List[Dict[str, Any]] = field(default_factory=list)
    open_questions: List[OpenQuestion] = field(default_factory=list)
    last_nudge_at_by_role: Dict[str, float] = field(default_factory=dict)
    last_signal_types: Dict[str, float] = field(default_factory=dict)
    intent_snapshot: Dict[str, Any] = field(default_factory=dict)
    nudge_count_window: List[float] = field(default_factory=list)

    def append_segment(self, segment: Dict[str, Any]) -> None:
        self.buffer.append(segment)
        if len(self.buffer) > 120:
            self.buffer = self.buffer[-120:]

    def rolling_text(self, seconds: float = 60.0) -> str:
        if not self.buffer:
            return ""
        latest_offset = float(self.buffer[-1].get("offset_seconds") or 0)
        cutoff = latest_offset - seconds
        parts = []
        for seg in self.buffer:
            if float(seg.get("offset_seconds") or 0) >= cutoff:
                parts.append(seg.get("text", ""))
        return " ".join(parts).strip()

    def record_nudge(self, role: str) -> None:
        now = time.time()
        self.last_nudge_at_by_role[role] = now
        self.nudge_count_window.append(now)
        cutoff = now - 300
        self.nudge_count_window = [t for t in self.nudge_count_window if t >= cutoff]

    def nudge_count_in_window(self) -> int:
        now = time.time()
        cutoff = now - 300
        self.nudge_count_window = [t for t in self.nudge_count_window if t >= cutoff]
        return len(self.nudge_count_window)


_SESSIONS: Dict[str, LiveCallSessionState] = {}


def get_session(call_id: str) -> LiveCallSessionState:
    if call_id not in _SESSIONS:
        _SESSIONS[call_id] = LiveCallSessionState(call_id=call_id)
    return _SESSIONS[call_id]


def clear_session(call_id: str) -> None:
    _SESSIONS.pop(call_id, None)


_ROLE_MAP = {
    "AE": "ae",
    "SE": "se",
    "Designer": "designer",
    "ae": "ae",
    "se": "se",
    "designer": "designer",
}

_BANT_MAP = {
    "budget_signal": ("budget", "Budget"),
    "timeline_signal": ("timeline", "Timeline"),
    "authority_signal": ("authority", "Authority"),
    "need_signal": ("need", "Need"),
}

_OBJECTION_PATTERNS = re.compile(
    r"\b(too expensive|not in budget|concerned about|worried about|pushback|objection|"
    r"not sure we can|competitor|alternative vendor|compared to)\b",
    re.I,
)
_QUESTION_PATTERN = re.compile(r"\?\s*$|^(what|how|why|when|who|can you|could you|do you)\b", re.I)


def cheap_pass(
    text: str,
    speaker_role: Optional[str],
    routing_rules: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    hits: List[Dict[str, Any]] = []
    keywords: List[str] = []
    lower = text.lower()

    for rule in routing_rules:
        if not rule.get("enabled", True):
            continue
        pattern = rule.get("keyword_pattern") or ""
        if not pattern:
            continue
        try:
            if re.search(pattern, text, re.I):
                hits.append(
                    {
                        "rule_id": rule.get("id"),
                        "signal_type": rule.get("signal_type"),
                        "nudge_type": rule.get("nudge_type"),
                        "target_role": _ROLE_MAP.get(rule.get("target_role", "AE"), "ae"),
                        "confidence_threshold": float(rule.get("confidence_threshold") or 0.7),
                    }
                )
                keywords.append(rule.get("signal_type", "signal"))
        except re.error:
            continue

    if _OBJECTION_PATTERNS.search(text):
        hits.append(
            {
                "rule_id": "objection-heuristic",
                "signal_type": "objection_raised",
                "nudge_type": "objection_handler",
                "target_role": "ae",
                "confidence_threshold": 0.72,
            }
        )
        keywords.append("objection")

    if "?" in text and (speaker_role or "").lower() in ("customer", "prospect", ""):
        hits.append(
            {
                "rule_id": "prospect-question",
                "signal_type": "prospect_question",
                "nudge_type": "discovery_question",
                "target_role": "ae",
                "confidence_threshold": 0.65,
            }
        )

    return hits, list(dict.fromkeys(keywords))


def track_prospect_question(state: LiveCallSessionState, segment: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = (segment.get("text") or "").strip()
    role = (segment.get("speaker_role") or "").lower()
    offset = float(segment.get("offset_seconds") or 0)
    if role not in ("customer", "prospect") and "?" not in text:
        return None
    if not _QUESTION_PATTERN.search(text):
        return None
    import uuid

    q = OpenQuestion(
        question_id=str(uuid.uuid4()),
        text=text[:300],
        asked_at_offset=offset,
        speaker_id=segment.get("speaker_id", "prospect"),
    )
    state.open_questions.append(q)
    return None


def check_unanswered_questions(
    state: LiveCallSessionState,
    segment: Dict[str, Any],
    *,
    answer_grace_seconds: float = 25.0,
) -> List[Dict[str, Any]]:
    role = (segment.get("speaker_role") or "").lower()
    offset = float(segment.get("offset_seconds") or 0)
    flags: List[Dict[str, Any]] = []

    if role in ("ae", "se", "designer", "pod"):
        answered = []
        for q in state.open_questions:
            if offset - q.asked_at_offset <= answer_grace_seconds + 120:
                answered.append(q)
        for q in answered:
            state.open_questions.remove(q)

    remaining = []
    for q in state.open_questions:
        if offset - q.asked_at_offset >= answer_grace_seconds:
            flags.append(
                {
                    "question_id": q.question_id,
                    "text": q.text,
                    "asked_at_offset": q.asked_at_offset,
                    "seconds_unanswered": offset - q.asked_at_offset,
                }
            )
        else:
            remaining.append(q)
    state.open_questions = remaining
    return flags


def should_invoke_llm(
    hits: List[Dict[str, Any]],
    *,
    max_nudges_per_window: int,
    state: LiveCallSessionState,
) -> bool:
    if not hits:
        return False
    if state.nudge_count_in_window() >= max_nudges_per_window:
        return False
    trigger_types = {"objection_raised", "competitor_mentioned", "budget_signal", "timeline_signal"}
    for h in hits:
        if h.get("signal_type") in trigger_types:
            return True
    return len(hits) >= 2


def bant_from_signal(signal_type: str, label: str, offset: float) -> Optional[Dict[str, Any]]:
    import uuid

    mapping = _BANT_MAP.get(signal_type)
    if not mapping:
        return None
    dim, dim_label = mapping
    return {
        "id": str(uuid.uuid4()),
        "dimension": dim,
        "label": label or dim_label,
        "timestamp": int(offset),
    }
