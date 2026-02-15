"""
Comprehensive test suite for FastSock backend.
Covers: auth, chat CRUD, message search, profile update, uploads, call history.
"""
import time
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def signup_and_login(client: AsyncClient, prefix: str):
    """Create a user and return (user_id, token, headers)."""
    email = f"{prefix}_{time.time()}@example.com"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "securepassword", "full_name": prefix.title()},
    )
    assert signup_res.status_code == 200
    user_id = signup_res.json()["id"]

    login_res = await client.post(
        "/api/v1/auth/login/access-token",
        data={"username": email, "password": "securepassword"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return user_id, token, headers


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_signup_returns_user(client: AsyncClient):
    email = f"signup_{time.time()}@example.com"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "pw123456", "full_name": "Signup Test"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == email
    assert data["full_name"] == "Signup Test"
    assert "id" in data
    # Password hash must not be returned
    assert "hashed_password" not in data


@pytest.mark.anyio
async def test_signup_duplicate_email_fails(client: AsyncClient):
    email = f"dup_{time.time()}@example.com"
    await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "pw", "full_name": "Dup"},
    )
    res2 = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "pw", "full_name": "Dup2"},
    )
    assert res2.status_code == 400


@pytest.mark.anyio
async def test_login_wrong_password(client: AsyncClient):
    email = f"wrongpw_{time.time()}@example.com"
    await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "correct", "full_name": "WP"},
    )
    res = await client.post(
        "/api/v1/auth/login/access-token",
        data={"username": email, "password": "wrong"},
    )
    assert res.status_code == 400


@pytest.mark.anyio
async def test_protected_endpoint_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/users/me")
    assert res.status_code in {401, 403}


