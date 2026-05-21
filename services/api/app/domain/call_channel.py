from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Set

from fastapi import WebSocket


class CallChannelManager:
    """In-memory fan-out of live call events to subscribed WebSocket clients."""

    def __init__(self) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def subscribe(self, call_id: str, ws: WebSocket) -> None:
        if self._loop is None:
            self._loop = asyncio.get_running_loop()
        async with self._lock:
            self._rooms.setdefault(call_id, set()).add(ws)

    async def unsubscribe(self, call_id: str, ws: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(call_id)
            if not room:
                return
            room.discard(ws)
            if not room:
                del self._rooms[call_id]

    async def broadcast(self, call_id: str, message: Dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._rooms.get(call_id, set()))
        if not targets:
            return
        payload = json.dumps(message)
        dead: List[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                room = self._rooms.get(call_id)
                if room:
                    for ws in dead:
                        room.discard(ws)

    def broadcast_sync(self, call_id: str, message: Dict[str, Any]) -> None:
        """Schedule a broadcast on the WebSocket loop (safe from worker threads)."""
        loop = self._loop
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return
        coro = self.broadcast(call_id, message)
        try:
            if asyncio.get_running_loop() is loop:
                loop.create_task(coro)
                return
        except RuntimeError:
            pass
        asyncio.run_coroutine_threadsafe(coro, loop)


_channels: CallChannelManager | None = None


def get_call_channel() -> CallChannelManager:
    global _channels
    if _channels is None:
        _channels = CallChannelManager()
    return _channels
