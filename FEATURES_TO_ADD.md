# FastSock — Features To Be Added

This file is a practical backlog of features and hardening work that will make FastSock feel like a complete, production-ready chat product. Updated with market research against WhatsApp, Telegram, Slack, Discord, and Signal (2025–2026), plus a full codebase audit.

## Priority Tiers
- **P0**: Security / correctness blockers
- **P1**: Table-stakes — every serious chat app has these (users will notice their absence)
- **P2**: Differentiating — make FastSock feel polished and modern
- **P3**: Power features — high value, meaningful engineering effort
- **P4**: Long-term platform plays

---

## Open-Source Dependency Audit ✅

All dependencies are **100% open-source with permissive licenses**. Zero proprietary packages.

### Backend (Python)
| Package | License | Purpose |
|---|---|---|
| FastAPI | MIT | Web framework |
| Uvicorn | BSD | ASGI server |
| Gunicorn | MIT | Process manager |
| SQLAlchemy | MIT | ORM |
| Alembic | MIT | DB migrations |
| aiosqlite | MIT | Async SQLite driver |
| redis | BSD-3 | Pub/sub & caching |
| python-jose + cryptography | MIT + Apache 2.0 | JWT tokens |
| passlib[bcrypt] | BSD | Password hashing |
| pydantic-settings | MIT | Config management |
| python-multipart | Apache 2.0 | File upload parsing |
| email-validator | CC0 (Public Domain) | Email validation |
| slowapi | MIT | Rate limiting |
| bleach | Apache 2.0 | HTML sanitization |
| beautifulsoup4 | MIT | OG metadata scraping for link previews |
| httpx | BSD | HTTP client (tests + link preview fetcher) |
| apscheduler | MIT | Background job scheduler (disappearing messages) |
| pytest + pytest-asyncio | MIT + Apache 2.0 | Testing |

### Frontend (JavaScript/TypeScript)
| Package | License | Purpose |
|---|---|---|
| React 19 + React DOM | MIT | UI framework |
| React Router DOM | MIT | Client routing |
| Vite + @vitejs/plugin-react | MIT | Build tool |
| TypeScript | Apache 2.0 | Type safety |
| TailwindCSS v4 | MIT | Utility CSS |
| Axios | MIT | HTTP client |
| Zustand | MIT | Real-time WS state (messageStore, presenceStore) |
| @tanstack/react-query | MIT | Server state management |
| date-fns | MIT | Date formatting |
| lucide-react | ISC | Icons |
| emoji-picker-react | MIT | Emoji picker |
| react-hot-toast | MIT | Toast notifications |
| clsx + tailwind-merge | MIT | CSS class utilities |

> **Note on future additions:** When adding new dependencies, prefer libraries with MIT, Apache 2.0, BSD, or ISC licenses. Avoid GPL (viral license), AGPL, CC-BY-NC (non-commercial), or any proprietary SDK. Recommended open-source alternatives for upcoming features are listed in each section below.

---

## Implementation Status

> Legend: ✅ Fully working | ⚠️ DB/schema ready, API or frontend wiring pending | ❌ Not built

<details>
<summary>Click to expand full implementation audit</summary>

