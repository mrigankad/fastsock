# FastSock — Project Status

> **Last updated:** 2026-02-14
> **Stack:** FastAPI + SQLAlchemy async + SQLite + React 19 + TypeScript + Vite + TailwindCSS v4 + WebSocket
> **Repo state:** All changes on `main` branch, zero TypeScript errors, backend imports clean.

---

## Quick Stats

| Area | Done | In Progress | Not Started |
|---|:---:|:---:|:---:|
| Backend architecture | ✅ Complete | — | — |
| Database schema | ✅ Complete (011) | — | — |
| Auth & security | 8/13 | — | 5 |
| Core messaging | 10/10 | — | 0 |
| Rich messaging | 9/11 | — | 2 |
| User identity / settings | 12/14 | — | 2 |
| Groups & rooms | 7/9 | — | 2 |
| Notifications | 5/8 | — | 3 |
| Calls | 4/7 | — | 3 |
| Frontend UI | ~75% | — | ~25% |
| Infrastructure / DevOps | ✅ Complete | — | — |

---

## Part 1 — What Has Been Done

### 1.1 Backend Architecture

| Item | Detail |
|---|---|
| Domain-Driven Design | `app/domain/messaging/` — `MessageRepository` (all DB queries) + `MessageService` (business logic: send, edit, delete, react, read receipts, mark delivered) |
| Registry-based EventDispatcher | `app/ws/event_dispatcher.py` — `@dispatcher.register("event.name")` decorator; replaces 374-line monolithic if/elif chain in `ws.py` |
| WS handler modules | `app/ws/handlers/messaging.py` (send/edit/delete/react/read/delivered), `presence.py` (typing), `calls.py` (invite/accept/reject/hangup/relay) |
| Thin WS router | `app/api/api_v1/endpoints/ws.py` reduced from 374 → 82 lines; accept + auth + dispatch only |
| Background workers | `app/workers/link_preview.py` (fire-and-forget OG metadata); `app/workers/disappearing.py` (delete expired messages every 60s) |
| APScheduler | `app/workers/scheduler.py` — started in `main.py` lifespan; 1 job registered (delete_expired_messages) |
| Rate limiting | `slowapi` on auth endpoints (5/min); WS: 30 msgs/10s, 3 call invites/30s, per-connection deques |
| Input sanitization | `bleach` strips all HTML tags from message content, bio, display_name, status_message, room name on ingest |
| Slow mode enforcement | WS `message.send` checks `chatroom.slow_mode_seconds` against sender's last message timestamp; returns error with remaining wait |
| Group permission enforcement | `PATCH /chat/rooms/{id}` and kick require `admin`/`owner` role check |

### 1.2 Database Migrations

| Migration | Contents |
|---|---|
| 001–005 | Initial schema: User, Message, ChatRoom, ChatRoomMember, basic fields |
| 006 | `user.username` (unique @handle), `user.bio` |
| 007 | `user.email_verified`, `user.last_seen_at`; tables: `user_privacy`, `user_session`, `user_block`, `user_contact` |
| 008 | Message v2: `reply_to_id`, `forwarded_from`, `edited_at`, `expires_at`, `is_silent`; `link_preview` table; performance indexes |
| 009 | Room v2: `chatroom.description/avatar_url/is_public/slow_mode_seconds`; `chatroom_member.role/muted_until/notification_level`; `room_invite_link` table; `notification` table |
| 010 | `MessageType.AUDIO` enum value added (SQLite no-op — stored as VARCHAR) |
| 011 | `disappearing_timer` table: per-user, per-conversation timer preference (type + target_id + duration_seconds) |

### 1.3 API Endpoints

#### Auth (`/api/v1/auth/`)
| Method | Path | Description |
|---|---|---|
| POST | `/login/access-token` | JWT login (rate limited 5/min) |
| POST | `/signup` | Create account, auto-generate @username |
| GET | `/sessions` | List active sessions |
| DELETE | `/sessions/{id}` | Revoke one session |
| DELETE | `/sessions` | Revoke all sessions |

