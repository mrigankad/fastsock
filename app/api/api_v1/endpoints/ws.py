from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from sqlalchemy.orm import selectinload
from app.api import deps
from app.ws.manager import manager
from app.schemas.ws_events import WSEvent
from app.models.message import Message, MessageType
from app.models.chat import ChatRoom
from app.models.call import CallSession
from app.services.calls import can_initiate_call
from app.db.session import AsyncSessionLocal
import json
from datetime import datetime
from uuid import uuid4
from collections import deque
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/chat")
async def websocket_endpoint(
    websocket: WebSocket,
    current_user = Depends(deps.get_current_user_ws),
):
    if not current_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, current_user.id)
    invite_timestamps = deque()
    
    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > 200_000:
                await websocket.close(code=1009)
                return
            
            try:
                event_data = json.loads(data)
                event = WSEvent(**event_data)
            except Exception:
                await websocket.send_json({"error": "Invalid JSON format"})
                continue

            if event.event == "message.send":
                payload = event.data
                content = payload.get("content")
                receiver_id = payload.get("receiver_id")
                room_id = payload.get("room_id")
                
                if not content:
                    continue

                # Save to DB
                async with AsyncSessionLocal() as db:
                    msg = Message(
                        content=content,
                        sender_id=current_user.id,
                        receiver_id=receiver_id,
                        room_id=room_id,
                        message_type=MessageType.IMAGE if content.startswith("/static/") or payload.get("message_type") == "image" else MessageType.TEXT,
                        timestamp=datetime.utcnow(),
                        is_read=False
                    )
                    db.add(msg)
                    await db.commit()
                    await db.refresh(msg)
                    
                    # Construct event for recipient
                    receive_event = WSEvent(
                        event="message.receive",
                        data={
                            "id": msg.id,
                            "content": msg.content,
                            "sender_id": msg.sender_id,
                            "receiver_id": msg.receiver_id,
                            "room_id": msg.room_id,
                            "message_type": msg.message_type.value, # Pass type to client
                            "timestamp": msg.timestamp.isoformat()
                        }
                    )
                    
                    # Send to receiver or room
                    if receiver_id:
                        # Publish to Redis for cross-instance delivery
                        await manager.broadcast(receive_event)
                        
                        # Send Ack to Sender
                        ack_event = WSEvent(
                            event="message.ack",
                            data={
                                "message_id": msg.id,
                                "status": "sent",
                                "timestamp": msg.timestamp.isoformat()
                            }
                        )
                        await websocket.send_text(ack_event.model_dump_json())
                        
                    elif room_id:
                        # Fetch room members to ensure privacy
                        stmt = select(ChatRoom).where(ChatRoom.id == room_id).options(selectinload(ChatRoom.members))
                        result = await db.execute(stmt)
                        room = result.scalar_one_or_none()
                        
                        if room:
                            receive_event.recipient_ids = [m.id for m in room.members]
                            await manager.broadcast(receive_event)

            elif event.event == "message.delivered":
                message_id = event.data.get("message_id")
                sender_id = event.data.get("sender_id")
                
                if message_id:
                    async with AsyncSessionLocal() as db:
                        stmt = (
                            update(Message)
                            .where(Message.id == message_id)
                            .values(status="delivered")
                        )
                        await db.execute(stmt)
                        await db.commit()
                    
                    if sender_id:
                        delivery_receipt = WSEvent(
                            event="message.delivery_receipt",
                            data={
                                "message_id": message_id,
                                "receiver_id": sender_id,
                                "timestamp": datetime.utcnow().isoformat()
                            }
                        )
                        await manager.broadcast(delivery_receipt)

            elif event.event == "message.read":
                message_id = event.data.get("message_id")
                sender_id = event.data.get("sender_id")
                
                if message_id:
                    # Update DB
                    async with AsyncSessionLocal() as db:
                        stmt = (
                            update(Message)
                            .where(Message.id == message_id)
                            .values(is_read=True, status="read")
                        )
                        await db.execute(stmt)
                        await db.commit()
                    
                    # Notify original sender that message was read
                    if sender_id:
                        read_receipt = WSEvent(
                            event="message.read_receipt",
                            data={
                                "message_id": message_id,
                                "reader_id": current_user.id,
                                "receiver_id": sender_id, # Targeted to original sender
                                "timestamp": datetime.utcnow().isoformat()
                            }
                        )
                        # Broadcast to find the sender
                        await manager.broadcast(read_receipt)

            elif event.event == "typing.start":
                receiver_id = event.data.get("receiver_id")
                if receiver_id:
                     typing_event = WSEvent(
                         event="typing.start",
                         data={"sender_id": current_user.id, "receiver_id": receiver_id}
                     )
                     await manager.broadcast(typing_event)

            elif event.event == "typing.stop":
                receiver_id = event.data.get("receiver_id")
                if receiver_id:
                     typing_event = WSEvent(
                         event="typing.stop",
                         data={"sender_id": current_user.id, "receiver_id": receiver_id}
                     )
                     await manager.broadcast(typing_event)

            elif event.event.startswith("call."):
                payload = event.data if isinstance(event.data, dict) else None
                if not payload:
                    await websocket.send_json({"event": "call.error", "data": {"message": "Invalid call payload", "context_event": event.event}})
                    continue

                async with AsyncSessionLocal() as db:
                    if event.event == "call.invite":
                        target_user_id = payload.get("to_user_id") or payload.get("receiver_id") or payload.get("peer_user_id")
                        if not target_user_id:
                            await websocket.send_json({"event": "call.error", "data": {"message": "Missing call recipient", "context_event": event.event}})
                            continue

                        now = datetime.utcnow()
                        recent = [t for t in invite_timestamps if (now - t).total_seconds() < 30]
                        recent.append(now)
                        invite_timestamps = deque(recent)
                        if len(invite_timestamps) > 3:
                            await websocket.send_json({"event": "call.error", "data": {"message": "Too many call invites", "context_event": event.event}})
                            continue

                        room_id = payload.get("room_id")
                        allowed = await can_initiate_call(db, current_user.id, target_user_id, room_id)
                        if not allowed:
                            await websocket.send_json({"event": "call.error", "data": {"message": "Not allowed to call this user", "context_event": event.event}})
                            continue

                        call_id = payload.get("call_id") or str(uuid4())
                        existing_call = await db.get(CallSession, call_id)
                        if existing_call is not None:
                            await websocket.send_json({"event": "call.error", "data": {"message": "Call already exists", "context_event": event.event, "call_id": call_id}})
                            continue

                        call = CallSession(
                            call_id=call_id,
                            room_id=room_id,
                            caller_id=current_user.id,
                            callee_id=target_user_id,
                            status="ringing",
                        )
                        db.add(call)
                        await db.commit()

                        recipient_ids = [target_user_id]
                        outgoing_payload = {**payload, "call_id": call_id}
                    else:
                        call_id = payload.get("call_id")
                        if not call_id:
                            await websocket.send_json({"event": "call.error", "data": {"message": "Missing call_id", "context_event": event.event}})
                            continue

                        call = await db.get(CallSession, call_id)
                        if call is None:
                            await websocket.send_json({"event": "call.error", "data": {"message": "Unknown call", "context_event": event.event, "call_id": call_id}})
                            continue

                        if current_user.id not in {call.caller_id, call.callee_id}:
                            await websocket.send_json({"event": "call.error", "data": {"message": "Not authorized for this call", "context_event": event.event, "call_id": call_id}})
                            continue

                        other_user_id = call.callee_id if current_user.id == call.caller_id else call.caller_id
                        recipient_ids = [other_user_id]
                        outgoing_payload = payload

                        if event.event == "call.accept":
                            call.status = "active"
                            call.started_at = datetime.utcnow()
                            await db.commit()
                        elif event.event in {"call.reject", "call.hangup", "call.busy"}:
                            call.status = "rejected" if event.event == "call.reject" else ("busy" if event.event == "call.busy" else "ended")
                            call.ended_at = datetime.utcnow()
                            await db.commit()

                outgoing_event = WSEvent(
                    event=event.event,
                    data={**outgoing_payload, "from_user_id": current_user.id},
                    recipient_ids=recipient_ids,
                )
                await manager.broadcast(outgoing_event)

    except WebSocketDisconnect:
        await manager.disconnect(current_user.id)
    except Exception as e:
        logger.exception("Unhandled websocket error")
        await manager.disconnect(current_user.id)