### Architecture & Infrastructure
- ✅ Domain-Driven Design: `app/domain/messaging/` — `MessageRepository` + `MessageService` (send, edit, delete, react, read receipts)
- ✅ Registry-based `EventDispatcher` (`app/ws/event_dispatcher.py`) — replaces 374-line monolithic `ws.py` if/elif chain
- ✅ WebSocket handler modules: `app/ws/handlers/messaging.py`, `presence.py`, `calls.py`
- ✅ `ws.py` reduced to 82-line thin accept/auth/dispatch loop
- ✅ HTTP endpoints for edit/delete/react delegate to `MessageService` (no duplicated logic)
- ✅ TanStack Query installed; `QueryClientProvider` wrapping app root
- ✅ Zustand `messageStore` (real-time WS messages) + `presenceStore` (online/typing state)
- ✅ `useWSEventBus` hook — single WS→store event router mounted in ChatPage; handles 16 event types
- ✅ TanStack Query hooks: `useMessages`, `useRooms`, `useUsers`
- ✅ GitHub Actions CI/CD: `.github/workflows/ci.yml` (lint + test + tsc + build + Docker push on main)
- ✅ GitHub Actions release: `.github/workflows/release.yml` (versioned Docker images + GitHub Release on `v*.*.*`)
- ✅ Kubernetes manifests (`k8s/`)
- ✅ Alembic migrations 001–011; current head at `011_disappearing_messages`
- ✅ Structured JSON logging + request timing middleware + `/health` endpoint
- ✅ Redis pub/sub for WS broadcasting (with in-memory fallback)
- ✅ Background workers: `app/workers/link_preview.py` (fire-and-forget OG fetch), `app/workers/disappearing.py` (delete expired messages every 60s)
- ✅ APScheduler (`app/workers/scheduler.py`) started in `main.py` lifespan

### Security & Correctness
- ✅ Room membership checks for room history APIs
- ✅ Room privacy for all room-scoped WebSocket events
- ✅ Mark-as-read for rooms (unread counts via `last_read_at`)
- ✅ Authenticated file uploads with content-type validation and size limits
- ✅ Authenticated audio uploads with content-type validation and 10 MB size limit
- ✅ Rate limiting on auth endpoints (slowapi) and WebSocket events (30 msgs/10s, 3 call invites/30s)
- ✅ Input length validation (4000 char messages)
- ✅ HTML sanitization via `bleach` — message content, bio, display_name, status_message, room name all stripped on ingest
- ✅ Group role-based permission checks — `PATCH /chat/rooms/{id}` and kick require `admin`/`owner`
- ✅ Slow mode enforced per-user in WS `message.send` handler — checks `chatroom.slow_mode_seconds` against sender's last message timestamp

### Core Messaging
- ✅ Real-time WebSocket messaging (full lifecycle, all event types)
- ✅ Typing indicators with debouncing
- ✅ Message delivery states: sent → delivered → read (DB-persisted, WS events)
- ✅ Message edit and delete (DB + real-time broadcast, via MessageService)
- ✅ Infinite scroll / offset-paginated message history
- ✅ WebSocket reconnect with exponential backoff + connection status UI
- ✅ Reply to specific messages (quoted reply, `reply_to_id` stored in DB — migration 008)
- ✅ Unread message counts per DM and room
- ✅ Message drafts — unsent composer text auto-saved per-conversation in `localStorage`; restored on navigation
- ✅ Disappearing messages — per-conversation timer in `disappearing_timer` table; `DisappearingTimerMenu` in header; APScheduler job deletes expired rows every 60s; `message.delete` WS events broadcast to participants
- ⚠️ `message.forwarded_from` — DB column added (migration 008), no forwarding UI yet
- ⚠️ `message.is_silent` — DB column added (migration 008), no backend enforcement yet
- ⚠️ Browser push notifications — works only when tab is **open** (Notification API, not Service Worker)

### Rich Messaging
- ✅ File and image sharing (upload + inline previews)
- ✅ Voice messages — `MediaRecorder` API; `POST /utils/upload/audio`; `message_type: 'audio'`; `AudioMessage` bubble with play/pause + seek slider
- ✅ Message reactions (JSON stored in DB, real-time sync via MessageService)
- ✅ Server-side message search (ILIKE across accessible rooms/DMs)
- ✅ Message pinning (DB-backed, scoped per DM or room, REST + WS)
- ✅ Bookmarks / saved messages with optional notes
- ✅ Link previews — fire-and-forget OG fetch; `link_preview` table; `message.link_preview` WS event; `LinkPreviewCard` in bubble
- ⚠️ Rich text formatting — markdown rendered in **frontend** only; messages stored as plain strings
- ⚠️ @mention autocomplete — UI component exists (`MentionAutocomplete.tsx`), not stored in DB or wired to notifications

