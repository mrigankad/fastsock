# FastSock — Features To Be Added

This file is a practical backlog of features and hardening work that will make FastSock feel like a complete, production-ready chat product.

## Priorities
- **P0**: Security/correctness must-haves (blockers for real users)
- **P1**: Core chat experience (expected in modern apps)
- **P2**: Advanced product features (high value, higher effort)
- **P3**: Long-term scale/ops polish

## P0 — Security & Correctness
- [ ] Enforce room membership checks for room history APIs (`/history/room/{room_id}`).
- [ ] Enforce room privacy for *all* room-scoped WebSocket events (no “broadcast to everyone” fallbacks).
- [ ] Add “mark as read” support for rooms (update `last_read_at`) to make unread counts trustworthy.
- [ ] Secure file uploads:
  - [ ] Require authentication for uploads.
  - [ ] Validate allowed content types and enforce max upload size.
  - [ ] Ensure upload directory exists on startup and handle failures cleanly.
- [ ] Add abuse protection for WebSocket signaling and chat events (rate limits for invite spam / large payloads).

## P1 — Core Messaging Experience
- [ ] Read receipts (per-message read status) with a `message.read` event and UI.
- [ ] Typing indicators with throttling/debouncing on the client.
- [ ] Message acknowledgement + delivery states (e.g., Sending → Sent → Delivered).
- [ ] Better group creation UX (modal + member picker instead of prompts).
- [ ] Message edit/delete UX (context menu + optimistic updates).
- [ ] Infinite scroll for message history (load older messages on scroll-up).
- [ ] Browser notifications for new messages when the app is unfocused.
- [ ] WebSocket reconnect UX (exponential backoff + “Disconnected/Reconnecting” UI state).

## P2 — Rich Features
- [ ] File/image sharing end-to-end:
  - [ ] Attachments UI + previews in chat bubbles.
  - [ ] Message “type” support for images/files.
  - [ ] Upload progress and failure retry UX.
- [ ] Message reactions persisted in the backend and synchronized in real time.
- [ ] Message search (server-side query + UI).
- [ ] User profile enhancements (avatar, display name, status message).

## P3 — Calls, Deployment, and Quality
- [ ] Video calling polish:
  - [ ] Missed call history + call timeline per conversation.
  - [ ] Busy/offline handling and better ringing states.
  - [ ] TURN integration for reliability (avoid hardcoding secrets).
- [ ] Group calling path (SFU-based) with FastSock as authenticated call control plane.
- [ ] Testing expansion:
  - [ ] Backend: auth, chat CRUD, WebSocket event authorization, uploads.
  - [ ] Frontend: auth flows, message rendering, reconnect behavior.
- [ ] Production deployment add-ons (optional):
  - [ ] Kubernetes/Cloud Run manifests.
  - [ ] Observability (structured logging, metrics, tracing).
