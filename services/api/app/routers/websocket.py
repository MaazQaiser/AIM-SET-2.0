from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from dc_core.tenancy import TenantContext

from app.orchestrator.dispatcher import Orchestrator

router = APIRouter()
_orch = Orchestrator()


@router.websocket("/ws/calls/{call_id}")
async def call_stream(websocket: WebSocket, call_id: str) -> None:
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "ping"})
                continue
            if msg.get("type") == "transcript":
                ctx = TenantContext.from_headers(msg.get("userId", "ws-user"))
                env = _orch.dispatch_live_segment(ctx, call_id, msg.get("text", ""))
                nudge = env.get("result", {}).get("nudge")
                if nudge:
                    await websocket.send_json({"type": "nudge", "payload": nudge})
                await websocket.send_json(
                    {
                        "type": "transcript",
                        "payload": msg.get("payload") or msg,
                    }
                )
    except WebSocketDisconnect:
        return
