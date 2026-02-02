import time
from datetime import datetime

import pytest

from app.models.chat import ChatRoom, ChatRoomMember
from app.models.message import Message, MessageType
from app.models.user import User
from app.services.calls import can_initiate_call


@pytest.mark.anyio
async def test_can_initiate_call_requires_prior_dm(db_session):
    u1 = User(email=f"a_{time.time()}@example.com", hashed_password="x", full_name="A")
    u2 = User(email=f"b_{time.time()}@example.com", hashed_password="x", full_name="B")
    db_session.add_all([u1, u2])
    await db_session.commit()
    await db_session.refresh(u1)
    await db_session.refresh(u2)

    assert await can_initiate_call(db_session, u1.id, u2.id, None) is False

    msg = Message(
        content="hi",
        sender_id=u1.id,
        receiver_id=u2.id,
        message_type=MessageType.TEXT,
        timestamp=datetime.utcnow(),
        is_read=False,
    )
    db_session.add(msg)
    await db_session.commit()

    assert await can_initiate_call(db_session, u1.id, u2.id, None) is True


@pytest.mark.anyio
async def test_can_initiate_call_requires_room_membership(db_session):
    u1 = User(email=f"r1_{time.time()}@example.com", hashed_password="x", full_name="R1")
    u2 = User(email=f"r2_{time.time()}@example.com", hashed_password="x", full_name="R2")
    u3 = User(email=f"r3_{time.time()}@example.com", hashed_password="x", full_name="R3")
    room = ChatRoom(name="Room", is_group=True)
    db_session.add_all([u1, u2, u3, room])
    await db_session.flush()
    db_session.add_all([
        ChatRoomMember(chatroom_id=room.id, user_id=u1.id),
        ChatRoomMember(chatroom_id=room.id, user_id=u2.id),
    ])
    await db_session.commit()
    await db_session.refresh(u1)
    await db_session.refresh(u2)
    await db_session.refresh(u3)
    await db_session.refresh(room)

    assert await can_initiate_call(db_session, u1.id, u2.id, room.id) is True
    assert await can_initiate_call(db_session, u1.id, u3.id, room.id) is False