#### Users (`/api/v1/users/`)
| Method | Path | Description |
|---|---|---|
| GET | `/` | List all users |
| GET | `/me` | Get current user |
| PUT | `/me` | Update profile (sanitized via bleach) |
| DELETE | `/me` | Delete account (cascade) |
| POST | `/me/change-password` | Change password |
| GET | `/me/privacy` | Get privacy settings |
| PATCH | `/me/privacy` | Update privacy settings |
| GET | `/search?q=` | Search by @username/name |
| GET | `/{id}` | Get user by ID |
| GET | `/blocked` | List blocked users |
| POST | `/{id}/block` | Block a user |
| DELETE | `/{id}/block` | Unblock a user |

#### Chat (`/api/v1/chat/`)
| Method | Path | Description |
|---|---|---|
| GET | `/history/user/{id}` | DM message history (paginated) |
| GET | `/history/room/{id}` | Room message history (membership check) |
| GET | `/search` | Full-text message search |
| GET | `/unread` | Unread counts (DMs + rooms) |
| POST | `/rooms` | Create group room |
| GET | `/rooms` | List user's rooms |
| PATCH | `/rooms/{id}` | Update room (admin/owner only) |
| DELETE | `/rooms/{id}/members/{uid}` | Kick member (admin/owner only) |
| POST | `/rooms/{id}/read` | Mark room as read |
| POST | `/rooms/{id}/invite` | Generate invite link token |
| GET | `/join/{token}` | Join via invite link |
| PUT | `/messages/{id}` | Edit message |
| DELETE | `/messages/{id}` | Delete message |
| POST | `/messages/{id}/reactions` | Toggle emoji reaction |
| POST | `/messages/{id}/pin` | Pin message |
| DELETE | `/messages/{id}/pin` | Unpin message |
| GET | `/pins/{scope}` | List pinned messages |
| POST | `/messages/{id}/bookmark` | Toggle bookmark |
| GET | `/bookmarks` | List bookmarks |
| GET | `/notifications` | List notifications |
| GET | `/notifications/unread-count` | Unread badge count |
| POST | `/notifications/read-all` | Mark all read |
| POST | `/notifications/{id}/read` | Mark one read |
| POST | `/disappearing` | Set/clear disappearing timer for a conversation |
| GET | `/disappearing` | Get active timer for a conversation (0 = off) |

#### Other
| Method | Path | Description |
|---|---|---|
| POST | `/utils/upload` | File/image upload (auth, size+type check) |
| POST | `/utils/upload/audio` | Voice message upload (10 MB, webm/ogg/mp3/wav) |
| GET | `/webrtc/ice-servers` | TURN/STUN config |
| GET | `/calls/history` | Call history |
| GET | `/health` | Health check (DB + Redis) |

### 1.4 WebSocket Events

#### Client → Server
| Event | Handler | Description |
|---|---|---|
| `message.send` | messaging.py | Send DM or room message (rate limited, slow mode, sets expires_at if timer active) |
| `message.delivered` | messaging.py | Mark message delivered |
| `message.read` | messaging.py | Mark message read |
| `message.reaction` | messaging.py | Toggle emoji reaction |
| `typing.start` | presence.py | Broadcast typing indicator |
| `typing.stop` | presence.py | Clear typing indicator |
| `call.invite` | calls.py | Initiate call |
| `call.accept` | calls.py | Accept call |
| `call.reject` | calls.py | Reject call |
| `call.hangup` | calls.py | End call |
| `call.offer` | calls.py | WebRTC SDP offer relay |
| `call.answer` | calls.py | WebRTC SDP answer relay |
| `call.ice_candidate` | calls.py | ICE candidate relay |

