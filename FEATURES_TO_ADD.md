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
  - [ ] Observability (structured logging, metrics, tracing) using OSS stacks (Prometheus + Grafana AGPL, Loki or OpenSearch).
  - [ ] Use Valkey (Redis-compatible) for Pub/Sub to avoid non-OSI Redis versions.
  - [ ] Use Coturn for TURN server in WebRTC deployments.

## Telecom Integration — SMS/Voice/Webhooks

### P0 — Infrastructure & Security
- [ ] Deploy Jasmin SMS Gateway (or Kannel if modem support is needed) behind the reverse proxy.
- [ ] Configure SMPP connector(s) and credentials via environment/secret manager (no secrets in logs).
- [ ] Deploy Asterisk with ARI enabled and a single SIP trunk; lock down management interfaces, SIP over TLS.
- [ ] Add internal APIs `/v1/messages` and `/v1/calls` (JWT + per-project API keys, Redis-backed rate limits).
- [ ] Implement webhook ingress endpoints for SMS delivery reports and call events with HMAC verification + IP allowlist.
- [ ] Normalize events and persist to Postgres (idempotent upserts by provider IDs).
- [ ] Usage counters aggregator for SMS segments and call minutes (daily per project).

### P1 — SMS Features
- [ ] Outbound SMS send via Jasmin HTTP API; store message SID and provider IDs.
- [ ] Inbound SMS receive → route to user/room with server-side rules; persist message.
- [ ] Delivery status syncing: queued/sent/delivered/failed with retries and idempotency keys.
- [ ] Basic MMS media pass-through stored in MinIO (AGPL); link media URLs in messages.

### P1 — Voice (IVR/Call Flow)
- [ ] Call Orchestrator using Asterisk ARI (WebSocket) to drive flows: `say`, `gather`, `dial`, `hangup`.
- [ ] Store call sessions, recordings, and timeline events; expose `/v1/calls/{sid}` for status.
- [ ] Minimal JSON flow DSL support; versioned `call_flows` table with active flag.

### P2 — Scale & Resilience
- [ ] Outbox pattern for DB→Bus publishing; dead-letter queues for poison messages.
- [ ] Adopt Kafka for durable event history and replay; keep Redis Streams for lightweight commands.
- [ ] Multi-trunk failover and health checks (least-cost routing later).
- [ ] Optional SIP proxy (Kamailio/OpenSIPS) when scaling PBX horizontally.
- [ ] Observability dashboards for connectors: queue depth, send rate, error rate, latencies.

### P2 — Optional Messaging
- [ ] Pilot Matrix (Synapse) or XMPP (Prosody) for WhatsApp-style messaging; bridge to app UI.

### P3 — Admin & Developer Experience
- [ ] Number/connector registry management UI; per-project routing and limits.
- [ ] Rate limit policy management and circuit breaker controls.
- [ ] Thin internal SDKs (FastAPI/Node) wrapping `/v1/messages` and `/v1/calls`.
- [ ] Visual call flow designer (optional) backed by the JSON DSL.
