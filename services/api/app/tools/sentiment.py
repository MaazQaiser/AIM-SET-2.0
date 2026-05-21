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
        "agree",
        "yes",
        "perfect",
        "helpful",
        "impressed",
        "valuable",
        "progress",
        "success",
    }
)
_NEGATIVE = frozenset(
    {
        "bad",
        "worried",
        "concern",
        "concerned",
        "frustrated",
        "angry",
        "unhappy",
        "disappointed",
        "expensive",
        "difficult",
        "problem",
        "issue",
        "risk",
        "delay",
        "no",
        "never",
        "hesitant",
        "uncertain",
    }
)


class SentimentResult(TypedDict):
    label: SentimentLabel
    score: float


def analyze_sentiment(text: str, speaker_role: str | None = None) -> SentimentResult:
    """Lexicon-based sentiment; fast and deterministic for live segments."""
    del speaker_role  # reserved for future role-weighting
    tokens = set(re.findall(r"[a-z']+", text.lower()))
    pos = len(tokens & _POSITIVE)
    neg = len(tokens & _NEGATIVE)
    if pos > neg and pos >= 1:
        score = min(1.0, 0.35 + 0.15 * pos)
        return {"label": "positive", "score": score}
    if neg > pos and neg >= 1:
        score = max(-1.0, -0.35 - 0.15 * neg)
        return {"label": "negative", "score": score}
    return {"label": "neutral", "score": 0.0}
