from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, TypedDict

from dc_tools.salient_keywords import extract_salient_phrases, filter_salient_terms, is_salient_term

_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "must",
        "shall",
        "can",
        "need",
        "we",
        "you",
        "they",
        "it",
        "this",
        "that",
        "these",
        "those",
        "i",
        "he",
        "she",
        "so",
        "if",
        "as",
        "with",
        "from",
        "by",
        "about",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "up",
        "down",
        "out",
        "off",
        "over",
        "under",
        "again",
        "further",
        "then",
        "once",
        "here",
        "there",
        "when",
        "where",
        "why",
        "how",
        "all",
        "each",
        "few",
        "more",
        "most",
        "other",
        "some",
        "such",
        "no",
        "nor",
        "not",
        "only",
        "own",
        "same",
        "than",
        "too",
        "very",
        "just",
        "also",
        "now",
        "our",
        "your",
        "their",
        "what",
        "which",
        "who",
        "whom",
        "yeah",
        "yes",
        "no",
        "ok",
        "okay",
        "um",
        "uh",
        "like",
        "know",
        "think",
        "going",
        "get",
        "got",
        "really",
        "well",
        "right",
        "actually",
        "basically",
        "literally",
        "honestly",
        "anyway",
        "stuff",
        "things",
        "gonna",
        "wanna",
        "gotta",
        "thanks",
        "please",
        "sorry",
        "hello",
        "hey",
        "hi",
    }
)


class KeywordExtractResult(TypedDict):
    terms: List[str]
    signal_type: Optional[str]
    routing_confidence: float
    matched_rule_id: Optional[str]


def _tokenize(text: str) -> List[str]:
    raw = re.findall(r"[a-z][a-z0-9'-]{2,}", text.lower())
    tokens = [t for t in raw if t not in _STOPWORDS and len(t) > 2]
    return filter_salient_terms(tokens)


def extract_keywords(
    text: str,
    signal_routing: Optional[List[Dict[str, Any]]] = None,
    glossary: Optional[List[str]] = None,
) -> KeywordExtractResult:
    """Extract salient terms and apply signal routing rules from live-call config."""
    terms = _tokenize(text)
    for phrase in extract_salient_phrases(text):
        if phrase not in terms:
            terms.append(phrase)
    if glossary:
        lower = text.lower()
        for term in glossary:
            t = term.lower().strip()
            if is_salient_term(t) and t in lower and t not in terms:
                terms.append(t)

    signal_type: Optional[str] = None
    routing_confidence = 0.0
    matched_rule_id: Optional[str] = None
    lower_text = text.lower()

    for rule in signal_routing or []:
        if not rule.get("enabled", True):
            continue
        pattern = rule.get("keyword_pattern") or ""
        if not pattern:
            continue
        try:
            if re.search(pattern, lower_text, re.IGNORECASE):
                signal_type = rule.get("signal_type")
                routing_confidence = float(rule.get("confidence_threshold", 0.7))
                matched_rule_id = rule.get("id")
                break
        except re.error:
            continue

    return {
        "terms": terms[:20],
        "signal_type": signal_type,
        "routing_confidence": routing_confidence,
        "matched_rule_id": matched_rule_id,
    }
