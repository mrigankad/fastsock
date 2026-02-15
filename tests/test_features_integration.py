import time
import pytest
from httpx import AsyncClient


async def signup_and_login(client: AsyncClient, email_prefix: str):
    email = f"{email_prefix}_{time.time()}@example.com"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "pw", "full_name": email_prefix},
    )
    assert signup_res.status_code == 200
    user_id = signup_res.json()["id"]

    login_res = await client.post(
        "/api/v1/auth/login/access-token",
        data={"username": email, "password": "pw"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return user_id, token


@pytest.mark.anyio
async def test_room_history_requires_membership(client: AsyncClient):
    owner_id, owner_token = await signup_and_login(client, "owner")
    member_id, _member_token = await signup_and_login(client, "member")
    outsider_id, outsider_token = await signup_and_login(client, "outsider")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Private Room", "member_ids": [member_id]},
        headers=owner_headers,
    )
    assert room_res.status_code == 200
    room_id = room_res.json()["id"]

    history_res = await client.get(
        f"/api/v1/chat/history/room/{room_id}",
        headers=outsider_headers,
    )
    assert history_res.status_code == 403


@pytest.mark.anyio
async def test_mark_room_read_requires_membership(client: AsyncClient):
    owner_id, owner_token = await signup_and_login(client, "owner2")
    member_id, _member_token = await signup_and_login(client, "member2")
    outsider_id, outsider_token = await signup_and_login(client, "outsider2")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Read Room", "member_ids": [member_id]},
        headers=owner_headers,
    )
    assert room_res.status_code == 200
    room_id = room_res.json()["id"]

    res = await client.post(
        f"/api/v1/chat/rooms/{room_id}/read",
        headers=outsider_headers,
    )
    assert res.status_code == 403


@pytest.mark.anyio
async def test_upload_requires_auth_and_accepts_image(client: AsyncClient):
    res = await client.post(
        "/api/v1/utils/upload",
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert res.status_code in {401, 403}

    _user_id, token = await signup_and_login(client, "uploader")
    headers = {"Authorization": f"Bearer {token}"}

    ok = await client.post(
        "/api/v1/utils/upload",
        headers=headers,
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert ok.status_code == 200
    data = ok.json()
    assert data["content_type"] == "image/png"
    assert data["url"].startswith("/static/uploads/")


@pytest.mark.anyio
async def test_message_reactions_persist_and_broadcast(client: AsyncClient, db_session):
    user1_id, token1 = await signup_and_login(client, "react1")
    user2_id, token2 = await signup_and_login(client, "react2")

    headers1 = {"Authorization": f"Bearer {token1}"}
    headers2 = {"Authorization": f"Bearer {token2}"}

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Reactions Room", "member_ids": [user2_id]},
        headers=headers1,
    )
    assert room_res.status_code == 200
    room_id = room_res.json()["id"]

    history = await client.get(f"/api/v1/chat/history/room/{room_id}", headers=headers1)
    assert history.status_code == 200
    assert history.json() == []

    from app.models.message import Message
    msg = Message(content="hello", sender_id=user1_id, room_id=room_id, is_read=False)
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)
    message_id = msg.id

    toggle = await client.post(
        f"/api/v1/chat/messages/{message_id}/reactions",
        json={"emoji": "👍"},
        headers=headers2,
    )
    assert toggle.status_code == 200
    data = toggle.json()
    assert data["message_id"] == message_id
    assert "👍" in data["reactions"]

    history2 = await client.get(f"/api/v1/chat/history/room/{room_id}", headers=headers1)
    assert history2.status_code == 200
    msgs = history2.json()
    assert len(msgs) == 1
    assert msgs[0]["reactions"]["👍"] == [str(user2_id)]
