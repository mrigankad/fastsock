"""WebSocket handlers for all call.* events."""
from __future__ import annotations
from collections import deque
from datetime import datetime
from uuid import uuid4
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.ws.event_dispatcher import dispatcher
from app.ws.manager import ConnectionManager
from app.models.call import CallSession
from app.models.user import User
from app.services.calls import can_initiate_call
from app.schemas.ws_events import WSEvent


async def _get_call(db: AsyncSession, call_id: str) -> CallSession | None:
    return await db.get(CallSession, call_id)


@dispatcher.register("call.invite")
async def handle_call_invite(
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
    invite_timestamps: deque,
    **_,
) -> None:
    target_user_id = data.get("to_user_id") or data.get("receiver_id") or data.get("peer_user_id")
    if not target_user_id:
        await websocket.send_json({"event": "call.error", "data": {"message": "Missing call recipient"}})
        return

    now = datetime.utcnow()
    recent = [t for t in invite_timestamps if (now - t).total_seconds() < 30]
    recent.append(now)
    invite_timestamps.clear()
    invite_timestamps.extend(recent)
    if len(invite_timestamps) > 3:
        await websocket.send_json({"event": "call.error", "data": {"message": "Too many call invites"}})
        return

    room_id = data.get("room_id")
    if not await can_initiate_call(db, user_id, target_user_id, room_id):
        await websocket.send_json({"event": "call.error", "data": {"message": "Not allowed to call this user"}})
        return

    call_id = data.get("call_id") or str(uuid4())
    if await _get_call(db, call_id) is not None:
        await websocket.send_json({"event": "call.error", "data": {"message": "Call already exists", "call_id": call_id}})
        return

    target_user = await db.get(User, target_user_id)
    if target_user and target_user.presence_status in ("dnd", "busy"):
        label = "Do Not Disturb" if target_user.presence_status == "dnd" else "Busy"
        await websocket.send_json({
            "event": "call.user_busy",
            "data": {"message": f"User is set to {label}", "call_id": call_id, "target_user_id": target_user_id},
        })
        return

    call = CallSession(
        call_id=call_id,
        room_id=room_id,
        caller_id=user_id,
        callee_id=target_user_id,
        status="ringing",
    )
    db.add(call)
    await db.commit()

    await manager.broadcast(WSEvent(
        event="call.invite",
        data={**data, "call_id": call_id, "from_user_id": user_id},
        recipient_ids=[target_user_id],
    ))


async def _relay_call_event(
    event_type: str,
    data: dict,
    user_id: int,
    websocket: WebSocket,
    db: AsyncSession,
    manager: ConnectionManager,
) -> None:
    call_id = data.get("call_id")
    if not call_id:
        await websocket.send_json({"event": "call.error", "data": {"message": "Missing call_id"}})
        return

    call = await _get_call(db, call_id)
    if call is None:
        await websocket.send_json({"event": "call.error", "data": {"message": "Unknown call", "call_id": call_id}})
        return
    if user_id not in {call.caller_id, call.callee_id}:
        await websocket.send_json({"event": "call.error", "data": {"message": "Not authorized for this call"}})
        return

    other = call.callee_id if user_id == call.caller_id else call.caller_id

    if event_type == "call.accept":
        call.status = "active"
        call.started_at = datetime.utcnow()
        await db.commit()
    elif event_type in {"call.reject", "call.hangup", "call.busy"}:
        call.status = "rejected" if event_type == "call.reject" else ("busy" if event_type == "call.busy" else "ended")
        call.ended_at = datetime.utcnow()
        await db.commit()

    await manager.broadcast(WSEvent(
        event=event_type,
        data={**data, "from_user_id": user_id},
        recipient_ids=[other],
    ))


for _ev in ("call.accept", "call.reject", "call.hangup", "call.busy", "call.offer", "call.answer", "call.ice_candidate"):
    # Use a closure to capture _ev
    def _make_handler(ev: str):
        @dispatcher.register(ev)
        async def _handler(data, user_id, websocket, db, manager, **_):
            await _relay_call_event(ev, data, user_id, websocket, db, manager)
        _handler.__name__ = f"handle_{ev.replace('.', '_')}"
        return _handler
    _make_handler(_ev)
