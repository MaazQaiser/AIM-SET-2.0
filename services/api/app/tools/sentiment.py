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
        "uncomfortable",
        "nervous",
        "anxious",
        "upset",
        "awful",
        "terrible",
        "burned",
        "burnt",
        "uneasy",
        "wary",
    }
)

# Negated positives must beat bare positive tokens ("not feeling good" ≠ positive).
_NEGATED_POSITIVE = tuple(
    re.compile(pattern)
    for pattern in (
        r"\b(?:not|never|no longer)\s+(?:\w+\s+){0,3}(?:good|great|happy|excited|impressed|helpful|perfect|interested|valuable|love|loving)\b",
        r"\b(?:don'?t|doesn'?t|do\s+not|does\s+not)\s+(?:\w+\s+){0,2}(?:feel|feeling|sound|seem)\s+(?:good|great|right|happy|excited)\b",
        r"\bnot\s+(?:feeling|feel)\s+(?:good|great|well|happy|ok|okay)\b",
        r"\bnot\s+happy\b",
        r"\bunhappy\b",
    )
)

_NEGATIVE_PHRASES = tuple(
    re.compile(pattern)
    for pattern in (
        r"\bnot\s+sure\b",
        r"\bnot\s+clear\b",
        r"\bnot\s+convinced\b",
        r"\bnot\s+confident\b",
        r"\bdoesn'?t\s+make\s+sense\b",
        r"\bdoes\s+not\s+make\s+sense\b",
        r"\bdoesn'?t\s+feel\s+(?:right|good|great)\b",
        r"\bdoes\s+not\s+feel\s+(?:right|good|great)\b",
        r"\bdon'?t\s+feel\s+(?:right|good|great|comfortable)\b",
        r"\bfeeling\s+(?:bad|uneasy|uncomfortable|worried|concerned)\b",
        r"\b(?:i'?m|i\s+am|we'?re|we\s+are)\s+(?:a\s+bit\s+|really\s+|quite\s+)?(?:concerned|worried|frustrated|hesitant|skeptical|uncomfortable|uneasy)\b",
        r"\bburned\s+by\b",
        r"\bburnt\s+by\b",
        r"\btaken\s+a\s+risk\b",
        r"\brisky\b",
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
        r"\bexcited\s+to\s+move\b",
        r"\blooking\s+forward\b",
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

    # Negated positives cancel bare positive tokens (e.g. "not feeling good").
    negated_hits = sum(1 for pattern in _NEGATED_POSITIVE if pattern.search(lowered))
    if negated_hits:
        neg += negated_hits + 1
        pos = max(0, pos - negated_hits)

    if neg > pos and neg >= 1:
        score = max(-1.0, -0.35 - 0.15 * neg)
        return {"label": "negative", "score": score}
    if pos > neg and pos >= 1:
        score = min(1.0, 0.35 + 0.15 * pos)
        return {"label": "positive", "score": score}
    return {"label": "neutral", "score": 0.0}
