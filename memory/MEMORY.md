# FastSock Project Memory

## Stack
- Backend: FastAPI + SQLAlchemy async + SQLite (alembic migrations)
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Real-time: WebSocket via `app/ws/manager.py`

## Key Paths
- Backend models: `app/models/`
- Backend schemas: `app/schemas/`
- Backend endpoints: `app/api/api_v1/endpoints/`
- Migrations: `alembic/versions/` (latest: `006_username_bio.py` → `b7c4e2a9f310`)
- Frontend features: `frontend/src/features/chat/`
- Frontend components: `frontend/src/components/`
- Frontend types: `frontend/src/types/index.ts`
- Frontend API service: `frontend/src/services/api.ts`

## Bash access
- Use `/c/Users/mriga_ijtdono/Desktop/FastSock/` as path prefix in Git Bash shell

## User Model Fields (current)
id, email, hashed_password, full_name, username (unique @handle), bio, display_name, avatar_url, status_message, presence_status, is_active, is_superuser, created_at

## Features Implemented
- `username` (@handle) + `bio` on User (migration 006_username_bio.py)
- `GET /users/search?q=` - search by username/name/display_name
- `GET /users/{user_id}` - get user by ID
- Username required at signup (auto-generated from email if not provided)
- `FindPeopleModal` - search & start DM with any user
- `UserProfileModal` - view any user's profile with avatar, bio, @username
- Sidebar shows @username as subtitle + "Find People" (UserPlus) button
- ChatArea header shows @username as subtitle for DMs
