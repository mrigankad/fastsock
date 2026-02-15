"""WebSocket handlers for typing.start / typing.stop events."""
from __future__ import annotations
import time
from collections import deque
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.ws.event_dispatcher import dispatcher
from app.ws.manager import ConnectionManager
from app.schemas.ws_events import WSEvent

TYPING_RATE_WINDOW = 10
MAX_TYPING_PER_WINDOW = 40


@dispatcher.register("typing.start")
async def handle_typing_start(
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
    typing_timestamps: deque,
    **_,
) -> None:
    receiver_id = data.get("receiver_id")
    if not receiver_id:
        return
    now = time.monotonic()
    typing_timestamps.append(now)
    while typing_timestamps and (now - typing_timestamps[0]) > TYPING_RATE_WINDOW:
        typing_timestamps.popleft()
    if len(typing_timestamps) > MAX_TYPING_PER_WINDOW:
        return
    await manager.broadcast(WSEvent(
        event="typing.start",
        data={"sender_id": user_id, "receiver_id": receiver_id},
    ))


@dispatcher.register("typing.stop")
async def handle_typing_stop(
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
    typing_timestamps: deque,
    **_,
) -> None:
    receiver_id = data.get("receiver_id")
    if not receiver_id:
        return
    now = time.monotonic()
    typing_timestamps.append(now)
    while typing_timestamps and (now - typing_timestamps[0]) > TYPING_RATE_WINDOW:
        typing_timestamps.popleft()
    if len(typing_timestamps) > MAX_TYPING_PER_WINDOW:
        return
    await manager.broadcast(WSEvent(
        event="typing.stop",
        data={"sender_id": user_id, "receiver_id": receiver_id},
    ))
