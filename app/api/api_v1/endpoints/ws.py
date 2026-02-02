from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from sqlalchemy.orm import selectinload
from app.api import deps
from app.ws.manager import manager
from app.schemas.ws_events import WSEvent, WSMessagePayload
from app.models.message import Message, MessageType
from app.models.chat import ChatRoom, ChatRoomMember
from app.db.session import AsyncSessionLocal
import json
from datetime import datetime

router = APIRouter()

@router.websocket("/chat")
async def websocket_endpoint(
    websocket: WebSocket,
    current_user = Depends(deps.get_current_user_ws),
):
    if not current_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, current_user.id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
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

    except WebSocketDisconnect:
        await manager.disconnect(current_user.id)
    except Exception as e:
        print(f"Error: {e}")
        await manager.disconnect(current_user.id)
