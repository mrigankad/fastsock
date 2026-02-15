# FastSock — Architecture Document

**Target:** Production SaaS, 100k+ concurrent users
**Status:** Active roadmap — current codebase is a well-built MVP; this document describes the target architecture and the migration path to get there.
**Last updated:** February 2026

---

## Table of Contents

1. [Current State](#current-state)
2. [System Overview](#system-overview)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Infrastructure & DevOps](#infrastructure--devops)
6. [Database Schema](#database-schema)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Implementation Roadmap](#implementation-roadmap)
9. [New Dependencies](#new-dependencies)
10. [Environment Variables](#environment-variables)
11. [Verification](#verification)

---

## Current State

FastSock is a real-time chat application built on FastAPI + React. The MVP is fully functional with:

- WebSocket messaging, presence, typing indicators
- 1-on-1 DMs and group rooms
- Message reactions, pinning, bookmarks
- File/image uploads
- WebRTC voice/video calling
- @username system, user profiles with bio
- Redis pub/sub for multi-instance WebSocket broadcasting
- Kubernetes-ready deployment

### What breaks at scale

| Problem | Ceiling | Root cause |
|---|---|---|
| Monolithic `ws.py` (374 lines) | ~5k concurrent users | All WS logic: auth, rate-limit, DB writes, broadcast in one function |
| `useChatManager.ts` (320 lines) | ~50 components | Mixes server state, WS state, and UI state; Context rerenders all consumers |
| Local file uploads (`/static/uploads`) | 1 pod | Uploaded files not shared across multiple backend replicas |
| No background workers | Immediate | No way to do scheduled jobs (expiring messages, email digests, link previews) |
| No observability | Unknown | No metrics, no distributed tracing, no log aggregation |
| No CI/CD | Every deploy | Manual deploy steps, no automated tests on push |

---

## System Overview

```
                          ┌─────────────────────────────────────────────────────┐
                          │                   Kubernetes Cluster                │
                          │                                                     │
  Browser / Mobile        │   ┌──────────┐     ┌──────────────────────────┐   │
  ──────────────          │   │          │     │    FastAPI Backend        │   │
  HTTP REST  ─────────────┼───►  Nginx   ├────►│    (2–10 replicas, HPA)  │   │
  WebSocket  ─────────────┼───►  Ingress │     │                          │   │
                          │   │          │     │  api/v1/routers/  (thin) │   │
                          │   └──────────┘     │  domain/*/service  (logic)│  │
                          │                    │  ws/event_dispatcher      │   │
                          │                    └─────┬──────────┬──────────┘   │
                          │                          │          │              │
                          │              ┌───────────▼──┐  ┌───▼──────────┐   │
                          │              │  PostgreSQL   │  │    Redis     │   │
                          │              │  (primary DB) │  │  (pub/sub,   │   │
                          │              │               │  │   sessions,  │   │
                          │              └───────────────┘  │   cache)     │   │
                          │                                 └──────────────┘   │
                          │   ┌──────────────────────┐                         │
                          │   │   Background Workers │  ┌─────────────────┐   │
                          │   │   (separate Deployment│  │   MinIO         │   │
                          │   │   1 replica)         │  │  (Object Storage│   │
                          │   │  - disappearing msgs  │  │   for uploads)  │   │
                          │   │  - email digests      │  └─────────────────┘   │
                          │   │  - link previews      │                         │
                          │   │  - presence cleanup   │  ┌─────────────────┐   │
                          │   └──────────────────────┘  │  Prometheus +   │   │
                          │                              │  Grafana + Loki │   │
                          │   ┌──────────────────────┐  │  (Monitoring)   │   │
                          │   │   React Frontend     │  └─────────────────┘   │
                          │   │   (Nginx, 2 replicas)│                         │
                          │   └──────────────────────┘                         │
                          └─────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Target Folder Structure (Domain-Driven Design)

```
app/
├── api/
│   └── v1/
│       ├── routers/              ← thin HTTP handlers only
│       │   ├── auth.py           (login, signup, token refresh)
│       │   ├── users.py          (profile, search, block)
│       │   ├── chat.py           (history, search, rooms, pins, bookmarks)
│       │   ├── calls.py          (call history)
│       │   └── uploads.py        (file upload)
│       └── ws/
│           ├── router.py         ← WebSocket accept + auth only
│           └── handlers/         ← one file per event domain
│               ├── messaging.py  (message.send/edit/delete/react/forward)
│               ├── presence.py   (typing.start/stop, presence.update)
│               └── calls.py      (call.invite/accept/reject/hangup/busy)
│
├── core/
│   ├── config.py                 (Settings, env vars)
│   ├── security.py               (JWT, password hashing)
│   ├── events.py                 ← internal domain event bus (NEW)
│   └── ratelimit.py              ← centralized rate limit rules (NEW)
│
├── domain/                       ← ALL business logic lives here (NEW)
│   ├── messaging/
│   │   ├── service.py            (MessageService)
│   │   └── repository.py        (MessageRepository — DB queries only)
│   ├── users/
│   │   ├── service.py            (UserService)
│   │   └── repository.py
│   ├── rooms/
│   │   ├── service.py            (RoomService)
│   │   └── repository.py
│   ├── calls/
│   │   ├── service.py            (CallService)
│   │   └── repository.py
│   └── notifications/
│       └── service.py            (NotificationService — push, email, in-app)
│
├── models/                       ← SQLAlchemy models only, zero business logic
│   ├── user.py
│   ├── message.py
│   ├── chat.py
│   ├── call.py
│   └── pins.py
│
├── workers/                      ← background jobs (NEW, APScheduler — MIT)
│   ├── scheduler.py              (APScheduler setup, started in main.py lifespan)
│   ├── disappearing.py           (delete expired messages every 60s)
│   ├── email_digest.py           (email offline users every 30min)
│   ├── link_preview.py           (fetch OG metadata after message sent)
│   └── presence_cleanup.py       (mark stale WS connections offline every 5min)
│
├── infrastructure/               ← external service adapters (NEW)
│   ├── cache.py                  (Redis cache helpers)
│   ├── storage.py                (LocalStorage / S3Storage — MinIO in prod)
│   ├── email.py                  (fastapi-mail adapter — MIT)
│   └── push.py                   (pywebpush — Web Push adapter — MIT)
│
├── schemas/                      ← Pydantic request/response models
│   ├── user.py
│   ├── message.py
│   ├── token.py
│   └── ws_events.py
│
└── ws/
    ├── manager.py                ← ConnectionManager (keep, minor refactor)
    └── event_dispatcher.py       ← registry-based WS event router (NEW)
```

### Service Layer

Every domain has a `Service` class injected into HTTP routes and WS handlers via FastAPI `Depends()`. Routes contain zero business logic.

```python
# app/domain/messaging/service.py
class MessageService:
    def __init__(self, db: AsyncSession, manager: ConnectionManager):
        self.repo = MessageRepository(db)
        self.manager = manager

    async def send(self, sender_id: int, content: str,
                   receiver_id: int | None = None, room_id: int | None = None,
                   reply_to: int | None = None, is_silent: bool = False,
                   message_type: str = "text") -> Message:
        # 1. Authorize (check block list, room membership, DM permissions)
        # 2. Persist to DB via repo
        # 3. Store mention notifications
        # 4. Trigger link_preview worker if URL detected
        # 5. Broadcast via manager

    async def delete(self, message_id: int, user_id: int) -> None: ...
    async def react(self, message_id: int, user_id: int, emoji: str) -> dict: ...
    async def forward(self, message_id: int, user_id: int, target_id: int) -> Message: ...
    async def search(self, user_id: int, query: str, filters: dict) -> list[Message]: ...
```

```python
# app/api/v1/routers/chat.py  ← thin route
@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(deps.get_current_user),
    svc: MessageService = Depends(get_message_service),
):
    await svc.delete(message_id, current_user.id)
    return {"ok": True}
```

### Repository Pattern

All raw DB queries are in repository classes. Services never call `db.execute()` directly.

```python
# app/domain/messaging/repository.py
class MessageRepository:
    def __init__(self, db: AsyncSession): self.db = db

    async def get_dm_history(self, user_a: int, user_b: int,
                             before_id: int | None = None, limit: int = 50) -> list[Message]:
        # Cursor-based pagination (replaces OFFSET — consistent under concurrent writes)
        q = select(Message).where(
            or_(
                and_(Message.sender_id == user_a, Message.receiver_id == user_b),
                and_(Message.sender_id == user_b, Message.receiver_id == user_a),
            )
        ).order_by(Message.id.desc())
        if before_id:
            q = q.where(Message.id < before_id)
        return (await self.db.execute(q.limit(limit))).scalars().all()

    async def search_fts(self, user_id: int, query: str) -> list[Message]:
        # SQLite: FTS5 virtual table (built-in, no extra install)
        # PostgreSQL: tsvector + GIN index
        ...
```

### WebSocket Event Dispatcher

Replaces the `if/elif` chain in `ws.py` with a decorator-based registry:

```python
# app/ws/event_dispatcher.py
class EventDispatcher:
    _handlers: dict[str, Callable] = {}

    @classmethod
    def register(cls, event_type: str):
        def decorator(fn):
            cls._handlers[event_type] = fn
            return fn
        return decorator

    async def dispatch(self, event_type: str, data: dict,
                       user_id: int, db: AsyncSession, manager: ConnectionManager):
        handler = self._handlers.get(event_type)
        if not handler:
            return  # unknown event type — silently drop
        await handler(data, user_id, db, manager)

# app/api/v1/ws/handlers/messaging.py
@dispatcher.register("message.send")
async def handle_message_send(data, user_id, db, manager):
    svc = MessageService(db, manager)
    await svc.send(sender_id=user_id, **data)

@dispatcher.register("message.reaction")
async def handle_reaction(data, user_id, db, manager):
    svc = MessageService(db, manager)
    await svc.react(data["message_id"], user_id, data["emoji"])
```

The WebSocket router becomes 20 lines:

```python
# app/api/v1/ws/router.py
@router.websocket("/chat")
async def websocket_endpoint(ws: WebSocket, token: str, db: AsyncSession = Depends(get_db)):
    user = await get_current_user_ws(token, db)
    await manager.connect(ws, user.id)
    try:
        while True:
            raw = await ws.receive_text()
            payload = json.loads(raw)
            await dispatcher.dispatch(payload["event"], payload.get("data", {}),
                                      user.id, db, manager)
    except WebSocketDisconnect:
        await manager.disconnect(user.id)
```

### Background Workers

Started alongside the FastAPI app in `main.py` lifespan using APScheduler (MIT):

| Worker | Schedule | Responsibility |
|---|---|---|
| `disappearing.py` | Every 60s | `DELETE FROM message WHERE expires_at < NOW()` |
| `email_digest.py` | Every 30min | Email users offline > 1h with unread summary |
| `link_preview.py` | Event-driven | Fetch OG metadata (title/image/desc) for URLs in messages |
| `presence_cleanup.py` | Every 5min | Disconnect stale WS connections; mark users offline |

Workers run in a **separate Kubernetes Deployment** (1 replica) so they don't compete with API request handling.

### ConnectionManager Enhancements

```python
# app/ws/manager.py  — additions
class ConnectionManager:
    # Multi-device: one user can have multiple connections
    active_connections: dict[int, list[WebSocket]]  # user_id → [ws1, ws2, ...]

    async def send_to_many(self, user_ids: list[int], event: WSEvent):
        """Send to a list of users — used for room broadcasts."""
        ...

    async def get_online_user_ids(self) -> set[int]:
        """Return set of all user IDs with at least one active connection."""
        ...
```

---

## Frontend Architecture

### State Management Split

The overloaded `useChatManager.ts` (320 lines) is replaced by three distinct layers:

```
TanStack Query (@tanstack/react-query — MIT)
  Responsibility: server state with caching, pagination, background refetch
  ┌─────────────────────────────────────────────────────┐
  │  useUsers()        → GET /users/                    │
  │  useRooms()        → GET /chat/rooms                │
  │  useMessages(id)   → GET /chat/history (cursor pag.)│
  │  useUserProfile()  → GET /users/me                  │
  │  useUnread()       → GET /chat/unread (poll 30s)    │
  │  usePins(scope)    → GET /chat/pins/:scope          │
  │  useBookmarks()    → GET /chat/bookmarks            │
  └─────────────────────────────────────────────────────┘

Zustand (already installed — MIT)
  Responsibility: real-time state that changes via WebSocket
  ┌─────────────────────────────────────────────────────┐
  │  messageStore      → addMessage, updateMessage,     │
  │                       removeMessage, updateReaction  │
  │  presenceStore     → onlineUsers, typingUsers       │
  │  callStore         → replaces CallContext           │
  │  notifStore        → unread notification bell count │
  │  chatUIStore       → activeChatTarget, modal states │
  └─────────────────────────────────────────────────────┘

React Context (stable, rarely changes)
  ┌─────────────────────────────────────────────────────┐
  │  AuthContext       → user, token, login, logout     │
  │  WSContext         → ws instance, send(), subscribe()│
  └─────────────────────────────────────────────────────┘
```

### Target Folder Structure (Feature-Sliced Design)

```
frontend/src/
├── app/
│   ├── App.tsx                   (root component — minimal)
│   ├── main.tsx                  (entry point + providers)
│   ├── router.tsx                (all routes centralized here)
│   └── providers.tsx             (compose QueryClient + WS + Auth)
│
├── features/                     (one folder per product domain)
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   └── hooks/useAuth.ts
│   ├── chat/
│   │   ├── ChatPage.tsx
│   │   ├── components/           (existing components — keep)
│   │   │   ├── ChatShell.tsx
│   │   │   ├── ChatArea/
│   │   │   ├── ChatSidebar/
│   │   │   ├── MessageList/
│   │   │   └── Composer/
│   │   ├── hooks/
│   │   │   ├── useMessages.ts    ← TanStack Query (replaces part of useChatManager)
│   │   │   ├── useRooms.ts       ← TanStack Query
│   │   │   ├── usePresence.ts    ← reads from presenceStore
│   │   │   └── useChatTarget.ts  ← reads/writes chatUIStore
│   │   └── stores/
│   │       ├── messageStore.ts   ← Zustand
│   │       └── presenceStore.ts  ← Zustand
│   ├── calls/
│   │   ├── CallOverlay.tsx       (existing)
│   │   └── hooks/useCall.ts      ← migrated from CallContext → callStore
│   ├── notifications/
│   │   ├── NotificationBell.tsx  ← NEW: bell icon in sidebar header
│   │   └── hooks/useNotifications.ts
│   ├── settings/                 ← NEW: /settings route
│   │   ├── SettingsPage.tsx      (tab layout)
│   │   ├── AccountTab.tsx        (change password, email, username, delete account)
│   │   ├── NotificationsTab.tsx  (per-conversation preferences)
│   │   ├── PrivacyTab.tsx        (read receipts, last seen, who can DM me)
│   │   └── SessionsTab.tsx       (active sessions list + revoke)
│   ├── profile/
│   │   ├── UserProfileModal.tsx  (already built, moved from shared/components)
│   │   └── FindPeopleModal.tsx   (already built, moved here)
│   └── admin/
│       └── AdminPage.tsx         ← P3: superuser dashboard
│
├── shared/
│   ├── components/               (truly shared across features)
│   │   ├── EmojiPicker.tsx
│   │   ├── MessageReactions.tsx
│   │   ├── MentionAutocomplete.tsx
│   │   ├── PresenceSelector.tsx
│   │   └── Skeleton.tsx
│   ├── hooks/
│   │   └── useDebounce.ts
│   ├── utils/
│   │   └── messageFormatter.ts   (existing — keep)
│   └── types/
│       └── index.ts              (existing — keep, extend)
│
├── design-system/                (existing — keep as-is)
│   ├── primitives/               (Button, Card, Input, Modal, Loader, Skeleton)
│   ├── tokens/                   (tokens.css, fonts.css — CSS variables)
│   └── utils/                    (cn.ts)
│
└── services/
    ├── api.ts                    (existing — keep, extend)
    └── queryClient.ts            ← NEW: TanStack Query client config
```

### WebSocket Event Bus

A single `WSEventBus` component mounted at the app root dispatches all WebSocket events to the right Zustand store or invalidates the right TanStack Query cache. No component subscribes to raw WebSocket events individually.

```typescript
// frontend/src/app/providers.tsx
function WSEventBus() {
  const { subscribe } = useWS();
  const addMessage = useMessageStore(s => s.addMessage);
  const updateMessage = useMessageStore(s => s.updateMessage);
  const removeMessage = useMessageStore(s => s.removeMessage);
  const setOnline = usePresenceStore(s => s.setOnline);
  const setTyping = usePresenceStore(s => s.setTyping);
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribe((event: WSEvent) => {
      switch (event.event) {
        case 'message.receive':       addMessage(event.data); break;
        case 'message.update':        updateMessage(event.data); break;
        case 'message.delete':        removeMessage(event.data.id); break;
        case 'message.reaction':      updateMessage(event.data); break;
        case 'presence.update':       setOnline(event.data); break;
        case 'typing.start':          setTyping(event.data.user_id, true); break;
        case 'typing.stop':           setTyping(event.data.user_id, false); break;
        case 'user.updated':          queryClient.invalidateQueries({queryKey:['users']}); break;
        case 'room.created':          queryClient.invalidateQueries({queryKey:['rooms']}); break;
        case 'user.created':          queryClient.invalidateQueries({queryKey:['users']}); break;
        // call events handled by callStore
      }
    });
  }, []);

  return null;
}
```

### Routes

```
/                    → ChatPage          (auth required)
/settings            → SettingsPage      (auth required)
/settings/account    → AccountTab
/settings/notifications → NotificationsTab
/settings/privacy    → PrivacyTab
/settings/sessions   → SessionsTab
/join/:token         → RoomJoinPage      (invite link — auth required)
/login               → LoginPage
/signup              → SignupPage
*                    → NotFoundPage
```

---

## Infrastructure & DevOps

### CI/CD Pipeline (GitHub Actions — free)

**`.github/workflows/ci.yml`** — triggers on every push and PR:

```
Jobs (all run in parallel where possible):
  lint-backend    → ruff (MIT) + mypy (MIT)
  lint-frontend   → eslint + tsc --noEmit
  test-backend    → pytest --cov (SQLite in-memory)
  test-frontend   → vitest run
  build-docker    → docker build backend + frontend
  push-registry   → ghcr.io (GitHub Container Registry, free)
  deploy-staging  → kubectl apply (on merge to main only)
```

**`.github/workflows/release.yml`** — triggers on `git tag v*.*.*`:
```
build → push tagged images → kubectl rollout (production)
```

### Kubernetes Additions

New files alongside existing `k8s/fastsock.yaml`:

**`k8s/hpa.yaml`** — Horizontal Pod Autoscaler:
```yaml
# Backend scales 2–10 replicas based on CPU (70% threshold)
# Frontend scales 2–4 replicas based on CPU (70% threshold)
```

**`k8s/pdb.yaml`** — Pod Disruption Budget:
```yaml
# minAvailable: 1 on backend — zero-downtime rolling deploys
```

**`k8s/network-policy.yaml`** — Network isolation:
```yaml
# backend: egress to postgres + redis only
# frontend: ingress from ingress controller only
# postgres: ingress from backend only
# redis: ingress from backend only
```

**`k8s/workers.yaml`** — Background worker Deployment:
```yaml
# 1 replica, separate from API pods
# Same image as backend; different CMD: python -m app.workers.scheduler
```

**`k8s/monitoring.yaml`** — Observability stack:
```yaml
# Prometheus (Apache 2.0) — metrics
# Grafana (AGPL, self-hosted OK) — dashboards
# Loki + Promtail (AGPL/Apache) — log aggregation
# Jaeger (Apache 2.0) — distributed tracing
```

**`k8s/redis-sentinel.yaml`** — High-availability Redis:
```yaml
# Redis Sentinel (BSD) — 1 master + 2 replicas + 3 sentinels
# Automatic failover if master goes down
```

### Monitoring Stack

All tools are open-source and self-hosted:

| Tool | License | Endpoint |
|---|---|---|
| Prometheus | Apache 2.0 | `/metrics` on each backend pod |
| Grafana | AGPL 3.0 | `grafana.fastsock.example.com` |
| Loki | AGPL 3.0 | Receives logs from Promtail sidecar |
| Jaeger | Apache 2.0 | `jaeger.fastsock.example.com` |

**Custom metrics exposed by FastSock:**
```
fastsock_ws_connections_total        gauge   — active WebSocket connections
fastsock_messages_sent_total         counter — by type (text/image/audio)
fastsock_message_latency_seconds     histogram — WS receive to DB commit
fastsock_active_calls_total          gauge   — ongoing voice/video calls
fastsock_upload_bytes_total          counter — total bytes uploaded
fastsock_db_query_duration_seconds   histogram — per query type
fastsock_worker_jobs_total           counter — by worker name + status
```

### Object Storage (MinIO — AGPL, self-hosted)

Replaces `app/static/uploads/` local disk with S3-compatible storage. Enables shared uploads across multiple backend replicas.

```python
# app/infrastructure/storage.py
class StorageBackend(Protocol):
    async def upload(self, data: bytes, key: str, content_type: str) -> str: ...
    async def get_url(self, key: str) -> str: ...
    async def delete(self, key: str) -> None: ...

class LocalStorage(StorageBackend): ...    # dev — writes to ./static/uploads/
class S3Storage(StorageBackend): ...       # prod — MinIO or Cloudflare R2 (aioboto3)
```

Selected by `STORAGE_BACKEND=local|s3` environment variable.

---

## Database Schema

### Current Tables (already migrated)

- `user` — auth, profile, username, bio, presence
- `message` — content, sender, receiver, room, reactions JSON
- `chatroom` + `chatroom_member` — rooms with last_read_at tracking
- `call_session` — call lifecycle
- `pinned_message` — scoped pins
- `bookmarked_message` — user bookmarks

### New Tables & Columns (Migrations 007–010)

#### Migration 007 — Auth, Privacy, User Relations

```sql
-- User: auth fields
ALTER TABLE "user" ADD COLUMN email_verified  BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN totp_secret     TEXT;
ALTER TABLE "user" ADD COLUMN totp_enabled    BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN last_seen_at    DATETIME;
ALTER TABLE "user" ADD COLUMN is_bot          BOOLEAN DEFAULT FALSE;

-- Per-user privacy controls
CREATE TABLE user_privacy (
  user_id           INTEGER PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  show_last_seen    TEXT DEFAULT 'everyone',   -- everyone | contacts | nobody
  show_avatar       TEXT DEFAULT 'everyone',
  show_bio          TEXT DEFAULT 'everyone',
  allow_dms         TEXT DEFAULT 'everyone',   -- everyone | contacts | nobody
  show_read_receipts BOOLEAN DEFAULT TRUE
);

-- Blocking
CREATE TABLE user_block (
  blocker_id  INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  blocked_id  INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Contacts
CREATE TABLE user_contact (
  user_id     INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  contact_id  INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, contact_id)
);

-- Active sessions (for session management UI)
CREATE TABLE user_session (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  user_agent    TEXT,
  ip_address    TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at    DATETIME
);
```

#### Migration 008 — Messaging V2

```sql
ALTER TABLE message ADD COLUMN reply_to      INTEGER REFERENCES message(id);
ALTER TABLE message ADD COLUMN forwarded_from INTEGER REFERENCES message(id);
ALTER TABLE message ADD COLUMN thread_id     INTEGER REFERENCES message(id);
ALTER TABLE message ADD COLUMN expires_at    DATETIME;
ALTER TABLE message ADD COLUMN is_silent     BOOLEAN DEFAULT FALSE;
ALTER TABLE message ADD COLUMN is_view_once  BOOLEAN DEFAULT FALSE;
ALTER TABLE message ADD COLUMN edited_at     DATETIME;

CREATE TABLE link_preview (
  id          INTEGER PRIMARY KEY,
  message_id  INTEGER UNIQUE REFERENCES message(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  site_name   TEXT,
  fetched_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_message_sender_ts   ON message(sender_id,   timestamp DESC);
CREATE INDEX idx_message_room_ts     ON message(room_id,     timestamp DESC);
CREATE INDEX idx_message_receiver_ts ON message(receiver_id, timestamp DESC);
CREATE INDEX idx_message_thread      ON message(thread_id);
CREATE INDEX idx_message_expires     ON message(expires_at) WHERE expires_at IS NOT NULL;
```

#### Migration 009 — Rooms V2

```sql
ALTER TABLE chatroom ADD COLUMN description       TEXT;
ALTER TABLE chatroom ADD COLUMN avatar_url         TEXT;
ALTER TABLE chatroom ADD COLUMN is_public          BOOLEAN DEFAULT FALSE;
ALTER TABLE chatroom ADD COLUMN slow_mode_seconds  INTEGER DEFAULT 0;
ALTER TABLE chatroom ADD COLUMN type               TEXT DEFAULT 'group'; -- group | channel | topic

ALTER TABLE chatroom_member ADD COLUMN role               TEXT DEFAULT 'member'; -- owner | admin | member
ALTER TABLE chatroom_member ADD COLUMN nickname           TEXT;
ALTER TABLE chatroom_member ADD COLUMN notification_level TEXT DEFAULT 'all'; -- all | mentions | nothing
ALTER TABLE chatroom_member ADD COLUMN muted_until        DATETIME;
ALTER TABLE chatroom_member ADD COLUMN banned_at          DATETIME;

CREATE TABLE room_invite_link (
  token       TEXT PRIMARY KEY,
  room_id     INTEGER REFERENCES chatroom(id) ON DELETE CASCADE,
  created_by  INTEGER REFERENCES "user"(id),
  max_uses    INTEGER,
  use_count   INTEGER DEFAULT 0,
  expires_at  DATETIME,
  revoked_at  DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Migration 010 — Notifications, Polls, Push, Folders

```sql
CREATE TABLE notification (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,   -- mention | dm | reaction | call | system
  message_id   INTEGER REFERENCES message(id) ON DELETE SET NULL,
  from_user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notification_user_unread ON notification(user_id, is_read);

CREATE TABLE poll (
  id           INTEGER PRIMARY KEY,
  message_id   INTEGER UNIQUE REFERENCES message(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  options      JSON NOT NULL,         -- ["Option A", "Option B"]
  votes        JSON DEFAULT '{}',     -- {"0": [1, 3], "1": [2]}
  is_anonymous BOOLEAN DEFAULT FALSE,
  closes_at    DATETIME
);

CREATE TABLE scheduled_message (
  id          INTEGER PRIMARY KEY,
  sender_id   INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES "user"(id),
  room_id     INTEGER REFERENCES chatroom(id),
  content     TEXT NOT NULL,
  send_at     DATETIME NOT NULL,
  sent_at     DATETIME,
  cancelled_at DATETIME
);

CREATE TABLE report (
  id          INTEGER PRIMARY KEY,
  reporter_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
  target_type TEXT,       -- message | user
  target_id   INTEGER,
  reason      TEXT,
  status      TEXT DEFAULT 'pending',  -- pending | reviewed | dismissed
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE push_subscription (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  endpoint    TEXT UNIQUE NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_folder (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  color    TEXT,
  position INTEGER DEFAULT 0
);
CREATE TABLE chat_folder_item (
  folder_id   INTEGER REFERENCES chat_folder(id) ON DELETE CASCADE,
  target_type TEXT,   -- dm | room
  target_id   INTEGER,
  PRIMARY KEY (folder_id, target_type, target_id)
);
```

---

## Data Flow Diagrams

### Message Send Flow

```
User types + presses Enter
        │
        ▼
Composer.tsx calls send('message.send', {...})
        │
        ▼
WSContext.send() → WebSocket → Backend ws/router.py
        │
        ▼
EventDispatcher.dispatch('message.send', data, user_id, db, manager)
        │
        ▼
messaging.py handler → MessageService.send()
        │
        ├── MessageRepository.create() → DB commit
        │
        ├── NotificationService.store_mentions()
        │
        ├── link_preview worker triggered (async, non-blocking)
        │
        └── ConnectionManager.broadcast()
                │
                ├── Redis PUBLISH "chat:events" (all instances)
                │
                └── Local: send message.ack → sender
                           send message.receive → recipient(s)
                                   │
                                   ▼
                          WSEventBus.tsx receives event
                                   │
                          messageStore.addMessage()
                                   │
                          MessageList re-renders (Zustand selector)
```

### Presence Flow

```
User opens browser tab
        │
        ▼
ChatContext.tsx creates WebSocket
        │
        ▼
Backend: manager.connect(ws, user_id)
        │
        └── Broadcast presence.update {user_id, online: true}
                │
                ▼
        presenceStore.setOnline({user_id, online: true})
                │
                ▼
        StatusDot in ChatSidebar re-renders (Zustand selector)
```

---

## Implementation Roadmap

Execute in this sequence to never break existing features (all steps are additive until step 4-5):

| Step | What | Risk | Estimated effort |
|---|---|---|---|
| 1 | Create `app/domain/` folder with empty `__init__.py` files | None | 15 min |
| 2 | Write `MessageRepository` pulling queries from `chat.py` | Low | 2h |
| 3 | Write `MessageService` using repository | Low | 3h |
| 4 | Refactor `chat.py` routes to use `MessageService` | Medium | 2h |
| 5 | Write `EventDispatcher` + extract WS handlers | Medium | 4h |
| 6 | Write `RoomService`, `UserService` | Low | 4h |
| 7 | Add migrations 007–010 | Low | 3h |
| 8 | Add background workers (APScheduler) | Low | 3h |
| 9 | Add infrastructure adapters (storage, email, push) | Low | 4h |
| 10 | Frontend: install TanStack Query, create `queryClient.ts` | None | 30 min |
| 11 | Frontend: create Zustand `messageStore`, `presenceStore` | Low | 2h |
| 12 | Frontend: create `WSEventBus`, mount in `providers.tsx` | Low | 1h |
| 13 | Frontend: refactor `useChatManager` → split hooks | Medium | 4h |
| 14 | Frontend: restructure folders (file moves only) | Low | 1h |
| 15 | Frontend: add `SettingsPage` + routes | Low | 4h |
| 16 | Add `.github/workflows/ci.yml` | None | 2h |
| 17 | Add Prometheus metrics + `k8s/monitoring.yaml` | Low | 2h |
| 18 | Add `k8s/hpa.yaml`, `k8s/pdb.yaml`, `k8s/network-policy.yaml` | Low | 1h |
| 19 | Add `app/infrastructure/storage.py` + MinIO in docker-compose | Low | 3h |
| 20 | Add `k8s/workers.yaml` for background worker Deployment | Low | 1h |

---

## New Dependencies

### Backend additions to `requirements.txt`

```
# Background jobs
apscheduler==3.10.4                          # MIT

# Email
fastapi-mail==1.4.1                          # MIT

# 2FA
pyotp==2.9.0                                 # MIT
qrcode==7.4.2                                # MIT

# Web Push notifications
pywebpush==2.0.1                             # MIT

# HTML sanitization
bleach==6.1.0                                # Apache 2.0

# Metrics
prometheus-fastapi-instrumentator==7.0.0    # ISC

# Distributed tracing
opentelemetry-sdk==1.24.0                   # Apache 2.0
opentelemetry-instrumentation-fastapi==0.45b0  # Apache 2.0

# S3-compatible object storage
aioboto3==13.0.0                             # Apache 2.0

# Link preview scraping
beautifulsoup4==4.12.3                       # MIT

# Code quality (dev)
ruff==0.5.0                                  # MIT
mypy==1.10.0                                 # MIT
```

### Frontend additions to `package.json`

```
@tanstack/react-query         ^5.0.0    MIT — server state management
@tanstack/react-query-devtools ^5.0.0   MIT — dev tools
vitest                        ^3.0.0    MIT — unit testing
@testing-library/react        ^16.0.0   MIT — component testing
@testing-library/user-event   ^14.0.0   MIT — user interaction testing
jsdom                         ^25.0.0   MIT — DOM environment for tests
```

All dependencies are **100% open-source with permissive licenses** (MIT, Apache 2.0, ISC). No GPL-licensed packages. No proprietary SDKs.

---

## Environment Variables

### Current (already in use)

```bash
DATABASE_URL=sqlite+aiosqlite:///./fastsock.db   # or postgresql+asyncpg://...
REDIS_URL=                                        # optional, enables pub/sub
SECRET_KEY=changethis                             # JWT signing key (required)
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
PROJECT_NAME=FastSock
BACKEND_CORS_ORIGINS=[]
WEBRTC_ICE_SERVERS_JSON=
LOG_FORMAT=text                                   # text | json
```

### New variables to add

```bash
# Email (fastapi-mail)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_TLS=false
SMTP_SSL=false
EMAILS_FROM_EMAIL=noreply@fastsock.app
EMAILS_FROM_NAME=FastSock

# Object storage
STORAGE_BACKEND=local                             # local | s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=fastsock
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
S3_PUBLIC_URL=http://localhost:9000/fastsock

# Web Push (VAPID — generate once: pywebpush generate-vapid-keys)
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
VAPID_EMAIL=admin@fastsock.app

# AI features (optional — leave empty to disable)
OLLAMA_BASE_URL=http://ollama:11434              # self-hosted Llama 3 (MIT)

# Feature flags (env-var based, no extra library needed)
FEATURE_EMAIL_VERIFY=false
FEATURE_2FA=false
FEATURE_LINK_PREVIEW=true
FEATURE_VOICE_MESSAGES=true
FEATURE_DISAPPEARING_MESSAGES=true
FEATURE_AI_SUMMARY=false
```

### `.env.example` file will be added to root of project

---

## Verification

### Backend

```bash
# All existing tests pass after refactor
pytest tests/ -v --tb=short

# New service layer tests
pytest tests/unit/ -v

# Migration chain runs cleanly from scratch
rm fastsock.db
alembic upgrade head

# Health endpoint shows all services green
curl localhost:8000/health
# {"status":"ok","database":"connected","redis":"connected","storage":"connected"}

# Prometheus metrics endpoint
curl localhost:8000/metrics | grep fastsock_

# WebSocket event dispatcher handles all event types
pytest tests/test_ws_dispatcher.py -v
```

### Frontend

```bash
# TypeScript zero errors
npx tsc --noEmit

# Unit tests pass
npx vitest run

# Build succeeds, bundle sizes reasonable
npm run build
# (check dist/ — no single chunk > 500KB gzipped)

# E2E smoke test:
# 1. Open two browser tabs
# 2. Send a message in tab 1
# 3. Verify it appears in tab 2 within 100ms
# 4. Open DevTools → Zustand store shows correct state
```

### Infrastructure

```bash
# Docker Compose dev stack starts clean
docker-compose up --build
# Check: backend, frontend, postgres, redis, minio all healthy

# Kubernetes manifests validate
kubectl apply -f k8s/ --dry-run=client

# HPA created correctly
kubectl get hpa -n fastsock

# Load test with k6 (MIT)
k6 run tests/load/ws_messages.js
# Target: 1000 concurrent WS connections, p95 < 50ms message latency
```