#### Server → Client
| Event | Trigger | Description |
|---|---|---|
| `message.receive` | MessageService.send | New message to recipients |
| `message.ack` | MessageService.send | Confirm send to sender |
| `message.update` | MessageService.edit | Edited message broadcast |
| `message.delete` | MessageService.delete / disappearing worker | Deleted message broadcast |
| `message.delivery_receipt` | MessageService.mark_delivered | Delivery confirmation |
| `message.read_receipt` | MessageService.mark_read | Read confirmation |
| `message.reaction` | MessageService.toggle_reaction | Reaction update |
| `message.link_preview` | link_preview worker | OG card after URL fetch |
| `message.pinned` | chat.py | Pin notification |
| `message.unpinned` | chat.py | Unpin notification |
| `message.error` | ws handlers | Error feedback to sender |
| `presence.update` | ws.py connect/disconnect | Online/offline status |
| `typing.start` | presence.py | Typing indicator |
| `typing.stop` | presence.py | Typing cleared |
| `user.created` | auth.py | New user broadcast |
| `user.updated` | users.py | Profile update broadcast |
| `room.created` | chat.py | New room broadcast |
| `room.updated` | chat.py | Room PATCH broadcast |
| `room.member_removed` | chat.py | Kick broadcast |
| `notification.new` | MessageService.send | DM notification badge |
| `call.*` | calls.py | All call signaling relay |

### 1.5 Frontend Features

#### Pages & Routing
| Route | Component | Status |
|---|---|---|
| `/` | `ChatPage` | ✅ Full chat UI |
| `/settings` | `SettingsPage` | ✅ 4-tab settings |
| `/login` | `LoginPage` | ✅ |
| `/signup` | `SignupPage` | ✅ |

#### Settings Tabs
| Tab | Features | Status |
|---|---|---|
| Account | Edit display_name, @username, bio, status, avatar_url; Danger zone (delete account) | ✅ |
| Privacy | show_last_seen, show_avatar, show_bio, allow_dms selectors; read receipts toggle | ✅ Wired to API |
| Appearance | Dark/light mode toggle with live preview | ✅ |
| Sessions | List active sessions + revoke individual / revoke all | ✅ |

#### Chat UI Components
| Component | Description | Status |
|---|---|---|
| `ChatSidebar` | Conversation list sorted by last message; filter chips (All/Unread/Groups); search; presence dots | ✅ |
| `ChatArea` | Message list + composer + header + disappearing timer menu | ✅ |
| `MessageList` | Infinite scroll with load-more; WS + server state merge | ✅ |
| `MessageBubble` | Sent/received styling; delivery ticks; reactions; reply-to preview; link preview card; audio player | ✅ |
| `Composer` | Text input; emoji picker; file attach; reply-to bar; voice recorder (mic → record → send); message drafts | ✅ |
| `VoiceRecorderBar` | Record / stop / send / cancel bar; pulse animation; duration timer | ✅ |
| `AudioMessage` | In-bubble audio player: play/pause, seek slider, elapsed/total time | ✅ |
| `DisappearingTimerMenu` | Timer icon in header; dropdown (Off/30s/5m/1h/24h/7d); active timer chip; per-conversation | ✅ |
| `NotificationBell` | Bell icon + badge in sidebar; dropdown panel; mark-all-read | ✅ |
| `FindPeopleModal` | Search users by @username or name; start DM | ✅ |
| `UserProfileModal` | View profile; avatar, bio, @username, presence; "Message" button | ✅ |
| `EmojiPicker` | Full emoji picker via `emoji-picker-react` | ✅ |
| `MessageReactions` | Reaction row; toggle; counts | ✅ |
| `MentionAutocomplete` | @username dropdown in composer | ⚠️ UI only, not wired to DB |
| `PresenceSelector` | StatusDot component; presence status picker | ✅ |

