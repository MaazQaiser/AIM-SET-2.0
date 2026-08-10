from __future__ import annotations

import re
from typing import Any, Dict, Iterable, Optional

CUSTOMER_ROLES = {"customer", "prospect", "buyer", "client", "lead", "contact", "guest"}
INTERNAL_ROLE_ALIASES = {
    "ae": "ae",
    "account_executive": "ae",
    "account executive": "ae",
    "sales": "ae",
    "sales_rep": "ae",
    "sales rep": "ae",
    "rep": "ae",
    "host": "ae",
    "agent": "ae",
    "se": "se",
    "solution_engineer": "se",
    "solutions_engineer": "se",
    "solution engineer": "se",
    "solutions engineer": "se",
    "designer": "designer",
    "pod": "pod",
    "internal": "pod",
}

_INTERNAL_SPEAKER_ID_RE = re.compile(
    r"\b(?:ae|account[-_\s]?executive|sales|sales[-_\s]?rep|se|solutions?[-_\s]?engineer|designer)\b",
    re.I,
)
_AE_COMMITMENT_RE = re.compile(
    r"\b(?:i|we|let me|we can|i can|we'll|i'll|we will|i will)\s+"
    r"(?:also\s+)?(?:send|share|provide|prepare|put together|draft|include|separate|"
    r"schedule|follow up|follow-up|propose|estimate|scope|price|map)\b"
    r"[\s\S]{0,180}\b(?:proposal|estimate|estimates|pricing breakdown|cost breakdown|"
    r"budget breakdown|cio review|review|workflow map|integration plan|team structure|breakdown)\b",
    re.I,
)
_AE_FUTURE_DELIVERY_RE = re.compile(
    r"\b(?:i|we|let me|we can|i can|we'll|i'll|we will|i will)\s+"
    r"(?:send|share|provide)\b[\s\S]{0,80}\b(?:budget|pricing|cost|timeline|pilot)\b"
    r"[\s\S]{0,80}\b(?:tomorrow|later|after (?:this|the) call|next week|next month|"
    r"in \d+ (?:day|days|week|weeks)|by (?:eod|eow|monday|tuesday|wednesday|thursday|friday))\b",
    re.I,
)
_AE_SOLUTION_LANGUAGE_RE = re.compile(
    r"\b(?:i am .+ from |the proposal should show|we would not ask you|we can propose|"
    r"we can defend|we would map|we will separate|i will separate|think of us as)\b",
    re.I,
)


def normalize_speaker_role(role: Any) -> Optional[str]:
    text = str(role or "").strip().lower()
    if not text:
        return None
    if text in CUSTOMER_ROLES:
        return "customer"
    return INTERNAL_ROLE_ALIASES.get(text)


def infer_speaker_role(
    *,
    explicit_role: Any = None,
    speaker_id: Any = None,
    speaker_name: Any = None,
    text: Any = None,
    call: Optional[Dict[str, Any]] = None,
    brief: Optional[Dict[str, Any]] = None,
) -> str:
    explicit = normalize_speaker_role(explicit_role)
    if explicit:
        return explicit

    role_from_internal = _match_internal_attendee_role(speaker_id, speaker_name, call, brief)
    if role_from_internal:
        return role_from_internal
    if _matches_client_attendee(speaker_id, speaker_name, call, brief):
        return "customer"

    speaker_blob = " ".join(str(v or "") for v in (speaker_id, speaker_name)).strip()
    if _INTERNAL_SPEAKER_ID_RE.search(speaker_blob):
        return _role_from_internal_hint(speaker_blob)

    spoken = str(text or "")
    if (
        _AE_COMMITMENT_RE.search(spoken)
        or _AE_FUTURE_DELIVERY_RE.search(spoken)
        or _AE_SOLUTION_LANGUAGE_RE.search(spoken)
    ):
        return "ae"

    return "unknown"


def _role_from_internal_hint(value: str) -> str:
    lower = value.lower()
    if "designer" in lower:
        return "designer"
    if "se" in lower or "engineer" in lower:
        return "se"
    return "ae"


def _match_internal_attendee_role(
    speaker_id: Any,
    speaker_name: Any,
    call: Optional[Dict[str, Any]],
    brief: Optional[Dict[str, Any]],
) -> Optional[str]:
    for attendee in _internal_attendees(call, brief):
        if not isinstance(attendee, dict):
            continue
        if not _same_person(speaker_id, speaker_name, attendee):
            continue
        return normalize_speaker_role(attendee.get("role") or attendee.get("designation")) or "ae"
    return None


def _matches_client_attendee(
    speaker_id: Any,
    speaker_name: Any,
    call: Optional[Dict[str, Any]],
    brief: Optional[Dict[str, Any]],
) -> bool:
    for attendee in _client_attendees(call, brief):
        if isinstance(attendee, dict) and _same_person(speaker_id, speaker_name, attendee):
            return True

    lead_name = (call or {}).get("leadName") or (brief or {}).get("leadName")
    if lead_name and _name_matches(speaker_name, lead_name):
        return True
    return False


def _internal_attendees(
    call: Optional[Dict[str, Any]],
    brief: Optional[Dict[str, Any]],
) -> Iterable[Dict[str, Any]]:
    yield from _dicts((call or {}).get("pod"))
    yield from _dicts((brief or {}).get("internalAttendees"))
    for note in _dicts((brief or {}).get("podNotes")):
        yield {
            "id": note.get("memberId"),
            "name": note.get("memberName"),
            "role": note.get("role"),
        }


def _client_attendees(
    call: Optional[Dict[str, Any]],
    brief: Optional[Dict[str, Any]],
) -> Iterable[Dict[str, Any]]:
    yield from _dicts((brief or {}).get("clientAttendees"))
    for history in _dicts((brief or {}).get("interactionHistory")):
        for name in history.get("attendees") or []:
            yield {"name": name}
    lead_name = (call or {}).get("leadName")
    if lead_name:
        yield {"name": lead_name}


def _dicts(value: Any) -> Iterable[Dict[str, Any]]:
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                yield item


def _same_person(speaker_id: Any, speaker_name: Any, attendee: Dict[str, Any]) -> bool:
    attendee_ids = [
        attendee.get("id"),
        attendee.get("speakerId"),
        attendee.get("speaker_id"),
        attendee.get("email"),
    ]
    speaker_ids = [speaker_id, speaker_name]
    for left in speaker_ids:
        for right in attendee_ids:
            if _clean(left) and _clean(left) == _clean(right):
                return True

    attendee_name = attendee.get("name") or attendee.get("memberName") or attendee.get("displayName")
    return _name_matches(speaker_name, attendee_name) or _name_matches(speaker_id, attendee_name)


def _name_matches(left: Any, right: Any) -> bool:
    left_clean = _clean(left)
    right_clean = _clean(right)
    if not left_clean or not right_clean:
        return False
    if left_clean == right_clean or left_clean in right_clean or right_clean in left_clean:
        return True
    left_tokens = _name_tokens(left_clean)
    right_tokens = _name_tokens(right_clean)
    return bool(left_tokens and right_tokens and left_tokens & right_tokens)


def _clean(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _name_tokens(value: str) -> set[str]:
    return {token for token in value.split() if len(token) >= 3 and token not in {"dr", "mr", "mrs", "ms"}}
