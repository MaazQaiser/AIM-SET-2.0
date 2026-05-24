from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List

from fastapi import WebSocket

_logger = logging.getLogger(__name__)


class _ClientConnection:
    """Wraps a WebSocket with a serialized send queue to prevent concurrent sends."""

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._send_loop())

    async def _send_loop(self) -> None:
        try:
            while True:
                payload = await self._queue.get()
                try:
                    await self.ws.send_text(payload)
                except Exception:
                    break
        except asyncio.CancelledError:
            pass

    def enqueue(self, payload: str) -> None:
        try:
            self._queue.put_nowait(payload)
        except Exception:
            pass

    def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()


class CallChannelManager:
    """In-memory fan-out of live call events to subscribed WebSocket clients."""

    def __init__(self) -> None:
        self._rooms: Dict[str, Dict[WebSocket, _ClientConnection]] = {}
        self._pending: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def subscribe(self, call_id: str, ws: WebSocket) -> None:
        if self._loop is None:
            self._loop = asyncio.get_running_loop()
        client = _ClientConnection(ws)
        client.start()
        async with self._lock:
            self._rooms.setdefault(call_id, {})[ws] = client
            pending = list(self._pending.pop(call_id, []))
        _logger.info(
            "WS subscribe call_id=%s total=%d", call_id, len(self._rooms.get(call_id, {}))
        )
        for message in pending[-50:]:
            client.enqueue(json.dumps(message))

    async def unsubscribe(self, call_id: str, ws: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(call_id)
            if not room:
                return
            client = room.pop(ws, None)
            if client:
                client.stop()
            if not room:
                del self._rooms[call_id]

    async def broadcast(self, call_id: str, message: Dict[str, Any]) -> None:
        payload = json.dumps(message)
        async with self._lock:
            room = self._rooms.get(call_id)
            if not room:
                queue = self._pending.setdefault(call_id, [])
                queue.append(message)
                if len(queue) > 100:
                    self._pending[call_id] = queue[-100:]
                return
            clients = list(room.values())
        _logger.info(
            "broadcast call_id=%s type=%s to %d clients",
            call_id,
            message.get("type"),
            len(clients),
        )
        for client in clients:
            client.enqueue(payload)

    def broadcast_sync(self, call_id: str, message: Dict[str, Any]) -> None:
        """Schedule a broadcast on the WebSocket loop (safe from worker threads)."""
        loop = self._loop
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
                self._loop = loop
            except RuntimeError:
                queue = self._pending.setdefault(call_id, [])
                queue.append(message)
                if len(queue) > 100:
                    self._pending[call_id] = queue[-100:]
                return
        if loop.is_closed():
            return
        coro = self.broadcast(call_id, message)
        try:
            if asyncio.get_running_loop() is loop:
                loop.create_task(coro)
                return
        except RuntimeError:
            pass
        try:
            asyncio.run_coroutine_threadsafe(coro, loop)
        except RuntimeError:
            pass


_channels: CallChannelManager | None = None


def get_call_channel() -> CallChannelManager:
    global _channels
    if _channels is None:
        _channels = CallChannelManager()
    return _channels
