# FastSock - Real-time Chat Backend

A production-ready real-time chatting backend using FastAPI, WebSockets, Redis Pub/Sub, and PostgreSQL.

## Architecture

- **FastAPI**: Async web framework.
- **WebSockets**: Real-time bidirectional communication.
- **Redis Pub/Sub**: Horizontal scaling mechanism. Messages are published to Redis and consumed by all server instances to deliver to connected clients.
- **PostgreSQL**: Persistent storage for users, rooms, and messages.
- **SQLAlchemy (Async)**: ORM for database interactions.
- **Alembic**: Database migrations.
- **Docker**: Containerization.

## Features

- **JWT Authentication**: Secure login and WebSocket connection validation.
- **Real-time Messaging**: Instant delivery via WebSockets.
- **Group Chats**: Room-based messaging.
- **Message History**: Persistent storage of all messages.
- **Presence**: Online/Offline status tracking (basic implementation).
- **Scalable**: Designed to run multiple instances behind a load balancer.

## Project Structure

```
/app
  /api          # HTTP and WebSocket routes
  /core         # Config and Security
  /db           # Database session and base
  /models       # SQL models
  /schemas      # Pydantic schemas
  /services     # Business logic
  /ws           # WebSocket Connection Manager
  main.py       # Entry point
```

## How to Run

### 1. Start Infrastructure (Docker)

```bash
docker-compose up -d
```
This starts PostgreSQL and Redis.

### 1a. Start Infrastructure (Manual / No Docker)

If you don't have Docker, you can run in **Standalone Mode** (SQLite + InMemory PubSub).

1.  **Dependencies**: Just install the python requirements.
2.  **Configuration**: The `.env` file is already pre-configured to use SQLite (`fastsock.db`) and disable Redis.
3.  **Note**: In this mode, horizontal scaling (multiple uvicorn instances) will not work for chat. It works for a single instance development.

### 2. Run Application (Local)

Create virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Run migrations:
```bash
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

Start the server:
```bash
uvicorn app.main:app --reload
```

### 3. API Documentation

Open http://localhost:8000/docs to see the Swagger UI.

## WebSocket Protocol

**Endpoint**: `ws://localhost:8000/api/v1/ws/chat?token={access_token}`

**Client -> Server**:
```json
{
  "event": "message.send",
  "data": {
    "content": "Hello World",
    "receiver_id": 2,  // For 1-on-1
    "room_id": null    // For group
  }
}
```

**Server -> Client**:
```json
{
  "event": "message.receive",
  "data": {
    "id": 1,
    "content": "Hello World",
    "sender_id": 1,
    "timestamp": "2023-10-27T10:00:00"
  }
}
```

## Video Calling (WebRTC)

FastSock supports 1:1 WebRTC video calling using the existing authenticated WebSocket as the signaling channel.

### ICE Servers

Frontend fetches ICE server configuration from:

`GET /api/v1/webrtc/ice-servers` (requires Bearer token)

Configure servers via `.env`:

`WEBRTC_ICE_SERVERS_JSON=[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:your-turn-host:3478"],"username":"user","credential":"pass"}]`

### Signaling Events (WebSocket)

All call events use `event` names prefixed with `call.` and JSON payloads under `data`:

- `call.invite` `{ call_id, to_user_id, room_id?, sdp_offer }`
- `call.accept` `{ call_id, to_user_id, sdp_answer }`
- `call.ice` `{ call_id, to_user_id, candidate }`
- `call.reject` / `call.hangup` / `call.busy` `{ call_id, to_user_id }`

### Manual Test Checklist

- Same browser profile (two users) in two windows: invite → accept → hangup
- Different networks (Wi-Fi vs hotspot): verify media connects; add TURN if it fails
- Permission denied (camera/mic blocked): ensure UI fails gracefully
- Busy handling: start a call, then receive a second invite
- Refresh during ringing and during an active call: ensure cleanup and hangup works

### Scaling to Group Calls (SFU Path)

1:1 calls can work peer-to-peer, but group calls typically need an SFU to avoid N² bandwidth.

- Keep FastSock WebSocket for call control (join/leave/mute/raise-hand) and authentication.
- Use an SFU (e.g., LiveKit, Janus, mediasoup) for media routing.
- Replace `call.invite/accept/ice` peer signaling with “create room” + “join token” flows handled by the SFU.

## Testing

Run the test suite (requires `pytest`):

```bash
pytest
```

## Client

A simple HTML client is provided in `simple_client.html`.
1. Open `simple_client.html` in your browser.
2. Sign up / Login.
3. Connect and start chatting!
