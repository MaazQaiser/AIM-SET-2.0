from __future__ import annotations

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from dc_core.tenancy import TenantContext

from app.domain.call_channel import get_call_channel
from app.orchestrator.dispatcher import Orchestrator
from app.orchestrator.live_broadcast import transcript_event_to_ws

router = APIRouter()
_orch = Orchestrator()
_logger = logging.getLogger(__name__)
_dispatch_locks: dict[str, asyncio.Lock] = {}


def _segment_from_message(msg: dict, elapsed: int) -> dict:
    payload = msg.get("payload") or {}
    if not isinstance(payload, dict):
        payload = {}
    return {
        "id": payload.get("id") or msg.get("id"),
        "text": msg.get("text") or payload.get("text") or "",
        "speakerId": payload.get("speakerId") or msg.get("speakerId") or "unknown",
        "speakerName": payload.get("speakerName") or msg.get("speakerName") or "Speaker",
        "speakerRole": payload.get("speakerRole") or msg.get("speakerRole") or "customer",
        "timestamp": payload.get("timestamp") if payload.get("timestamp") is not None else elapsed,
    }


async def _process_live_segment(
    call_id: str,
    ctx: TenantContext,
    segment: dict,
    *,
    elapsed_seconds: int,
) -> None:
    """Broadcast transcript instantly, then run analysis in background."""
    lock = _dispatch_locks.setdefault(call_id, asyncio.Lock())
    channel = get_call_channel()
    if not segment.get("id"):
        segment["id"] = str(uuid.uuid4())

    # Broadcast transcript IMMEDIATELY (<1s)
    transcript_ws = transcript_event_to_ws(segment)
    await channel.broadcast(call_id, transcript_ws)

    # Run heavy analysis with lock (LLM, KB, BANT) — results trickle in
    try:
        async with lock:
            out = await asyncio.to_thread(
                _orch.dispatch_live_segment,
                ctx,
                call_id,
                segment,
                elapsed_seconds=elapsed_seconds,
        )
        for msg in out.get("ws_messages") or []:
            await channel.broadcast(call_id, msg)
    except Exception:
        _logger.exception("live segment dispatch failed call_id=%s", call_id)


@router.websocket("/ws/calls/{call_id}")
async def call_stream(websocket: WebSocket, call_id: str) -> None:
    await websocket.accept()
    channel = get_call_channel()
    await channel.subscribe(call_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    break
                continue
            if msg.get("type") == "transcript":
                ctx = TenantContext.from_headers(
                    msg.get("userId", "ws-user"),
                    tenant_id=msg.get("tenantId"),
                )
                elapsed = int(msg.get("elapsedSeconds") or msg.get("elapsed_seconds") or 0)
                segment = _segment_from_message(msg, elapsed)
                # Handler already fan-outs via CallChannelManager; do not also send_json here
                # (concurrent sends on the same socket were closing the connection after ~1 segment).
                asyncio.create_task(
                    _process_live_segment(
                        call_id, ctx, segment, elapsed_seconds=elapsed
                    )
                )
    except WebSocketDisconnect:
        pass
    except Exception:
        _logger.exception("unexpected error in ws loop call_id=%s", call_id)
    finally:
        await channel.unsubscribe(call_id, websocket)
