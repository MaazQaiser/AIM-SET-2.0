from __future__ import annotations

from typing import List

CLIENT_UNSAFE_TERMS = [
    "bant",
    "bant coverage",
    "jira",
    "internal",
    "scorecard",
    "coaching",
    "open discovery gap",
    "discovery gaps",
    "discovery coverage",
    "agent envelope",
    "trace id",
    "pod member",
    "is qualifying",
]


def has_client_unsafe_text(text: str) -> bool:
    lowered = (text or "").lower()
    return any(term in lowered for term in CLIENT_UNSAFE_TERMS)


def safe_client_lines(lines: List[str]) -> List[str]:
    out: List[str] = []
    for line in lines or []:
        stripped = (line or "").strip()
        if not stripped:
            continue
        if has_client_unsafe_text(stripped):
            continue
        out.append(stripped)
    return out


def sanitize_client_headline(value: str, account_name: str) -> str:
    text = (value or "").strip()
    if not text or has_client_unsafe_text(text):
        return f"Thank you for your time, {account_name}"
    return text


def sanitize_client_bullets(lines: List[str], fallback: List[str]) -> List[str]:
    safe = safe_client_lines(lines)
    return (safe[:6] if safe else fallback[:6]) or [
        "We discussed your priorities and agreed on next steps for follow-up."
    ]