### User Identity & Presence
- ✅ User profiles: avatar URL, display name, status message
- ✅ Unique @username (unique DB index, auto-generated from email on signup)
- ✅ Bio field
- ✅ Presence status: Available / Busy / DND / Away (DB-persisted)
- ✅ Online/offline tracking (WebSocket connect/disconnect events)
- ✅ StatusDot presence indicators in sidebar and user lists
- ✅ Find People modal (real-time user search by @username or name)
- ✅ User profile modal (avatar, bio, @username, presence, "Message" button)
- ✅ Settings page at `/settings`:
  - Account tab: edit display_name, @username, bio, status, avatar_url + **Danger Zone** (delete account)
  - Privacy tab: visibility selectors wired to `GET/PATCH /users/me/privacy`
  - Appearance tab: dark mode toggle
  - Sessions tab: list active sessions + revoke individual / all
- ✅ `user.last_seen_at` + `user.email_verified` columns (migration 007)
- ✅ Privacy API — `GET/PATCH /users/me/privacy` fully wired
- ✅ User blocking — `POST/DELETE /users/{id}/block` + `GET /users/blocked`
- ✅ Session management — `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `DELETE /auth/sessions`
- ✅ Change password — `POST /users/me/change-password`
- ✅ Account deletion — `DELETE /users/me` cascade; Danger zone UI in Account tab
- ⚠️ `user_contact` table created (migration 007) — no contacts API yet
- ❌ Privacy enforcement — `show_last_seen`, `show_bio`, `allow_dms` columns exist but not enforced in API responses or WS handler

### Groups & Rooms
- ✅ Group chat room creation with member picker
- ✅ `chatroom_member` table with `last_read_at` tracking
- ✅ Group PATCH — `PATCH /chat/rooms/{id}` updates name/description/avatar/slow_mode (admin/owner only); broadcasts `room.updated`
- ✅ Kick member — `DELETE /chat/rooms/{id}/members/{user_id}` (admin/owner only); broadcasts `room.member_removed`
- ✅ Group invite links — `POST /chat/rooms/{id}/invite` generates token; `GET /chat/join/{token}` validates + joins; use-count + expiry enforced
- ✅ Slow mode — `chatroom.slow_mode_seconds` enforced per-user in WS handler
- ✅ `chatroom_member.role` (owner/admin/member), `muted_until`, `notification_level` columns (migration 009)
- ⚠️ Group info panel — no frontend UI to edit group name/avatar/description yet (all APIs exist)
- ⚠️ Notification preferences per room — `notification_level` column exists, no `PATCH /chat/rooms/{id}/members/me` endpoint yet

### Notifications
- ✅ In-app notification center — `notification` table; `GET/POST /chat/notifications/*` endpoints
- ✅ DM notifications auto-created in `MessageService.send` (`type="dm"`)
- ✅ `notification.new` WS event pushed to recipient → badge updates instantly
- ✅ `NotificationBell` component in sidebar header — badge count, dropdown panel, "Mark all read"
- ✅ `useUnreadNotificationCount` + `useNotifications` TanStack Query hooks (30s polling + WS invalidation)
- ❌ Mention notifications — `@mention` autocomplete exists but not wired to notification system
- ❌ PWA / Service Worker background push
- ❌ Email notifications (offline digest)

### Calls
- ✅ 1-on-1 voice/video call signaling via WebSocket (invite/accept/reject/hangup, via calls handler module)
- ✅ `call_session` table with status tracking
- ✅ Busy/DND blocking
- ✅ TURN server config via env var
- ❌ Group calls (3+ participants)
- ❌ Screen sharing
- ❌ Right Panel call timeline (placeholder only)

</details>

---

## P0 — Security & Auth (Blockers)

- [ ] **Password reset via email** — "Forgot password" flow. Signed reset token, expires 1 hour. `POST /auth/forgot-password` + `POST /auth/reset-password`.
  - Backend: [`fastapi-mail`](https://github.com/sabuhish/fastapi-mail) (MIT) + existing `python-jose`
- [ ] **Email verification on signup** — Send confirmation link; block login until verified. `user.email_verified` column already exists.
  - Backend: [`fastapi-mail`](https://github.com/sabuhish/fastapi-mail) (MIT)
- [ ] **Two-factor authentication (2FA)** — TOTP (Google Authenticator / Aegis / Authy compatible). `user.totp_secret` + `user.totp_enabled` columns already in schema.
  - Backend: [`pyotp`](https://github.com/pyauth/pyotp) (MIT) + [`qrcode`](https://github.com/lincolnloop/python-qrcode) (MIT)
- [ ] **Privacy enforcement** — Enforce `user_privacy.show_last_seen`, `show_bio`, `allow_dms` in `GET /users/{id}` and `message.send` WS handler. Columns exist since migration 007 — enforcement is the remaining work (~1h).
- [ ] **Content reporting** — `report` table + `POST /reports` endpoint. Flag messages or users.

---

## P1 — Table-Stakes Missing Features

### Messaging
- [ ] **Message forwarding UI** — `message.forwarded_from` DB column added (migration 008). Needs: conversation picker modal + WS `message.forward` handler + "Forwarded" label in bubble.
- [ ] **@mention wiring** — `MentionAutocomplete.tsx` UI exists. Needs: store mentions in DB (`message.mentions` JSON, migration 012), trigger `Notification(type="mention")` in `MessageService`, highlight `@username` in `MessageBubble`.
- [ ] **Silent messages** — `message.is_silent` column added (migration 008). Needs: composer toggle → WS event → recipient suppresses notification sound.
- [ ] **Offline message queue** — Queue messages in `localStorage` while disconnected; flush on WS reconnect. Pure frontend.
- [ ] **Note to Self / Saved Messages** — Special DM where `sender_id === receiver_id`; pinned at top of sidebar.

### Auth & Sessions
- [ ] **Token refresh** — Silent 401 intercept in axios → re-issue token. Prevents users being silently logged out after 30min.
- [ ] **Auto-populate UserSession on login** — Login endpoint should insert a `UserSession` row with `user_agent` + `ip_address`. Sessions tab currently shows empty.

### Groups — Frontend Wiring
> *All DB schema + API endpoints are in place. These items only need frontend UI.*

- [ ] **Group info panel** — Slide-in panel on group header click. Edit name, description, avatar via `PATCH /chat/rooms/{id}`. Share invite link (already generated by `POST /chat/rooms/{id}/invite`).
- [ ] **Member list in group** — Show members with role badges; admin can kick via `DELETE /chat/rooms/{id}/members/{user_id}`.
- [ ] **Notification mute toggle** — Per-room mute bell using `notification_level`. Needs new `PATCH /chat/rooms/{id}/members/me` endpoint.

### User & Identity
- [ ] **Contacts / friends list** — `user_contact` table exists (migration 007). `POST /users/{id}/contacts`, `GET /users/contacts`. Contacts section in sidebar.
- [ ] **OAuth / SSO login** — Sign in with Google / GitHub.
  - Backend: [`Authlib`](https://github.com/lepture/authlib) (BSD)
- [ ] **Profile QR code** — Scannable QR encoding `@username` profile URL.
  - Frontend: [`react-qr-code`](https://github.com/rosskhanas/react-qr-code) (MIT)
- [ ] **Chat folders** — User-defined conversation folders with drag-to-sort.
  - Frontend: [`@dnd-kit/core`](https://github.com/clauderic/dnd-kit) (MIT)

### Notifications
- [ ] **PWA / Service Worker push** — Full background push when tab is closed.
  - Frontend: [`workbox`](https://github.com/GoogleChrome/workbox) (MIT)
  - Backend: [`pywebpush`](https://github.com/web-push-libs/pywebpush) (MIT) + `push_subscription` table
- [ ] **Email notifications** — Missed-message digest for offline users.
  - Backend: [`fastapi-mail`](https://github.com/sabuhish/fastapi-mail) (MIT) + APScheduler digest job

### Calls
- [ ] **Screen sharing** — `getDisplayMedia()` browser API; add `call.screen_share` WS event.
- [ ] **Group voice/video calls** — Multi-participant; requires SFU.
  - Backend: [mediasoup](https://github.com/versatica/mediasoup) (MIT) or [LiveKit](https://github.com/livekit/livekit) (Apache 2.0)

---

## P2 — Differentiating / Modern Polish

### Messaging
- [ ] **Scheduled messages** — Compose → schedule for future delivery. `scheduled_message` table + APScheduler (MIT).
- [ ] **View-once media** — `is_view_once` flag; client deletes after first render.
- [ ] **Message threads (Slack-style)** — `thread_id` (parent message ID) on message model; thread messages in slide-in panel.
- [ ] **Polls in group chats** — `poll` table (question, options JSON, votes JSON). `poll.vote` WS event.
- [ ] **GIF / sticker picker** — [Tenor API](https://tenor.com/gifapi) (free) or [`giphy-js`](https://github.com/Giphy/giphy-js) (MIT).
- [ ] **Emoji autocomplete in composer** — Type `:` → emoji search dropdown. [`emoji-mart`](https://github.com/missive/emoji-mart) (MIT).
- [ ] **Spoiler text** — `||hidden text||` syntax, blurred until clicked. Parser rule in `messageFormatter.ts`. No library needed.
- [ ] **Shared media gallery** — Tab in Right Panel showing all images/files/links/audio. `GET /chat/media/{type}/{id}`.
- [ ] **Voice message speed control** — 1x / 1.5x / 2x playback via `HTMLAudioElement.playbackRate`. No library needed.
- [ ] **Voice message waveform** — Visual waveform in AudioMessage bubble. [`wavesurfer.js`](https://github.com/katspaugh/wavesurfer.js) (BSD).

### User & Identity
- [ ] **Status / Stories** — 24-hour ephemeral content. `story` table (user_id, media_url, expires_at). Reuse upload endpoint.
- [ ] **Custom status with expiry** — "In a meeting until 3 PM", auto-clears.
- [ ] **`last_seen_at` tracking** — Write on WS disconnect. Show "Last seen 2h ago" in DM subtitle. Column exists, never updated.
- [ ] **Focus / DND scheduling** — Auto-set DND during defined hours.
- [ ] **Per-group nickname** — Different display name per group room. `chatroom_member.nickname` column added (migration 009).
- [ ] **Profile badges** — "Early Adopter" etc. shown on profile cards.

### Groups & Discovery
- [ ] **Public group directory** — Browse joinable public rooms. `chatroom.is_public` column added (migration 009).
- [ ] **Broadcast channels** — Admin-only posting (followers can react). `chatroom.type = 'channel'` variant.
- [ ] **Announcement-only mode** — Temporarily restrict room to admin posting.

### Media & Files
- [ ] **In-chat camera** — Device camera capture from composer (mobile-first).
- [ ] **MinIO / S3 storage backend** — Replace local `static/uploads/` with S3-compatible storage.
  - Backend: [`aioboto3`](https://github.com/terrycain/aioboto3) (Apache 2.0); Self-hosted: [MinIO](https://github.com/minio/minio) (AGPL)

---

## P3 — Power Features

### AI & Automation
- [ ] **AI conversation summary** — "Catch me up" button on unread messages.
  - Backend: [`ollama`](https://github.com/ollama/ollama) (MIT) for self-hosted LLM (llama3 / mistral)
- [ ] **AI smart replies** — 3 suggested quick replies based on last message.
- [ ] **AI message translation** — [`deep-translator`](https://github.com/nidhaloff/deep-translator) (MIT) + LibreTranslate (AGPL, self-hostable).
- [ ] **Voice message transcription** — [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper) (MIT); runs locally, no API cost.
- [ ] **AI auto-moderation** — [`detoxify`](https://github.com/unitaryai/detoxify) (Apache 2.0); local toxicity classifier.
- [ ] **Webhook integrations** — Incoming + outgoing webhooks. `webhook` table + handler in WS pipeline.
- [ ] **Bot framework** — `is_bot` flag on User; command routing to registered webhook URLs.

### Productivity
- [ ] **Calendar / event integration** — Schedule meeting from chat; send calendar event card.
- [ ] **Reminder on message** — "Remind me in 2 hours" on any message.
- [ ] **Collaborative notes per room** — Shared notepad (Slack Canvas). [`yjs`](https://github.com/yjs/yjs) (MIT) for CRDT-based real-time collab.

### Developer / Admin
- [ ] **Admin dashboard** — User list, room list, message volume, flagged content queue.
- [ ] **Audit log** — Immutable log of admin actions.
- [ ] **Message search filters** — Extend `GET /chat/search` with `sender_id`, `before`, `after`, `message_type` params.
- [ ] **Full-text search** — Replace `ILIKE` with SQLite FTS5 or PostgreSQL `tsvector`.
- [ ] **Chat data export** — Download history as JSON/ZIP (GDPR). `GET /users/me/export`.

### Performance
- [ ] **Cursor-based pagination** — Replace `offset` with `before_id` param. `MessageRepository.get_dm_history` already supports it internally — just expose via API query param.
- [ ] **Multi-device sync** — Session registry + sync-on-connect state burst. `user_session` table exists.
- [ ] **Redis required in production** — Currently optional with in-memory fallback. Add Redis health check; make required in k8s prod config.
- [ ] **Prometheus metrics** — `prometheus-fastapi-instrumentator` (ISC). Expose `fastsock_ws_connections_total`, `fastsock_messages_sent_total`, `fastsock_message_latency_seconds`.

---

## P4 — Long-Term Platform Plays

- [ ] **Native mobile apps** — [`React Native`](https://github.com/facebook/react-native) (MIT) reusing existing TypeScript types and API layer.
- [ ] **End-to-end encryption (E2EE)** — [`TweetNaCl.js`](https://github.com/dchest/tweetnacl-js) (public domain) for DMs. Signal Protocol for group.
- [ ] **Matrix bridge** — [`matrix-python-sdk`](https://github.com/matrix-org/matrix-python-sdk) (Apache 2.0); rooms accessible from Element and other Matrix clients.
- [ ] **White-label / multi-tenant** — Subdomain-based tenant routing; per-tenant branding in DB.
- [ ] **Location sharing** — Lat/lng as special message type. [`Leaflet`](https://github.com/Leaflet/Leaflet) (BSD) + OpenStreetMap tiles (ODbL).
- [ ] **AR effects in video calls** — Background blur via [`@tensorflow/tfjs`](https://github.com/tensorflow/tfjs) (Apache 2.0) + `body-segmentation`.
- [ ] **Monetization layer** — Premium subscriptions via [`stripe-python`](https://github.com/stripe/stripe-python) (MIT).

---

## Feature Gap Summary (vs. Major Platforms)

| Feature | WhatsApp | Telegram | Slack | Discord | Signal | FastSock |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| @username search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rich text formatting | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ frontend only |
| @mentions | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ UI only |
| Message reactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message edit/delete | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pinned messages | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Message bookmarks | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Link previews | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Message drafts | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Voice messages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Disappearing messages | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Presence status | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Settings / account page | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Privacy settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Session management | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| User blocking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ API |
| Change password | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Account deletion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| In-app notification center | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| HTML sanitization | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slow mode | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Group roles & permissions | ✅ | ✅ | ✅ | ✅ | partial | ✅ |
| Group invite links | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Group description / avatar | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ API |
| CI/CD pipeline | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message forwarding | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ schema |
| Spoiler text | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Silent messages | ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ schema |
| Note to Self / Saved Msgs | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Scheduled messages | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Polls | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Threads (Slack-style) | ❌ | ✅ topics | ✅ | ✅ | ❌ | ❌ |
| GIF / stickers | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Emoji autocomplete `:` | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Chat folders | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Status / Stories | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Profile QR code | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Group info panel (UI) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Group topics/sub-channels | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Broadcast channels | ✅ | ✅ | ❌ | ✅ stage | ❌ | ❌ |
| Public room directory | ❌ | ✅ | ✅ | ✅ | ❌ | ⚠️ schema |
| PWA / background push | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Email notifications | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Notification preferences | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ schema |
| Read receipt toggle | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ API |
| Last-seen privacy | ✅ | ✅ | ❌ | ❌ | ✅ | ⚠️ not enforced |
| Email verification | ✅ | ✅ | ✅ | ✅ | N/A | ❌ |
| Password reset | ✅ | ✅ | ✅ | ✅ | N/A | ❌ |
| 2FA | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| OAuth / SSO | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Screen sharing in calls | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Group calls | ✅ 32p | ✅ 100s | ✅ 50p | ✅ 25v | ✅ 50p | ❌ |
| Voice transcription | ✅ | ✅ premium | ❌ | ❌ | ❌ | ❌ |
| AI message summary | ❌ | ❌ | ✅ paid | ❌ | ❌ | ❌ |
| AI translation | ❌ | ✅ premium | ❌ | ❌ | ❌ | ❌ |
| Bot framework | limited | ✅ best | ✅ | ✅ | ❌ | ❌ |
| Webhooks | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Shared media gallery | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Custom status w/ expiry | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| E2EE default | ✅ | opt-in | ❌ | ❌ | ✅ | ❌ |
| Data export | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Domain-driven architecture | N/A | N/A | N/A | N/A | N/A | ✅ |

> **⚠️ schema** = DB table/columns exist, logic not yet wired
> **✅ API** = backend endpoint done, frontend UI pending

---

## Strategic Takeaways (2025–2026)

1. **AI features are moving from differentiator → table-stakes.** By 2026, conversation summaries, voice transcription, and auto-moderation will be expected. Slack AI is already shipping this.
2. **The privacy divide is a real market.** Signal and WhatsApp (E2EE default) vs. Telegram/Discord/Slack (server-readable). FastSock's privacy schema is in place — enforcement in API responses is the remaining work.
3. **Community > Chat.** Discord and Telegram's server/group/topics model is winning for public communities. FastSock now has roles, invite links, slow mode, and group PATCH wired. Group info UI is the last gap.
4. **Bot/automation ecosystems create lock-in.** Telegram's Bot API and Slack's App Directory are major retention drivers. A webhook + bot system should be on the P3 roadmap.
5. **Username-only identity is a growing user expectation.** Signal added it in 2024; Telegram had it for years. FastSock has full @username support.
6. **Voice messages and disappearing messages are now table-stakes.** Both are fully implemented in FastSock. WhatsApp reports the majority of its media traffic is voice messages; disappearing messages are the default in Signal.
7. **Architecture is a competitive advantage.** FastSock now has a domain-driven backend, registry-based WS dispatcher, TanStack Query + Zustand frontend, CI/CD, bleach sanitization, link previews, voice messages, disappearing messages with APScheduler, notification center, and group management — making it faster to ship new features than a monolithic competitor.
8. **Security baseline is close to production-ready.** Bleach sanitization, rate limiting, session management, user blocking, account deletion, and audio upload validation are all wired. Password reset + email verification are the remaining P0 blockers before any public launch.

---

*Research sources: [Ably — Chat Features Guide](https://ably.com/blog/chat-and-messaging-application-features), [Sceyt — Must-Have Chat Features](https://sceyt.com/blog/must-have-chat-features-for-communication-apps), [RST Software — Chat App Development 2024](https://www.rst.software/blog/chat-app-development-in-2024-must-have-features-and-those-that-add-a-competitive-edge), [DevOpsSchool — Top Messaging Apps 2025](https://www.devopsschool.com/blog/top-10-messaging-apps-in-2025-features-pros-cons-comparison/), [Zapier — Slack vs Discord](https://zapier.com/blog/slack-vs-discord/), Deep feature analysis: WhatsApp, Telegram, Slack, Discord, Signal platform documentation and changelogs (through Jan 2025)*