#### State Management
| Store / Hook | Library | Description | Status |
|---|---|---|---|
| `useMessageStore` | Zustand | Incoming WS messages per conversation key | ✅ |
| `usePresenceStore` | Zustand | Online users set; typing users with auto-clear | ✅ |
| `useWSEventBus` | Custom | Single WS → store router; handles 16 event types | ✅ |
| `useMessages` | TanStack Query | Server message history + Zustand merge | ✅ |
| `useRooms` | TanStack Query | Room list with cache | ✅ |
| `useUsers` | TanStack Query | User list (excludes self) | ✅ |
| `useNotifications` | TanStack Query | Notification list + unread count (30s poll) | ✅ |
| `useVoiceRecorder` | Custom | MediaRecorder API; state machine: idle→recording→stopped | ✅ |
| `AuthContext` | React Context | user, login, logout, signup, setUser | ✅ |
| `ChatContext` | React Context | WS instance, send, subscribe | ✅ |

#### Message Drafts
- Unsent text auto-saved to `localStorage` per conversation key (`dm:N` or `room:N`)
- Restored when navigating back to a conversation
- Cleared on successful send

#### Link Previews
- Backend fetches OG metadata fire-and-forget after each text message
- `message.link_preview` WS event attaches card to message in real time
- `LinkPreviewCard` renders image, title, description, site name, URL inside bubble

#### Voice Messages
- Mic button in Composer starts recording via `MediaRecorder` (webm/opus preferred)
- `VoiceRecorderBar` shows live duration + pulse; stop → send or cancel
- Audio uploaded to `POST /utils/upload/audio` before sending; URL sent as `message_type: 'audio'`
- `AudioMessage` component in bubble: play/pause toggle + seek range input + time display

#### Disappearing Messages
- Per-conversation timer stored in `disappearing_timer` table
- `DisappearingTimerMenu` in ChatArea header: Off / 30s / 5m / 1h / 24h / 7 days
- When active: `MessageService.send()` sets `expires_at = now() + duration` on every new message
- APScheduler job runs every 60s, deletes expired messages, broadcasts `message.delete` WS events

### 1.6 Infrastructure & DevOps

| Item | File | Status |
|---|---|---|
| CI pipeline | `.github/workflows/ci.yml` | ✅ lint + test + tsc + build + Docker push on main |
| Release pipeline | `.github/workflows/release.yml` | ✅ versioned Docker images + GitHub Release on `v*.*.*` |
| Docker | `Dockerfile` + `frontend/Dockerfile` | ✅ |
| Kubernetes | `k8s/fastsock.yaml` | ✅ Deployment, Service, Ingress, PVC |
| Docker Compose | `docker-compose.yml` | ✅ |
| Health endpoint | `GET /health` | ✅ DB + Redis check |
| Structured logging | `app/main.py` middleware | ✅ JSON + request timing |
| APScheduler | `app/workers/scheduler.py` | ✅ Started in lifespan; delete_expired_messages job |

---

## Part 2 — What Is Left To Do

### 2.1 P0 — Security Blockers (do before any public launch)

| Item | Effort | Dependencies | Notes |
|---|---|---|---|
| **Password reset via email** | Medium | `fastapi-mail` (MIT) | `POST /auth/forgot-password` → signed token email; `POST /auth/reset-password?token=` → validate + set. `python-jose` already installed. |
| **Email verification on signup** | Medium | `fastapi-mail` (MIT) | Send confirmation link on signup; block login until verified. `user.email_verified` column already exists. |
| **2FA / TOTP** | Large | `pyotp` (MIT) + `qrcode` (MIT) | `user.totp_secret` + `user.totp_enabled` columns already in schema. QR code setup flow + login second-factor check. |
| **Privacy enforcement** | Small | — | `user_privacy` table is fully wired but its values are never read. Enforce `show_last_seen`/`show_bio`/`show_avatar` in `GET /users/{id}`; enforce `allow_dms` in `message.send` WS handler. |
| **Content reporting** | Small | — | `POST /reports` endpoint + `report` table. Lets users flag messages/users. |

