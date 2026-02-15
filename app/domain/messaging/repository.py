"""
MessageRepository — all Message DB queries in one place.
Routes and services call these methods; they never write raw SQL outside this file.
"""
from __future__ import annotations
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, update, delete
from app.models.message import Message, MessageType
from app.models.chat import ChatRoomMember


class MessageRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    async def get_by_id(self, message_id: int) -> Optional[Message]:
        return await self.db.get(Message, message_id)

    async def get_dm_history(
        self,
        user_a: int,
        user_b: int,
        before_id: Optional[int] = None,
        limit: int = 50,
    ) -> list[Message]:
        """Cursor-based DM history. Returns oldest-first within the page."""
        q = select(Message).where(
            or_(
                and_(Message.sender_id == user_a, Message.receiver_id == user_b),
                and_(Message.sender_id == user_b, Message.receiver_id == user_a),
            )
        )
        if before_id is not None:
            q = q.where(Message.id < before_id)
        q = q.order_by(Message.id.desc()).limit(limit)
        rows = (await self.db.execute(q)).scalars().all()
        return list(reversed(rows))

    async def get_room_history(
        self,
        room_id: int,
        before_id: Optional[int] = None,
        limit: int = 50,
    ) -> list[Message]:
        """Cursor-based room history. Returns oldest-first within the page."""
        q = select(Message).where(Message.room_id == room_id)
        if before_id is not None:
            q = q.where(Message.id < before_id)
        q = q.order_by(Message.id.desc()).limit(limit)
        rows = (await self.db.execute(q)).scalars().all()
        return list(reversed(rows))

    async def get_room_member_ids(self, room_id: int) -> list[int]:
        stmt = select(ChatRoomMember.user_id).where(ChatRoomMember.chatroom_id == room_id)
        return [r[0] for r in (await self.db.execute(stmt)).all()]

    async def is_room_member(self, room_id: int, user_id: int) -> bool:
        stmt = select(ChatRoomMember).where(
            and_(ChatRoomMember.chatroom_id == room_id, ChatRoomMember.user_id == user_id)
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        return row is not None

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    async def create(
        self,
        sender_id: int,
        content: str,
        receiver_id: Optional[int] = None,
        room_id: Optional[int] = None,
        message_type: MessageType = MessageType.TEXT,
        reply_to_id: Optional[int] = None,
        expires_at=None,
    ) -> Message:
        from datetime import datetime
        msg = Message(
            content=content,
            sender_id=sender_id,
            receiver_id=receiver_id,
            room_id=room_id,
            message_type=message_type,
            timestamp=datetime.utcnow(),
            is_read=False,
            reactions={},
            expires_at=expires_at,
        )
        self.db.add(msg)
        await self.db.commit()
        await self.db.refresh(msg)
        return msg

    async def update_content(self, message_id: int, content: str) -> Optional[Message]:
        from datetime import datetime
        stmt = (
            update(Message)
            .where(Message.id == message_id)
            .values(content=content)
            .returning(Message)
        )
        result = await self.db.execute(stmt)
        await self.db.commit()
        return result.scalar_one_or_none()

    async def update_reactions(self, message_id: int, reactions: dict) -> None:
        stmt = update(Message).where(Message.id == message_id).values(reactions=reactions)
        await self.db.execute(stmt)
        await self.db.commit()

    async def update_status(self, message_id: int, status: str, is_read: bool = False) -> None:
        values: dict = {"status": status}
        if is_read:
            values["is_read"] = True
        stmt = update(Message).where(Message.id == message_id).values(**values)
        await self.db.execute(stmt)
        await self.db.commit()

    async def delete(self, message_id: int) -> None:
        stmt = delete(Message).where(Message.id == message_id)
        await self.db.execute(stmt)
        await self.db.commit()
