from __future__ import annotations

import re
from typing import Literal, TypedDict

SentimentLabel = Literal["positive", "neutral", "negative"]

_POSITIVE = frozenset(
    {
        "great",
        "good",
        "excellent",
        "love",
        "happy",
        "excited",
        "interested",
        "perfect",
        "helpful",
        "impressed",
        "valuable",
        "progress",
        "success",
        "appreciate",
    }
)
_NEGATIVE_AFFECT = frozenset(
    {
        "bad",
        "worried",
        "concerned",
        "frustrated",
        "angry",
        "unhappy",
        "disappointed",
        "hesitant",
        "uncertain",
        "unsure",
        "skeptical",
        "doubt",
        "confused",
        "confusing",
    }
)

_NEGATIVE_PHRASES = tuple(
    re.compile(pattern)
    for pattern in (
        r"\bnot\s+sure\s+(?:how\s+)?(?:you|your|this|that|it|the\s+(?:solution|platform|product|approach)|we\s+(?:can|should|would)\s+(?:move|proceed|buy|justify))\b",
        r"\bnot\s+clear\s+(?:on|how\s+)?(?:you|your|this|that|it|the\s+(?:value|solution|platform|product|approach))\b",
        r"\bnot\s+convinced\b",
        r"\bdoesn'?t\s+make\s+sense\b",
        r"\bdoes\s+not\s+make\s+sense\b",
    )
)

_POSITIVE_PHRASES = tuple(
    re.compile(pattern)
    for pattern in (
        r"\bfirst\s+answer\b",
        r"\bexactly\s+what\b",
        r"\bkept\s+asking\s+for\b",
        r"\bmove\s+forward\b",
        r"\bdoesn'?t\s+sound\s+like\s+vaporware\b",
    )
)


class SentimentResult(TypedDict):
    label: SentimentLabel
    score: float


def analyze_sentiment(text: str, speaker_role: str | None = None) -> SentimentResult:
    """Lexicon-based human sentiment; fast and deterministic for live segments.

    Keep business pain terms out of this score. Words like "nightmare",
    "bottleneck", and "manual" are discovery evidence, not proof that the
    speaker's tone or buying sentiment is negative.
    """
    del speaker_role  # reserved for future role-weighting
    lowered = text.lower()
    tokens = set(re.findall(r"[a-z']+", lowered))
    pos = len(tokens & _POSITIVE)
    neg = len(tokens & _NEGATIVE_AFFECT)
    pos += sum(1 for pattern in _POSITIVE_PHRASES if pattern.search(lowered))
    neg += sum(1 for pattern in _NEGATIVE_PHRASES if pattern.search(lowered))
    if pos > neg and pos >= 1:
        score = min(1.0, 0.35 + 0.15 * pos)
        return {"label": "positive", "score": score}
    if neg > pos and neg >= 1:
        score = max(-1.0, -0.35 - 0.15 * neg)
        return {"label": "negative", "score": score}
    return {"label": "neutral", "score": 0.0}
