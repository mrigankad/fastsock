import re
from typing import Any, List
import bleach
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete


def _sanitize(text: str, max_len: int) -> str:
    """Strip all HTML tags from user-supplied text fields."""
    return bleach.clean(text, tags=[], strip=True)[:max_len]

from app.api import deps
from app.core import security
from app.db.session import get_db
from app.models.user import User, UserPrivacy, UserBlock
from app.schemas.user import (
    User as UserSchema, UserUpdate,
    UserPrivacySchema, UserPrivacyUpdate,
    ChangePassword,
)
from app.ws.manager import manager
from app.schemas.ws_events import WSEvent

router = APIRouter()

@router.get("/search", response_model=List[UserSchema])
async def search_users(
    q: str = "",
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Search users by username, full_name, or display_name.
    Prepend '@' to search by username specifically.
    """
    if not q.strip():
        return []

    query = q.strip().lstrip('@').lower()
    result = await db.execute(
        select(User).where(
            or_(
                User.username.ilike(f"%{query}%"),
                User.full_name.ilike(f"%{query}%"),
                User.display_name.ilike(f"%{query}%"),
            )
        ).limit(limit)
    )
    return result.scalars().all()

@router.get("/", response_model=List[UserSchema])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve users.
    """
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    return users

@router.get("/me", response_model=UserSchema)
async def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.get("/{user_id}", response_model=UserSchema)
async def read_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get user by ID.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/me", response_model=UserSchema)
async def update_profile(
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update current user profile.
    """
    if user_in.username is not None:
        cleaned = re.sub(r'[^a-z0-9_]', '', user_in.username.lower())[:30]
        if cleaned != current_user.username:
            existing = await db.execute(select(User).where(User.username == cleaned))
            if existing.scalars().first():
                raise HTTPException(status_code=400, detail="Username already taken")
            current_user.username = cleaned
    if user_in.bio is not None:
        current_user.bio = _sanitize(user_in.bio, 200)
    if user_in.display_name is not None:
        current_user.display_name = _sanitize(user_in.display_name, 80)
    if user_in.avatar_url is not None:
        current_user.avatar_url = user_in.avatar_url
    if user_in.status_message is not None:
        current_user.status_message = _sanitize(user_in.status_message, 120)
    if user_in.presence_status is not None:
        valid = {"available", "busy", "dnd", "away"}
        if user_in.presence_status in valid:
            current_user.presence_status = user_in.presence_status

    await db.commit()
    await db.refresh(current_user)

    update_event = WSEvent(
        event="user.updated",
        data={
            "id": current_user.id,
            "username": current_user.username,
            "bio": current_user.bio,
            "display_name": current_user.display_name,
            "avatar_url": current_user.avatar_url,
            "status_message": current_user.status_message,
            "presence_status": current_user.presence_status,
            "full_name": current_user.full_name,
            "email": current_user.email,
        }
    )
    await manager.broadcast(update_event)

    return current_user


# ── Account deletion ─────────────────────────────────────────────────────────

@router.delete("/me", status_code=204)
async def delete_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Permanently delete the current user's account and all their data."""
    await db.delete(current_user)
    await db.commit()


# ── Change password ───────────────────────────────────────────────────────────

@router.post("/me/change-password", status_code=204)
async def change_password(
    body: ChangePassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    if not security.verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.hashed_password = security.get_password_hash(body.new_password)
    await db.commit()


# ── Privacy settings ──────────────────────────────────────────────────────────

VALID_VISIBILITY = {"everyone", "contacts", "nobody"}

@router.get("/me/privacy", response_model=UserPrivacySchema)
async def get_privacy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(select(UserPrivacy).where(UserPrivacy.user_id == current_user.id))
    privacy = result.scalars().first()
    if not privacy:
        return UserPrivacySchema()
    return privacy


@router.patch("/me/privacy", response_model=UserPrivacySchema)
async def update_privacy(
    body: UserPrivacyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(select(UserPrivacy).where(UserPrivacy.user_id == current_user.id))
    privacy = result.scalars().first()
    if not privacy:
        privacy = UserPrivacy(user_id=current_user.id)
        db.add(privacy)

    if body.show_last_seen is not None and body.show_last_seen in VALID_VISIBILITY:
        privacy.show_last_seen = body.show_last_seen
    if body.show_avatar is not None and body.show_avatar in VALID_VISIBILITY:
        privacy.show_avatar = body.show_avatar
    if body.show_bio is not None and body.show_bio in VALID_VISIBILITY:
        privacy.show_bio = body.show_bio
    if body.allow_dms is not None and body.allow_dms in VALID_VISIBILITY:
        privacy.allow_dms = body.allow_dms
    if body.show_read_receipts is not None:
        privacy.show_read_receipts = body.show_read_receipts

    await db.commit()
    await db.refresh(privacy)
    return privacy


# ── Blocking ──────────────────────────────────────────────────────────────────

@router.get("/blocked", response_model=List[UserSchema])
async def get_blocked_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(
        select(User)
        .join(UserBlock, UserBlock.blocked_id == User.id)
        .where(UserBlock.blocker_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/{user_id}/block", status_code=204)
async def block_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    target = await db.execute(select(User).where(User.id == user_id))
    if not target.scalars().first():
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.execute(
        select(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id)
    )
    if not existing.scalars().first():
        db.add(UserBlock(blocker_id=current_user.id, blocked_id=user_id))
        await db.commit()


@router.delete("/{user_id}/block", status_code=204)
async def unblock_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    await db.execute(
        delete(UserBlock).where(UserBlock.blocker_id == current_user.id, UserBlock.blocked_id == user_id)
    )
    await db.commit()
