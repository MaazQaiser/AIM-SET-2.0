"""Infer BANT authority from lead / client attendee titles (Pre-DC)."""

from __future__ import annotations

import re
from typing import Optional

C_SUITE_TITLE = re.compile(
    r"\b(?:c[\s.-]?suite|c[\s.-]?panel)\b|"
    r"(?:\bchief\s+(?:executive|operating|financial|technology|marketing|product|revenue|"
    r"information|data|digital|strategy|commercial|people|human\s+resources|legal|security|"
    r"privacy|customer|growth|transformation|risk|compliance|analytics)(?:\s+officer)?\b)|"
    r"\b(?:CEO|CFO|COO|CTO|CMO|CPO|CRO|CIO|CISO|CHRO|CCO|CDO|CAO|CBO|CGO|CKO)\b",
    re.I,
)
EXECUTIVE_TITLE = re.compile(
    r"\b(?:president|chair(?:man|woman|person)?|founder|co[\s-]?founder|owner|"
    r"managing\s+director|executive\s+director|board\s+member)\b",
    re.I,
)
SENIOR_LEADER_TITLE = re.compile(
    r"\b(?:executive\s+vice\s+president|evp|senior\s+vice\s+president|svp|vice\s+president|"
    r"\bvp\b|director|head\s+of|general\s+manager|partner|principal)\b",
    re.I,
)

_RANK = {"unknown": 0, "partial": 1, "confirmed": 2}


def authority_status_from_title(title: str) -> Optional[str]:
    normalized = " ".join((title or "").split()).strip()
    if not normalized:
        return None
    if C_SUITE_TITLE.search(normalized) or EXECUTIVE_TITLE.search(normalized):
        return "confirmed"
    if SENIOR_LEADER_TITLE.search(normalized):
        return "partial"
    return None


def infer_authority_from_lead_title(lead_title: str) -> str:
    """Default BANT authority for a call when only the prospect persona / title is known."""
    return authority_status_from_title(lead_title) or "unknown"