@pytest.mark.anyio
async def test_get_me_returns_current_user(client: AsyncClient):
    user_id, _, headers = await signup_and_login(client, "getme")
    res = await client.get("/api/v1/users/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == user_id


# ---------------------------------------------------------------------------
# Profile update tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_update_profile_display_name(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "profile")
    res = await client.put(
        "/api/v1/users/me",
        json={"display_name": "Cool Name", "status_message": "Available"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["display_name"] == "Cool Name"
    assert data["status_message"] == "Available"


@pytest.mark.anyio
async def test_update_profile_partial(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "partial_profile")
    # Only update status_message
    res = await client.put(
        "/api/v1/users/me",
        json={"status_message": "Busy"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["status_message"] == "Busy"


# ---------------------------------------------------------------------------
# Chat CRUD tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_create_room_and_list(client: AsyncClient):
    _, _, h1 = await signup_and_login(client, "room_owner")
    u2_id, _, _ = await signup_and_login(client, "room_member")

    # Create room
    res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Test Room", "member_ids": [u2_id]},
        headers=h1,
    )
    assert res.status_code == 200
    room_id = res.json()["id"]
    assert res.json()["name"] == "Test Room"

    # List rooms
    list_res = await client.get("/api/v1/chat/rooms", headers=h1)
    assert list_res.status_code == 200
    assert any(r["id"] == room_id for r in list_res.json())


@pytest.mark.anyio
async def test_room_history_forbidden_for_non_member(client: AsyncClient):
    _, _, h1 = await signup_and_login(client, "hist_owner")
    u2_id, _, _ = await signup_and_login(client, "hist_member")
    _, _, h3 = await signup_and_login(client, "hist_outsider")

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Locked Room", "member_ids": [u2_id]},
        headers=h1,
    )
    room_id = room_res.json()["id"]

    # Outsider should be forbidden
    res = await client.get(f"/api/v1/chat/history/room/{room_id}", headers=h3)
    assert res.status_code == 403

    # Owner should succeed
    res = await client.get(f"/api/v1/chat/history/room/{room_id}", headers=h1)
    assert res.status_code == 200


@pytest.mark.anyio
async def test_unread_counts_endpoint(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "unread_user")
    res = await client.get("/api/v1/chat/unread", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "users" in data
    assert "rooms" in data


@pytest.mark.anyio
async def test_mark_room_read_forbidden_for_non_member(client: AsyncClient):
    _, _, h1 = await signup_and_login(client, "mark_owner")
    u2_id, _, _ = await signup_and_login(client, "mark_member")
    _, _, h3 = await signup_and_login(client, "mark_outsider")

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Read Room", "member_ids": [u2_id]},
        headers=h1,
    )
    room_id = room_res.json()["id"]

    # Outsider forbidden
    res = await client.post(f"/api/v1/chat/rooms/{room_id}/read", headers=h3)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Message edit/delete tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_message_update_and_delete(client: AsyncClient, db_session):
    u1_id, _, h1 = await signup_and_login(client, "msg_owner")
    u2_id, _, _ = await signup_and_login(client, "msg_peer")

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Edit Room", "member_ids": [u2_id]},
        headers=h1,
    )
    room_id = room_res.json()["id"]

    # Create message directly in DB
    from app.models.message import Message
    msg = Message(content="original", sender_id=u1_id, room_id=room_id, is_read=False)
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    # Update
    res = await client.put(
        f"/api/v1/chat/messages/{msg.id}",
        json={"content": "edited"},
        headers=h1,
    )
    assert res.status_code == 200
    assert res.json()["content"] == "edited"

    # Delete
    res = await client.delete(f"/api/v1/chat/messages/{msg.id}", headers=h1)
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Message search tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_message_search(client: AsyncClient, db_session):
    u1_id, _, h1 = await signup_and_login(client, "search_user")
    u2_id, _, _ = await signup_and_login(client, "search_peer")

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Search Room", "member_ids": [u2_id]},
        headers=h1,
    )
    room_id = room_res.json()["id"]

    # Insert test messages
    from app.models.message import Message
    for text in ["Hello world", "foo bar baz", "Hello again"]:
        db_session.add(Message(content=text, sender_id=u1_id, room_id=room_id, is_read=False))
    await db_session.commit()

    # Search for "Hello"
    res = await client.get("/api/v1/chat/search?q=Hello", headers=h1)
    assert res.status_code == 200
    results = res.json()
    assert len(results) >= 2
    assert all("Hello" in m["content"] for m in results)

    # Search with no results
    res2 = await client.get("/api/v1/chat/search?q=zzzznothing", headers=h1)
    assert res2.status_code == 200
    assert res2.json() == []


@pytest.mark.anyio
async def test_message_search_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/chat/search?q=test")
    assert res.status_code in {401, 403}


# ---------------------------------------------------------------------------
# Upload tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_upload_requires_auth(client: AsyncClient):
    res = await client.post(
        "/api/v1/utils/upload",
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert res.status_code in {401, 403}


@pytest.mark.anyio
async def test_upload_accepts_valid_image(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "uploader2")
    res = await client.post(
        "/api/v1/utils/upload",
        headers=headers,
        files={"file": ("test.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["content_type"] == "image/png"
    assert data["url"].startswith("/static/uploads/")


# ---------------------------------------------------------------------------
# ICE servers tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_ice_servers_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/webrtc/ice-servers")
    assert res.status_code in {401, 403}


@pytest.mark.anyio
async def test_ice_servers_returns_list(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "ice_user")
    res = await client.get("/api/v1/webrtc/ice-servers", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "ice_servers" in data
    assert isinstance(data["ice_servers"], list)
    assert len(data["ice_servers"]) > 0


# ---------------------------------------------------------------------------
# Call history tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_call_history_empty(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "callhist")
    res = await client.get("/api/v1/calls/history", headers=headers)
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.anyio
async def test_call_history_returns_calls(client: AsyncClient, db_session):
    u1_id, _, h1 = await signup_and_login(client, "caller")
    u2_id, _, _ = await signup_and_login(client, "callee")

    from app.models.call import CallSession
    call = CallSession(
        call_id="test-call-123",
        caller_id=u1_id,
        callee_id=u2_id,
        status="ended",
    )
    db_session.add(call)
    await db_session.commit()

    res = await client.get("/api/v1/calls/history", headers=h1)
    assert res.status_code == 200
    calls = res.json()
    assert len(calls) >= 1
    assert any(c["call_id"] == "test-call-123" for c in calls)


@pytest.mark.anyio
async def test_call_history_filter_by_peer(client: AsyncClient, db_session):
    u1_id, _, h1 = await signup_and_login(client, "filterc1")
    u2_id, _, _ = await signup_and_login(client, "filterc2")
    u3_id, _, _ = await signup_and_login(client, "filterc3")

    from app.models.call import CallSession
    db_session.add(CallSession(call_id="fc-1", caller_id=u1_id, callee_id=u2_id, status="ended"))
    db_session.add(CallSession(call_id="fc-2", caller_id=u1_id, callee_id=u3_id, status="ended"))
    await db_session.commit()

    # Filter by u2 - should get 1 call
    res = await client.get(f"/api/v1/calls/history?peer_user_id={u2_id}", headers=h1)
    assert res.status_code == 200
    calls = res.json()
    assert all(
        c["caller_id"] in {u1_id, u2_id} and c["callee_id"] in {u1_id, u2_id}
        for c in calls
    )


@pytest.mark.anyio
async def test_call_history_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/calls/history")
    assert res.status_code in {401, 403}


# ---------------------------------------------------------------------------
# Health check tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_health_check(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in {"healthy", "degraded"}
    assert "checks" in data
    assert data["checks"]["backend"] == "ok"
    assert data["checks"]["database"] == "ok"


# ---------------------------------------------------------------------------
# Reactions tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_reactions_toggle(client: AsyncClient, db_session):
    u1_id, _, h1 = await signup_and_login(client, "react_a")
    u2_id, _, h2 = await signup_and_login(client, "react_b")

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "React Room", "member_ids": [u2_id]},
        headers=h1,
    )
    room_id = room_res.json()["id"]

    from app.models.message import Message
    msg = Message(content="react to me", sender_id=u1_id, room_id=room_id, is_read=False)
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    # Add reaction
    res = await client.post(
        f"/api/v1/chat/messages/{msg.id}/reactions",
        json={"emoji": "🔥"},
        headers=h2,
    )
    assert res.status_code == 200
    assert "🔥" in res.json()["reactions"]

    # Toggle (remove) reaction
    res2 = await client.post(
        f"/api/v1/chat/messages/{msg.id}/reactions",
        json={"emoji": "🔥"},
        headers=h2,
    )
    assert res2.status_code == 200
    assert "🔥" not in res2.json()["reactions"]


# ---------------------------------------------------------------------------
# Users list tests  
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_list_users(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "listuser")
    res = await client.get("/api/v1/users/", headers=headers)
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    assert len(users) >= 1


# ---------------------------------------------------------------------------
# Presence status tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_update_presence_status(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "presence_user")
    # Set to DND
    res = await client.put(
        "/api/v1/users/me",
        json={"presence_status": "dnd"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["presence_status"] == "dnd"

    # Set to busy
    res2 = await client.put(
        "/api/v1/users/me",
        json={"presence_status": "busy"},
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.json()["presence_status"] == "busy"


@pytest.mark.anyio
async def test_invalid_presence_status_ignored(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "presence_invalid")
    # Set valid first
    await client.put(
        "/api/v1/users/me",
        json={"presence_status": "available"},
        headers=headers,
    )
    # Try invalid — should be silently ignored (stays available)
    res = await client.put(
        "/api/v1/users/me",
        json={"presence_status": "invisible"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["presence_status"] == "available"


# ---------------------------------------------------------------------------
# Message pinning tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_pin_and_unpin_message(client: AsyncClient, db_session):
    u1_id, _, h1 = await signup_and_login(client, "pin_owner")
    u2_id, _, _ = await signup_and_login(client, "pin_member")

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Pin Room", "member_ids": [u2_id]},
        headers=h1,
    )
    room_id = room_res.json()["id"]

    from app.models.message import Message
    msg = Message(content="pin me!", sender_id=u1_id, room_id=room_id, is_read=False)
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    # Pin
    res = await client.post(f"/api/v1/chat/messages/{msg.id}/pin", headers=h1)
    assert res.status_code == 200
    assert res.json()["message_id"] == msg.id

    # List pins
    scope = f"room:{room_id}"
    list_res = await client.get(f"/api/v1/chat/pins/{scope}", headers=h1)
    assert list_res.status_code == 200
    assert any(p["message_id"] == msg.id for p in list_res.json())

    # Duplicate pin should fail
    res2 = await client.post(f"/api/v1/chat/messages/{msg.id}/pin", headers=h1)
    assert res2.status_code == 409

    # Unpin
    res3 = await client.delete(f"/api/v1/chat/messages/{msg.id}/pin", headers=h1)
    assert res3.status_code == 200


@pytest.mark.anyio
async def test_pin_nonexistent_message(client: AsyncClient):
    _, _, headers = await signup_and_login(client, "pin_ghost")
    res = await client.post("/api/v1/chat/messages/999999/pin", headers=headers)
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Bookmark tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_bookmark_toggle(client: AsyncClient, db_session):
    u1_id, _, h1 = await signup_and_login(client, "bm_user")
    u2_id, _, _ = await signup_and_login(client, "bm_peer")

    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Bookmark Room", "member_ids": [u2_id]},
        headers=h1,
    )
    room_id = room_res.json()["id"]

    from app.models.message import Message
    msg = Message(content="save me!", sender_id=u1_id, room_id=room_id, is_read=False)
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)

    # Bookmark (add)
    res = await client.post(
        f"/api/v1/chat/messages/{msg.id}/bookmark",
        json={"note": "Important"},
        headers=h1,
    )
    assert res.status_code == 200
    assert res.json()["message_id"] == msg.id

    # List bookmarks
    list_res = await client.get("/api/v1/chat/bookmarks", headers=h1)
    assert list_res.status_code == 200
    assert any(b["message_id"] == msg.id for b in list_res.json())

    # Bookmark toggle (remove)
    res2 = await client.post(
        f"/api/v1/chat/messages/{msg.id}/bookmark",
        json={},
        headers=h1,
    )
    assert res2.status_code == 200
    assert res2.json()["id"] == 0  # signals removal

    # Should no longer appear in bookmarks
    list_res2 = await client.get("/api/v1/chat/bookmarks", headers=h1)
    assert not any(b["message_id"] == msg.id for b in list_res2.json())