### 2.2 P1 — Table-Stakes (users will immediately notice these missing)

#### Messaging
| Item | Effort | Schema ready? | Notes |
|---|---|---|---|
| **Message forwarding UI** | Medium | ✅ `forwarded_from` column | Conversation picker modal → WS `message.forward` event → "Forwarded" label in bubble. |
| **@mention wiring** | Medium | ❌ no `mentions` column yet | `MentionAutocomplete.tsx` UI exists. Add `message.mentions` JSON column (migration 012) → trigger `Notification(type="mention")` in `MessageService` → highlight `@username` in bubble. |
| **Silent messages** | Small | ✅ `is_silent` column | Composer toggle → send `is_silent: true` → recipient suppresses notification sound. |
| **Offline message queue** | Small | — | Queue outgoing messages in `localStorage` while WS is disconnected; flush on reconnect. Pure frontend. |
| **Note to Self** | Small | — | DM where `sender_id === receiver_id`; pin at top of sidebar. |

#### Groups — Frontend Only (all API endpoints exist)
| Item | Effort | Notes |
|---|---|---|
| **Group info panel** | Medium | Slide-in panel on group header click. Shows: name, avatar, description, member count, invite link, edit controls for admin/owner. All APIs exist. |
| **Member list** | Small | List members with role badges. Admin can kick. |
| **Notification mute toggle** | Small | Per-room mute bell → `PATCH /chat/rooms/{id}/members/me` with `notification_level`. Need to add this endpoint. |

#### Notifications
| Item | Effort | Notes |
|---|---|---|
| **PWA / Service Worker push** | Large | Full background push when tab is closed. `workbox` (MIT) + `pywebpush` (MIT). `push_subscription` table planned in schema. |
| **Email notifications** | Medium | Offline user digest. `fastapi-mail` (MIT) + APScheduler digest job. |

#### Calls
| Item | Effort | Notes |
|---|---|---|
| **Screen sharing** | Small | `getDisplayMedia()` API in frontend; add `call.screen_share` WS relay event. |
| **Group voice/video** | Very Large | Requires SFU — `mediasoup` (MIT) or LiveKit (Apache 2.0). Complete architectural addition. |

#### Auth
| Item | Effort | Notes |
|---|---|---|
| **Token refresh** | Small | Silent refresh before 30min expiry — users currently get silently logged out. Intercept 401 in axios and re-issue token. |
| **Auto-populate UserSession on login** | Small | Login endpoint should insert `UserSession` row with `user_agent` + `ip_address`. Sessions tab currently shows empty until manually created. |

### 2.3 P2 — Polish & Differentiation

| Item | Notes |
|---|---|
| **Spoiler text** | `||hidden text||` syntax, blurred until clicked. Parser rule in `messageFormatter.ts`. No library needed. |
| **Emoji autocomplete** | Type `:` → dropdown. `emoji-mart` (MIT). |
| **Shared media gallery** | Right Panel tab showing all images/files/links/voice in conversation. `GET /chat/media/{type}/{id}`. |
| **Message threads** | Slack-style. `thread_id` on message model. Slide-in thread panel. |
| **Polls** | `poll` table + `poll.vote` WS event. Group-only. |
| **Scheduled messages** | Compose → set future time. `scheduled_message` table + APScheduler. |
| **Status / Stories** | 24-hour ephemeral. `story` table. Reuse upload endpoint. |
| **Public group directory** | `chatroom.is_public = true` rooms. Browse/join without invite. |
| **Broadcast channels** | `chatroom.type = 'channel'` — admin-only posting. |
| **Chat folders** | Drag-to-sort. `chat_folder` + `chat_folder_item` tables. `@dnd-kit/core` (MIT). |
| **Profile QR code** | Scannable @username QR. `react-qr-code` (MIT). |
| **Contacts / friends list** | `user_contact` table exists. `POST/GET /users/contacts`. Contacts section in sidebar. |
| **OAuth / SSO** | Sign in with Google/GitHub. `Authlib` (BSD). |
| **MinIO / S3 storage** | Replace local `static/uploads/`. `aioboto3` (Apache 2.0). Needed for multi-pod k8s deployments. |
| **`last_seen_at` tracking** | Write on WS disconnect. Show "Last seen 2h ago" in DM subtitle. Column exists, never updated. |

