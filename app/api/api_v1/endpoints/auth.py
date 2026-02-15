from datetime import timedelta
from typing import Any, List
import re
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete
from sqlalchemy.sql import func as sql_func
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, User as UserSchema, UserSessionSchema
from app.models.user import UserSession
from app.ws.manager import manager
from app.schemas.ws_events import WSEvent


def _generate_username(base: str, existing: set) -> str:
    """Generate a unique username from base string."""
    # Clean: lowercase, replace non-alphanumeric with underscore
    cleaned = re.sub(r'[^a-z0-9]', '_', base.lower()).strip('_')
    cleaned = re.sub(r'_+', '_', cleaned)[:20] or "user"
    candidate = cleaned
    n = 1
    while candidate in existing:
        candidate = f"{cleaned}{n}"
        n += 1
    return candidate

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

@router.post("/login/access-token", response_model=Token)
@limiter.limit("5/minute")
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            {"sub": str(user.id)}, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/signup", response_model=UserSchema)
@limiter.limit("5/minute")
async def create_user_signup(
    request: Request,
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user without the need to be logged in
    """
    result = await db.execute(select(User).filter(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )

    # Determine username
    desired_username = user_in.username
    if desired_username:
        desired_username = re.sub(r'[^a-z0-9_]', '', desired_username.lower())[:30]
        existing_result = await db.execute(select(User).filter(User.username == desired_username))
        if existing_result.scalars().first():
            raise HTTPException(status_code=400, detail="Username already taken")
        final_username = desired_username
    else:
        # Auto-generate from email local part
        email_local = user_in.email.split('@')[0]
        all_usernames_result = await db.execute(select(User.username))
        existing_set = {row[0] for row in all_usernames_result.fetchall() if row[0]}
        final_username = _generate_username(email_local, existing_set)

    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        username=final_username,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Broadcast User Creation
    user_data = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "username": user.username,
        "is_active": user.is_active
    }
    event = WSEvent(
        event="user.created",
        data=user_data
    )
    await manager.broadcast(event)

    return user


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=List[UserSessionSchema])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List all active (non-revoked) sessions for the current user."""
    result = await db.execute(
        select(UserSession)
        .where(UserSession.user_id == current_user.id, UserSession.revoked_at.is_(None))
        .order_by(UserSession.last_active_at.desc())
    )
    return result.scalars().all()


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Revoke a specific session (log out that device)."""
    result = await db.execute(
        select(UserSession).where(UserSession.id == session_id, UserSession.user_id == current_user.id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = sql_func.now()
    await db.commit()


@router.delete("/sessions", status_code=204)
async def revoke_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Revoke all sessions for the current user (log out all devices)."""
    await db.execute(
        sa_delete(UserSession).where(UserSession.user_id == current_user.id)
    )
    await db.commit()
