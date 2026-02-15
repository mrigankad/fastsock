"""
MessageService — all messaging business logic.
Validates permissions, persists via repository, and broadcasts via manager.
"""
from __future__ import annotations
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import bleach

from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.domain.messaging.repository import MessageRepository
from app.models.message import Message, MessageType, DisappearingTimer
from app.models.notification import Notification
from app.schemas.ws_events import WSEvent
from app.ws.manager import ConnectionManager


class MessageService:
    def __init__(self, db: AsyncSession, manager: ConnectionManager) -> None:
        self.repo = MessageRepository(db)
        self.manager = manager

    # ------------------------------------------------------------------
    # Send
    # ------------------------------------------------------------------

    # Max plain-text length; strip all tags — messages are plain text, not HTML
    _MAX_MSG_LEN = 4000

    @staticmethod
    def _clean(content: str) -> str:
        return bleach.clean(content, tags=[], strip=True)[:MessageService._MAX_MSG_LEN]

    async def send(
        self,
        sender_id: int,
        content: str,
        receiver_id: Optional[int] = None,
        room_id: Optional[int] = None,
        message_type: MessageType = MessageType.TEXT,
        reply_to_id: Optional[int] = None,
    ) -> Message:
        content = self._clean(content)
        if not content:
            raise HTTPException(400, "Message content cannot be empty")
        if bool(receiver_id) == bool(room_id):
            raise HTTPException(400, "Provide exactly one of receiver_id or room_id")

        recipient_ids: Optional[list[int]] = None
        if room_id:
            recipient_ids = await self.repo.get_room_member_ids(room_id)
            if sender_id not in recipient_ids:
                raise HTTPException(403, "Not a member of this room")

        # Check if sender has an active disappearing timer for this conversation
        expires_at: Optional[datetime] = None
        target_type = "room" if room_id else "dm"
        target_id = room_id if room_id else receiver_id
        if target_id:
            timer_row = (
                await self.repo.db.execute(
                    select(DisappearingTimer).where(
                        DisappearingTimer.user_id == sender_id,
                        DisappearingTimer.target_type == target_type,
                        DisappearingTimer.target_id == target_id,
                        DisappearingTimer.duration_seconds > 0,
                    )
                )
            ).scalar_one_or_none()
            if timer_row:
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=timer_row.duration_seconds)

        msg = await self.repo.create(
            sender_id=sender_id,
            content=content,
            receiver_id=receiver_id,
            room_id=room_id,
            message_type=message_type,
            reply_to_id=reply_to_id,
            expires_at=expires_at,
        )

        # Create in-app notification for DMs (not rooms — rooms use @mention notifications)
        if receiver_id and receiver_id != sender_id:
            self.repo.db.add(Notification(
                user_id=receiver_id,
                type="dm",
                message_id=msg.id,
                from_user_id=sender_id,
            ))
            # Commit happens after broadcast via the session flush
            await self.repo.db.flush()

        receive_event = WSEvent(
            event="message.receive",
            data={
                "id": msg.id,
                "content": msg.content,
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
                "room_id": msg.room_id,
                "message_type": msg.message_type.value,
                "timestamp": msg.timestamp.isoformat(),
                "is_read": msg.is_read,
                "status": msg.status,
                "reactions": msg.reactions or {},
                "reply_to_id": reply_to_id,
            },
            recipient_ids=recipient_ids,
        )
        await self.manager.broadcast(receive_event)

        # Fire-and-forget link preview fetch (text messages only)
        if message_type == MessageType.TEXT and content:
            from app.workers.link_preview import enqueue as _enqueue_preview
            _enqueue_preview(msg.id, content, recipient_ids)

        # Real-time badge increment for DM receiver
        if receiver_id and receiver_id != sender_id:
            await self.manager.broadcast(WSEvent(
                event="notification.new",
                data={"type": "dm", "from_user_id": sender_id},
                recipient_ids=[receiver_id],
            ))

        return msg

    # ------------------------------------------------------------------
    # Edit
    # ------------------------------------------------------------------

    async def edit(self, message_id: int, requesting_user_id: int, content: str) -> Message:
        content = self._clean(content)
        if not content:
            raise HTTPException(400, "Message content cannot be empty")
        msg = await self.repo.get_by_id(message_id)
        if not msg:
            raise HTTPException(404, "Message not found")
        if msg.sender_id != requesting_user_id:
            raise HTTPException(403, "Not authorized to edit this message")

        updated = await self.repo.update_content(message_id, content)

        recipient_ids: Optional[list[int]] = None
        if msg.room_id:
            recipient_ids = await self.repo.get_room_member_ids(msg.room_id)

        await self.manager.broadcast(WSEvent(
            event="message.update",
            data={
                "id": message_id,
                "content": content,
                "room_id": msg.room_id,
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
            },
            recipient_ids=recipient_ids,
        ))
        return updated or msg

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete(self, message_id: int, requesting_user_id: int) -> None:
        msg = await self.repo.get_by_id(message_id)
        if not msg:
            raise HTTPException(404, "Message not found")
        if msg.sender_id != requesting_user_id:
            raise HTTPException(403, "Not authorized to delete this message")

        recipient_ids: Optional[list[int]] = None
        if msg.room_id:
            recipient_ids = await self.repo.get_room_member_ids(msg.room_id)

        delete_event = WSEvent(
            event="message.delete",
            data={
                "id": message_id,
                "room_id": msg.room_id,
                "sender_id": msg.sender_id,
                "receiver_id": msg.receiver_id,
            },
            recipient_ids=recipient_ids,
        )
        await self.repo.delete(message_id)
        await self.manager.broadcast(delete_event)

    # ------------------------------------------------------------------
    # React
    # ------------------------------------------------------------------

    async def toggle_reaction(
        self, message_id: int, user_id: int, emoji: str
    ) -> dict:
        if not emoji or len(emoji) > 16:
            raise HTTPException(400, "Invalid emoji")

        msg = await self.repo.get_by_id(message_id)
        if not msg:
            raise HTTPException(404, "Message not found")

        recipient_ids: Optional[list[int]] = None
        if msg.room_id:
            recipient_ids = await self.repo.get_room_member_ids(msg.room_id)
            if user_id not in recipient_ids:
                raise HTTPException(403, "Not a member of this room")
        else:
            if user_id not in {msg.sender_id, msg.receiver_id}:
                raise HTTPException(403, "Not authorized")
            recipient_ids = [msg.sender_id, msg.receiver_id]

        reactions = dict(msg.reactions or {})
        uid_str = str(user_id)
        users = reactions.get(emoji, [])
        if uid_str in users:
            reactions[emoji] = [u for u in users if u != uid_str]
        else:
            reactions[emoji] = [*users, uid_str]
        reactions = {k: v for k, v in reactions.items() if v}

        await self.repo.update_reactions(message_id, reactions)

        await self.manager.broadcast(WSEvent(
            event="message.reaction",
            data={"message_id": message_id, "reactions": reactions},
            recipient_ids=recipient_ids,
        ))
        return reactions

    # ------------------------------------------------------------------
    # Read receipt
    # ------------------------------------------------------------------

    async def mark_read(self, message_id: int, reader_id: int, sender_id: Optional[int]) -> None:
        await self.repo.update_status(message_id, "read", is_read=True)
        if sender_id:
            await self.manager.broadcast(WSEvent(
                event="message.read_receipt",
                data={
                    "message_id": message_id,
                    "reader_id": reader_id,
                    "receiver_id": sender_id,
                },
            ))

    async def mark_delivered(self, message_id: int, sender_id: Optional[int]) -> None:
        await self.repo.update_status(message_id, "delivered")
        if sender_id:
            from datetime import datetime
            await self.manager.broadcast(WSEvent(
                event="message.delivery_receipt",
                data={
                    "message_id": message_id,
                    "receiver_id": sender_id,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            ))
