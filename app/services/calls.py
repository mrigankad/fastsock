from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.models.chat import ChatRoomMember
from app.models.message import Message


async def can_initiate_call(
    db: AsyncSession,
    caller_id: int,
    callee_id: int,
    room_id: int | None,
) -> bool:
    if room_id is not None:
        stmt = (
            select(ChatRoomMember.user_id)
            .where(
                and_(
                    ChatRoomMember.chatroom_id == room_id,
                    ChatRoomMember.user_id.in_([caller_id, callee_id]),
                )
            )
        )
        result = await db.execute(stmt)
        member_ids = {row[0] for row in result.all()}
        return caller_id in member_ids and callee_id in member_ids

    stmt = (
        select(Message.id)
        .where(
            or_(
                and_(Message.sender_id == caller_id, Message.receiver_id == callee_id),
                and_(Message.sender_id == callee_id, Message.receiver_id == caller_id),
            )
        )
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None
