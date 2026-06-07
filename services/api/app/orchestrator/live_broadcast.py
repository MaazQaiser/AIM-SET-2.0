from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional

from dc_core.evidence import AgentEnvelope


def envelope_to_ws_messages(
    envelope: AgentEnvelope,
    *,
    suggestion_id: Optional[str] = None,
    shown_at: Optional[str] = None,
) -> List[Dict[str, Any]]:
    op = envelope.operation
    result = envelope.result or {}
    ts = int(time.time() * 1000)
    messages: List[Dict[str, Any]] = []

    if op == "proactive_nudge":
        nudge = result.get("nudge") or {}
        messages.append(
            {
                "type": "nudge",
                "payload": {
                    "id": suggestion_id or nudge.get("id") or str(uuid.uuid4()),
                    "suggestionId": suggestion_id,
                    "message": nudge.get("message", ""),
                    "role": nudge.get("role", "ae"),
                    "timestamp": ts,
                    "citation": _first_citation_dict(envelope),
                    "shownAt": shown_at,
                    "nudge_type": nudge.get("nudge_type"),
                },
            }
        )
    elif op == "signal_annotation":
        bant = result.get("bant")
        if bant:
            messages.append({"type": "bant_signal", "payload": bant})
        keywords = result.get("keywords")
        if keywords:
            messages.append({"type": "keywords", "payload": keywords})
    elif op == "intent_update":
        payload = result.get("intent_update") if "intent_update" in result else result
        messages.append({"type": "intent_update", "payload": payload})
    elif op == "kb_surface":
        messages.append({"type": "kb_assets", "payload": result.get("assets") or []})
    elif op == "objection_detected":
        messages.append(
            {
                "type": "objection",
                "payload": {
                    "id": suggestion_id or str(uuid.uuid4()),
                    **result,
                    "timestamp": ts,
                    "shownAt": shown_at,
                },
            }
        )
    elif op == "unanswered_question_flag":
        messages.append(
            {
                "type": "unanswered_question",
                "payload": {**result, "timestamp": ts, "id": suggestion_id},
            }
        )
    elif op == "bot_chat_response":
        messages.append(
            {
                "type": "bot_chat",
                "payload": {
                    "answer": result.get("answer"),
                    "asset_refs": result.get("asset_refs"),
                    "citations": [_citation_to_dict(c) for c in envelope.citations],
                },
            }
        )

    if op not in ("signal_annotation", "intent_snapshot", "intent_update"):
        messages.append(
            {
                "type": "suggestion_log",
                "payload": {
                    "id": suggestion_id,
                    "operation": op,
                    "timestamp": ts,
                    "shownAt": shown_at,
                    "confidence": envelope.confidence,
                    "trace_id": envelope.trace_id,
                    "summary": _log_summary(op, result),
                },
            }
        )

    return messages


def transcript_event_to_ws(event: Dict[str, Any]) -> Dict[str, Any]:
    # UI formats timestamp as mm:ss — use call offset in seconds when available.
    offset = event.get("offset_seconds")
    if offset is not None:
        ts = int(float(offset))
    else:
        ts = int(time.time())
        created = event.get("created_at")
        if created:
            try:
                from datetime import datetime

                dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                ts = int(dt.timestamp())
            except Exception:
                pass
    return {
        "type": "transcript",
        "payload": {
            "id": event.get("id"),
            "speakerId": event.get("speaker_id"),
            "speakerName": event.get("speaker_name") or event.get("speaker_id"),
            "speakerRole": _normalize_role(event.get("speaker_role")),
            "text": event.get("text"),
            "timestamp": ts,
            "keywords": event.get("keywords") or [],
            "sentiment": event.get("sentiment"),
            "signalType": event.get("signalType") or event.get("signal_type"),
        },
    }


def _normalize_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    r = role.lower()
    if r in ("customer", "prospect", "guest"):
        return "customer"
    if r in ("ae", "se", "designer"):
        return r
    return role


def _first_citation_dict(envelope: AgentEnvelope) -> Dict[str, Any]:
    if not envelope.citations:
        return {"id": "transcript", "title": "Transcript", "type": "transcript"}
    c = envelope.citations[0]
    return _citation_to_dict(c)


def _citation_to_dict(c: Any) -> Dict[str, Any]:
    title_by_type = {
        "company_playbook": "Company knowledge base",
        "kb_document": "Knowledge base",
        "transcript": "Transcript",
        "call_brief": "Call brief",
        "post_call_review": "Post-call review",
        "call_record": "Call record",
    }
    source_type = c.source_type
    return {
        "id": c.source_id,
        "title": title_by_type.get(source_type, "Knowledge base"),
        "type": source_type,
        "excerpt": c.snippet,
    }


def _log_summary(op: str, result: Dict[str, Any]) -> str:
    if op == "proactive_nudge":
        return (result.get("nudge") or {}).get("message", "")[:80]
    if op == "objection_detected":
        return (result.get("objection_text") or "")[:80]
    if op == "intent_update":
        return (result.get("call_direction") or result.get("intent_label") or "")[:80]
    if op == "unanswered_question_flag":
        return (result.get("text") or "")[:80]
    if op == "kb_surface":
        assets = result.get("assets") or []
        return f"{len(assets)} KB assets surfaced"
    return op