### 2.4 P3 — Power Features

| Item | Notes |
|---|---|
| **AI conversation summary** | "Catch me up" on unread. `ollama` (MIT) with llama3/mistral self-hosted. |
| **AI smart replies** | 3 suggested quick replies. Same LLM. |
| **Voice transcription** | `faster-whisper` (MIT). Auto-transcribe audio messages. |
| **AI translation** | `deep-translator` (MIT) + LibreTranslate (AGPL, self-host). |
| **AI auto-moderation** | `detoxify` (Apache 2.0) — local toxicity classifier on message ingest. |
| **Webhook integrations** | Incoming + outgoing. `webhook` table + WS pipeline handler. |
| **Bot framework** | `is_bot` flag on User + command routing to webhook URLs. |
| **Admin dashboard** | User/room/message management. Flagged content queue. `is_superuser` flag already on User model. |
| **Full-text search** | SQLite FTS5 or PostgreSQL `tsvector`. Replace current `ILIKE`. |
| **Cursor-based pagination** | `before_id` param on history endpoints. `MessageRepository` already supports it internally — just needs exposing via API param. |
| **Chat data export** | GDPR. `GET /users/me/export` → JSON/ZIP download. |
| **Prometheus metrics** | `prometheus-fastapi-instrumentator` (ISC). WS connections, messages sent, latency histograms. |

### 2.5 P4 — Long-Term Platform

| Item | Notes |
|---|---|
| **Native mobile apps** | React Native — reuse TS types + API layer. |
| **E2EE** | `TweetNaCl.js` (public domain) for DMs. Signal Protocol for groups. |
| **Matrix bridge** | `matrix-python-sdk` (Apache 2.0) — interop with Element. |
| **White-label / multi-tenant** | Subdomain routing + per-tenant branding in DB. |
| **Location sharing** | Lat/lng message type. `Leaflet` (BSD) + OpenStreetMap. |
| **AR effects in calls** | Background blur. `@tensorflow/tfjs` (Apache 2.0) + body-segmentation. |
| **Monetization** | Premium subscriptions. `stripe-python` (MIT). |

---

## Part 3 — Recommended Next Steps (Ordered)

### Immediate (next session)
1. **Password reset** — P0 security blocker; `python-jose` already installed, just needs `fastapi-mail` + 2 endpoints + frontend form
2. **Privacy enforcement** — 1-hour fix; columns and API exist, just need to read them in `GET /users/{id}` and `message.send`

### Short-term (next 2–3 sessions)
3. **Group info panel** — all APIs exist; pure frontend work, high visibility for group users
4. **@mention wiring** — `MentionAutocomplete.tsx` UI exists; needs 1 migration + notification trigger + bubble highlight
5. **Token refresh** — silent 401 → re-issue; prevents users being silently logged out
6. **Auto-populate UserSession on login** — quick fix, completes the sessions feature

### Medium-term
7. **Email verification** — required before any real user launch
8. **2FA** — `pyotp` + QR setup flow
9. **PWA push notifications** — background push for mobile-like experience
10. **Spoiler text + emoji autocomplete** — low effort, high polish

---

## Part 4 — Architecture Overview

