"""
WebSocket handlers for all message.* events.
Registered into the singleton dispatcher.
"""
from __future__ import annotations
import time
from collections import deque
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.ws.event_dispatcher import dispatcher
from app.ws.manager import ConnectionManager
from app.domain.messaging.service import MessageService
from app.models.message import MessageType
from app.models.chat import ChatRoom, ChatRoomMember
from app.schemas.ws_events import WSEvent
from sqlalchemy import select, and_

MAX_CONTENT_CHARS = 4000
MESSAGE_RATE_WINDOW = 10  # seconds
MAX_MESSAGES_PER_WINDOW = 30

# Per-connection rate-limit state is passed in via ctx
# (stored on the WS connection loop in ws/router.py)


@dispatcher.register("message.send")
async def handle_message_send(
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
    message_timestamps: deque,
    **_,
) -> None:
    content = data.get("content")
    receiver_id = data.get("receiver_id")
    room_id = data.get("room_id")
    reply_to_id = data.get("reply_to_id")

    if not content or not isinstance(content, str):
        return
    if len(content) > MAX_CONTENT_CHARS:
        await websocket.send_json({"event": "message.error", "data": {"message": "Message too long"}})
        return
    if bool(receiver_id) == bool(room_id):
        await websocket.send_json({"event": "message.error", "data": {"message": "Provide exactly one of receiver_id or room_id"}})
        return

    now = time.monotonic()
    message_timestamps.append(now)
    while message_timestamps and (now - message_timestamps[0]) > MESSAGE_RATE_WINDOW:
        message_timestamps.popleft()
    if len(message_timestamps) > MAX_MESSAGES_PER_WINDOW:
        await websocket.close(code=1008)
        return

    # ── Slow-mode check (rooms only) ──────────────────────────────────────────
    if room_id:
        room_row = (await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))).scalar_one_or_none()
        if room_row and room_row.slow_mode_seconds and room_row.slow_mode_seconds > 0:
            # Find the user's last message timestamp in this room
            from app.models.message import Message as MessageModel
            from sqlalchemy import func as sqlfunc
            last_ts = await db.scalar(
                select(sqlfunc.max(MessageModel.timestamp)).where(
                    MessageModel.room_id == room_id,
                    MessageModel.sender_id == user_id,
                )
            )
            if last_ts is not None:
                from datetime import datetime, timezone
                elapsed = (datetime.now(timezone.utc) - last_ts.replace(tzinfo=timezone.utc)).total_seconds()
                remaining = room_row.slow_mode_seconds - elapsed
                if remaining > 0:
                    await websocket.send_json({
                        "event": "message.error",
                        "data": {"message": f"Slow mode: wait {int(remaining)+1}s before sending again"},
                    })
                    return

    msg_type = (
        MessageType.IMAGE
        if content.startswith("/static/") or data.get("message_type") == "image"
        else MessageType.TEXT
    )

    svc = MessageService(db, manager)
    try:
        msg = await svc.send(
            sender_id=user_id,
            content=content,
            receiver_id=receiver_id,
            room_id=room_id,
            message_type=msg_type,
            reply_to_id=reply_to_id,
        )
    except Exception as exc:
        await websocket.send_json({"event": "message.error", "data": {"message": str(exc)}})
        return

    ack = WSEvent(
        event="message.ack",
        data={
            "message_id": msg.id,
            "status": "sent",
            "timestamp": msg.timestamp.isoformat(),
        },
    )
    await websocket.send_text(ack.model_dump_json())


@dispatcher.register("message.delivered")
async def handle_message_delivered(
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
    **_,
) -> None:
    message_id = data.get("message_id")
    sender_id = data.get("sender_id")
    if not message_id:
        return
    svc = MessageService(db, manager)
    await svc.mark_delivered(message_id, sender_id)


@dispatcher.register("message.read")
async def handle_message_read(
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
    **_,
) -> None:
    message_id = data.get("message_id")
    sender_id = data.get("sender_id")
    if not message_id:
        return
    svc = MessageService(db, manager)
    await svc.mark_read(message_id, user_id, sender_id)


@dispatcher.register("message.reaction")
async def handle_message_reaction(
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
    **_,
) -> None:
    message_id = data.get("message_id")
    emoji = data.get("emoji")
    if not isinstance(message_id, int) or not isinstance(emoji, str):
        await websocket.send_json({"event": "message.error", "data": {"message": "Invalid reaction"}})
        return
    svc = MessageService(db, manager)
    try:
        await svc.toggle_reaction(message_id, user_id, emoji)
    except Exception as exc:
        await websocket.send_json({"event": "message.error", "data": {"message": str(exc)}})
