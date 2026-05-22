from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request

from dc_core.tenancy import TenantContext

from app.config import get_settings
from app.domain.call_channel import get_call_channel
from app.orchestrator.dispatcher import Orchestrator
from app.services.transcript_provider.recall_webhook import (
    parse_recall_payload,
    resolve_call_id,
    segment_to_event_dict,
    verify_recall_signature,
)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])
_orch = Orchestrator()


def _ctx_from_query(tenant_id: Optional[str], user_id: Optional[str]) -> TenantContext:
    return TenantContext(
        tenant_id=tenant_id or "webhook-tenant",
        user_id=user_id or "recall-webhook",
        clerk_org_id=tenant_id,
    )


@router.post("/recall/transcript")
async def recall_transcript_webhook(
    request: Request,
    x_recall_signature: Optional[str] = Header(default=None, alias="X-Recall-Signature"),
    call_id: Optional[str] = Query(default=None),
    tenant_id: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    raw = await request.body()
    if not verify_recall_signature(raw, x_recall_signature, request.headers):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        body = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    parsed = parse_recall_payload(body)
    if not parsed:
        return {"ok": True, "ignored": True}

    ctx = _ctx_from_query(tenant_id, user_id)

    if parsed.get("kind") == "session_start":
        cid = resolve_call_id(ctx, parsed, explicit_call_id=call_id)
        if cid:
            return {"ok": True, "call_id": cid, "status": "live"}
        return {"ok": True, "warning": "no call_id resolved for session start"}

    if parsed.get("kind") == "session_end":
        cid = resolve_call_id(ctx, parsed, explicit_call_id=call_id)
        if cid:
            return _orch.dispatch_call_end(ctx, cid)
        return {"ok": True, "warning": "no call_id for session end"}

    cid = resolve_call_id(ctx, parsed, explicit_call_id=call_id)
    if not cid:
        raise HTTPException(
            status_code=422,
            detail="call_id required (query param) or link provider_meeting_id via call_live_sessions",
        )

    event = segment_to_event_dict(parsed, cid)
    result = await asyncio.to_thread(_orch.dispatch_live_segment, ctx, cid, event)
    channel = get_call_channel()
    for msg in result.get("ws_messages") or []:
        await channel.broadcast(cid, msg)
    return result


@router.post("/recall/demo-segment")
async def demo_segment(
    request: Request,
    call_id: str = Query(...),
    tenant_id: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    if not get_settings().demo_transcript_replay:
        raise HTTPException(status_code=404, detail="Demo replay disabled")
    body = await request.json()
    ctx = _ctx_from_query(tenant_id, user_id)
    event = {
        "id": body.get("id"),
        "speaker_id": body.get("speaker_id", "prospect"),
        "speaker_role": body.get("speaker_role", "customer"),
        "text": body.get("text", ""),
        "offset_seconds": body.get("offset_seconds", 0),
        "provider": "demo",
        "provider_event_id": body.get("provider_event_id"),
    }
    result = await asyncio.to_thread(_orch.dispatch_live_segment, ctx, call_id, event)
    # Broadcast all WS messages from the async event loop (reliable)
    channel = get_call_channel()
    for msg in result.get("ws_messages") or []:
        await channel.broadcast(call_id, msg)
    # Also include the transcript event in the response as fallback
    result["transcript_event"] = {
        "id": event.get("id") or event.get("provider_event_id"),
        "speaker_id": event["speaker_id"],
        "speaker_role": event["speaker_role"],
        "text": event["text"],
        "offset_seconds": event["offset_seconds"],
    }
    return result