```
FastSock/
├── app/
│   ├── api/api_v1/endpoints/     ← Thin HTTP routers (auth, users, chat, ws, upload, calls)
│   ├── core/                     ← Config, security (JWT/bcrypt), deps
│   ├── db/                       ← Session factory, base class
│   ├── domain/messaging/         ← MessageRepository + MessageService
│   ├── models/                   ← SQLAlchemy models (user, message, chat, notification, pins)
│   ├── schemas/                  ← Pydantic schemas
│   ├── workers/
│   │   ├── scheduler.py          ← APScheduler (started in lifespan)
│   │   ├── disappearing.py       ← Delete expired messages every 60s
│   │   └── link_preview.py       ← Fire-and-forget OG metadata fetch
│   └── ws/
│       ├── event_dispatcher.py   ← Registry-based dispatcher
│       ├── handlers/             ← messaging.py, presence.py, calls.py
│       └── manager.py            ← ConnectionManager (Redis pub/sub + in-memory fallback)
├── alembic/versions/             ← 001–011 migrations
├── frontend/src/
│   ├── context/                  ← AuthContext, ChatContext (WS)
│   ├── features/
│   │   ├── auth/                 ← LoginPage, SignupPage
│   │   ├── chat/
│   │   │   ├── ChatPage.tsx
│   │   │   ├── components/       ← ChatSidebar, ChatArea, MessageList, MessageBubble, Composer
│   │   │   │   ├── Composer/     ← Composer.tsx, VoiceRecorder.tsx
│   │   │   │   ├── ChatArea/     ← ChatArea.tsx, DisappearingTimerMenu.tsx
│   │   │   │   └── MessageList/  ← MessageList.tsx, MessageBubble.tsx, AudioMessage.tsx
│   │   │   ├── hooks/            ← useMessages, useRooms, useUsers, useWSEventBus, useVoiceRecorder
│   │   │   └── stores/           ← messageStore.ts, presenceStore.ts (Zustand)
│   │   ├── notifications/        ← NotificationBell, useNotifications
│   │   └── settings/             ← SettingsPage, AccountTab, PrivacyTab, AppearanceTab, SessionsTab
│   ├── services/
│   │   ├── api.ts                ← All HTTP calls (authApi, chatApi, callsApi)
│   │   └── queryClient.ts        ← TanStack Query config
│   └── types/index.ts            ← Shared TypeScript interfaces
├── k8s/                          ← Kubernetes manifests
├── .github/workflows/            ← CI (ci.yml) + Release (release.yml)
├── FEATURES_TO_ADD.md            ← Detailed backlog with priorities
└── PROJECT_STATUS.md             ← This file
```

---

## Part 5 — Known Issues & Tech Debt

| Issue | Severity | Notes |
|---|---|---|
| Offset pagination | Medium | `GET /chat/history` uses `OFFSET` which degrades under concurrent inserts. `MessageRepository` already has `before_id` cursor logic internally — just needs exposing via API param. |
| `user_session` not auto-populated on login | Low | Sessions are not inserted on login. Login endpoint should add a `UserSession` row with `user_agent` + `ip_address`. |
| `MentionAutocomplete` not wired | Low | UI component exists and renders but mentions are not stored in DB or wired to notification system. |
| `message.is_silent` not enforced | Low | Column exists and is stored but recipient notification suppression is not implemented. |
| Privacy not enforced in API | Medium | `user_privacy` table values are saved but never read when serving `GET /users/{id}` or in `message.send`. |
| `last_seen_at` never written | Low | Column exists but no code updates it on WS disconnect. |
| Link preview on historical messages | Low | `link_preview` worker only runs on new messages. History endpoint doesn't join `link_preview` table yet. |
| No refresh token | Medium | `access_token` expires per `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30min). No silent refresh — users get logged out. |
| SQLite not production-grade | Medium | Async SQLite works fine for development but lacks concurrent write performance. Migration to PostgreSQL recommended before real user load. `asyncpg` is already commented out in `requirements.txt`. |
| Disappearing timer is sender-side only | Low | Timer preference is stored per-sender. Both participants in a DM need to agree for true mutual disappearing messages. |

---

*Generated automatically from codebase audit — 2026-02-14*
