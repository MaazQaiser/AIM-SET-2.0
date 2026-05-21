from __future__ import annotations

import hashlib
import hmac
import uuid
from typing import Any, Dict, Optional, Tuple

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.live_call_repository import get_live_call_repository


def verify_recall_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    secret = get_settings().recall_webhook_secret
    if not secret:
        return True
    if not signature_header:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    provided = signature_header.replace("sha256=", "").strip()
    return hmac.compare_digest(expected, provided)


def parse_recall_payload(body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map Recall-style webhook bodies to internal TranscriptSegment fields."""
    event = body.get("event") or body.get("type") or ""
    data = body.get("data") or body.get("transcript") or body

    if isinstance(data, list):
        data = data[-1] if data else {}

    text = (
        data.get("text")
        or data.get("transcript")
        or data.get("sentence")
        or body.get("text")
        or ""
    )
    if isinstance(text, list):
        text = " ".join(str(t) for t in text)
    text = str(text).strip()
    if not text and event not in ("bot.status_change", "meeting.ended", "call.ended"):
        words = data.get("words") or []
        if words:
            text = " ".join(
                w.get("text", w) if isinstance(w, dict) else str(w) for w in words
            ).strip()

    speaker = (
        data.get("speaker")
        or data.get("speaker_name")
        or data.get("participant_name")
        or "unknown"
    )
    speaker_id = str(data.get("speaker_id") or data.get("participant_id") or speaker)
    role_raw = (data.get("speaker_role") or data.get("role") or "").lower()
    if role_raw in ("agent", "host", "rep", "ae", "sales"):
        speaker_role = "ae"
    elif role_raw in ("guest", "customer", "prospect", "client"):
        speaker_role = "customer"
    else:
        speaker_role = "customer" if "?" in text else "ae"

    offset = float(
        data.get("start_time")
        or data.get("offset_seconds")
        or data.get("timestamp")
        or body.get("offset_seconds")
        or 0
    )

    meeting_id = (
        data.get("meeting_id")
        or data.get("bot_id")
        or body.get("meeting_id")
        or body.get("bot_id")
        or (body.get("data") or {}).get("bot_id")
    )
    provider_event_id = (
        data.get("id")
        or data.get("event_id")
        or body.get("id")
        or hashlib.sha256(f"{meeting_id}:{text}:{offset}".encode()).hexdigest()[:32]
    )

    if event in ("bot.status_change", "meeting.started", "call.started"):
        return {
            "kind": "session_start",
            "provider_meeting_id": str(meeting_id) if meeting_id else None,
        }
    if event in ("meeting.ended", "call.ended", "bot.status_change") and (
        (data.get("status") or "").lower() in ("done", "ended", "completed")
        or "end" in str(event).lower()
    ):
        return {
            "kind": "session_end",
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
    }


def resolve_call_id(
    ctx: TenantContext,
    parsed: Dict[str, Any],
    *,
    explicit_call_id: Optional[str] = None,
) -> Optional[str]:
    if explicit_call_id:
        get_live_call_repository().get_or_create_session(
            ctx,
            explicit_call_id,
            provider_meeting_id=parsed.get("provider_meeting_id"),
        )
        return explicit_call_id
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
