from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import uuid
from typing import Any, Dict, Mapping, Optional

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.live_call_repository import get_live_call_repository


def verify_recall_signature(
    raw_body: bytes,
    signature_header: Optional[str],
    headers: Optional[Mapping[str, str]] = None,
) -> bool:
    secret = get_settings().recall_webhook_secret
    if not secret:
        return True
    normalized = {k.lower(): v for k, v in (headers or {}).items()}
    if _has_recall_webhook_signature(normalized):
        return _verify_recall_webhook_headers(raw_body, secret, normalized)
    if not signature_header:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.replace("sha256=", "").strip()
    return hmac.compare_digest(expected, provided)


def parse_recall_payload(body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map Recall-style webhook bodies to internal TranscriptSegment fields."""
    import logging as _log

    _log.getLogger("recall.webhook").info("Raw payload: %s", body)

    # --- Recall realtime_endpoints sends: {"data": {"data": {...}, "is_final": bool}} ---
    # Skip interim (non-final) transcripts to avoid duplicates.
    event = body.get("event") or body.get("type") or ""
    envelope = _dict_or_empty(body.get("data"))

    # Recall streaming sends is_final at the envelope level
    is_final = envelope.get("is_final")
    if is_final is None:
        is_final = body.get("is_final")
    # If is_final is explicitly False, skip this interim transcript
    if is_final is False:
        return None

    data = _dict_or_empty(envelope.get("data")) or envelope or _dict_or_empty(body.get("transcript")) or body

    if isinstance(body.get("data"), list):
        data = body["data"][-1] if body["data"] else {}

    words = data.get("words") or []
    # Recall streaming puts the full sentence in data.transcript or words
    text = data.get("text") or data.get("transcript") or data.get("sentence") or body.get("text") or ""
    if isinstance(text, list):
        text = " ".join(str(t) for t in text)
    text = str(text).strip()
    if not text and event not in ("bot.status_change", "meeting.ended", "call.ended"):
        if words:
            text = " ".join(w.get("text", w) if isinstance(w, dict) else str(w) for w in words).strip()

    participant = _dict_or_empty(data.get("participant"))
    speaker = (
        participant.get("name")
        or data.get("speaker")
        or data.get("speaker_name")
        or data.get("participant_name")
        or "unknown"
    )
    # Prefer participant name over numeric id for display
    speaker_id = str(
        participant.get("name")
        or participant.get("id")
        or data.get("speaker_id")
        or data.get("participant_id")
        or speaker
    )
    role_raw = (data.get("speaker_role") or data.get("role") or "").lower()
    if role_raw in ("agent", "host", "rep", "ae", "sales"):
        speaker_role = "ae"
    elif role_raw in ("guest", "customer", "prospect", "client"):
        speaker_role = "customer"
    elif participant.get("is_host") is True:
        speaker_role = "ae"
    elif participant.get("is_host") is False:
        speaker_role = "customer"
    else:
        speaker_role = "customer" if "?" in text else "ae"

    # Extract timestamp — try words first, then original_transcript_timings, then data.timestamp
    offset = _first_relative_timestamp(words)
    if offset is None:
        # Recall streaming uses original_transcript_timings or start_time
        timings = data.get("original_transcript_timings") or []
        if timings and isinstance(timings, list) and isinstance(timings[0], dict):
            offset = _relative_timestamp(timings[0].get("start_time"))
        if offset is None:
            offset = _relative_timestamp(data.get("timestamp"))
    if offset is None:
        offset = float(
            data.get("start_time")
            or data.get("offset_seconds")
            or body.get("offset_seconds")
            or 0
        )

    bot = _dict_or_empty(envelope.get("bot")) or _dict_or_empty(body.get("bot"))
    recording = _dict_or_empty(envelope.get("recording")) or _dict_or_empty(body.get("recording"))
    metadata = _dict_or_empty(bot.get("metadata")) or _dict_or_empty(envelope.get("metadata"))
    meeting_id = (
        bot.get("id")
        or data.get("meeting_id")
        or data.get("bot_id")
        or body.get("meeting_id")
        or body.get("bot_id")
        or recording.get("bot_id")
    )
    provider_event_id = (
        data.get("id")
        or data.get("event_id")
        or body.get("id")
        or hashlib.sha256(f"{meeting_id}:{text}:{offset}".encode()).hexdigest()[:32]
    )

    if event in ("meeting.ended", "call.ended", "bot.status_change") and (
        (data.get("status") or "").lower() in ("done", "ended", "completed")
        or "end" in str(event).lower()
    ):
        return {
            "kind": "session_end",
            "call_id": metadata.get("call_id"),
            "provider_meeting_id": str(meeting_id) if meeting_id else None,
        }
    if event in ("bot.status_change", "meeting.started", "call.started"):
        return {
            "kind": "session_start",
            "call_id": metadata.get("call_id"),
            "provider_meeting_id": str(meeting_id) if meeting_id else None,
        }

    if not text:
        return None

    return {
        "kind": "segment",
        "text": text,
        "speaker_id": speaker_id,
        "speaker_role": speaker_role,
        "offset_seconds": offset,
        "provider_event_id": str(provider_event_id),
        "provider_meeting_id": str(meeting_id) if meeting_id else None,
        "call_id": metadata.get("call_id"),
    }


def resolve_call_id(
    ctx: TenantContext,
    parsed: Dict[str, Any],
    *,
    explicit_call_id: Optional[str] = None,
) -> Optional[str]:
    parsed_call_id = explicit_call_id or parsed.get("call_id")
    if parsed_call_id:
        get_live_call_repository().get_or_create_session(
            ctx,
            parsed_call_id,
            provider_meeting_id=parsed.get("provider_meeting_id"),
        )
        return parsed_call_id
    meeting_id = parsed.get("provider_meeting_id")
    if meeting_id:
        found = get_live_call_repository().resolve_call_by_provider_meeting(ctx, meeting_id)
        if found:
            return found
    return None


def segment_to_event_dict(parsed: Dict[str, Any], call_id: str) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "call_id": call_id,
        "speaker_id": parsed.get("speaker_id", "unknown"),
        "speaker_role": parsed.get("speaker_role"),
        "text": parsed.get("text", ""),
        "offset_seconds": parsed.get("offset_seconds", 0),
        "provider": "recall",
        "provider_event_id": parsed.get("provider_event_id"),
    }


def _has_recall_webhook_signature(headers: Mapping[str, str]) -> bool:
    return bool(
        (headers.get("webhook-signature") or headers.get("svix-signature"))
        and (headers.get("webhook-id") or headers.get("svix-id"))
        and (headers.get("webhook-timestamp") or headers.get("svix-timestamp"))
    )


def _verify_recall_webhook_headers(
    raw_body: bytes,
    secret: str,
    headers: Mapping[str, str],
) -> bool:
    msg_id = headers.get("webhook-id") or headers.get("svix-id") or ""
    timestamp = headers.get("webhook-timestamp") or headers.get("svix-timestamp") or ""
    signature_header = headers.get("webhook-signature") or headers.get("svix-signature") or ""
    key = _webhook_secret_bytes(secret)
    signed = f"{msg_id}.{timestamp}.{raw_body.decode('utf-8')}".encode("utf-8")
    expected = hmac.new(key, signed, hashlib.sha256).digest()
    for item in signature_header.split(" "):
        version, _, signature = item.partition(",")
        if version != "v1" or not signature:
            continue
        try:
            provided = base64.b64decode(signature)
        except (binascii.Error, ValueError):
            continue
        if len(provided) == len(expected) and hmac.compare_digest(provided, expected):
            return True
    return False


def _webhook_secret_bytes(secret: str) -> bytes:
    raw = secret.removeprefix("whsec_")
    try:
        return base64.b64decode(raw)
    except (binascii.Error, ValueError):
        return secret.encode("utf-8")


def _dict_or_empty(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _relative_timestamp(value: Any) -> Optional[float]:
    if isinstance(value, dict):
        value = value.get("relative")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _first_relative_timestamp(words: Any) -> Optional[float]:
    if not isinstance(words, list):
        return None
    for word in words:
        if not isinstance(word, dict):
            continue
        ts = _relative_timestamp(word.get("start_timestamp"))
        if ts is not None:
            return ts
    return None
