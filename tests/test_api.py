import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.anyio
async def test_root(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to FastSock Real-time Chat API"}

@pytest.mark.anyio
async def test_create_user(client: AsyncClient):
    # Use unique email to avoid conflict
    import time
    email = f"test_{time.time()}@example.com"
    
    response = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "full_name": "Test User"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert "id" in data

@pytest.mark.anyio
async def test_login(client: AsyncClient):
    import time
    email = f"login_{time.time()}@example.com"
    
    # Create user first
    await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "full_name": "Login User"}
    )
    
    # Login
    response = await client.post(
        "/api/v1/auth/login/access-token",
        data={"username": email, "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.anyio
async def test_chat_rooms(client: AsyncClient):
    # 1. Login
    import time
    email = f"chat_{time.time()}@example.com"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": "pw", "full_name": "Chat User"})
    login_res = await client.post("/api/v1/auth/login/access-token", data={"username": email, "password": "pw"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create Room
    # Create another user to add
    email2 = f"member_{time.time()}@example.com"
    res2 = await client.post("/api/v1/auth/signup", json={"email": email2, "password": "pw", "full_name": "Member"})
    user2_id = res2.json()["id"]
    
    room_res = await client.post(
        "/api/v1/chat/rooms",
        json={"name": "Test Room", "member_ids": [user2_id]},
        headers=headers
    )
    assert room_res.status_code == 200
    room_data = room_res.json()
    assert room_data["name"] == "Test Room"
    
    # 3. List Rooms
    list_res = await client.get("/api/v1/chat/rooms", headers=headers)
    assert list_res.status_code == 200
    rooms = list_res.json()
    assert len(rooms) >= 1
    assert any(r["id"] == room_data["id"] for r in rooms)


@pytest.mark.anyio
async def test_webrtc_ice_servers_requires_auth(client: AsyncClient):
    import time
    email = f"webrtc_{time.time()}@example.com"
    await client.post("/api/v1/auth/signup", json={"email": email, "password": "pw", "full_name": "WebRTC User"})
    login_res = await client.post("/api/v1/auth/login/access-token", data={"username": email, "password": "pw"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/v1/webrtc/ice-servers", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "ice_servers" in data
    assert isinstance(data["ice_servers"], list)
