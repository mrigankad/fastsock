from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, User as UserSchema
from app.ws.manager import manager
from app.schemas.ws_events import WSEvent

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
            detail="The user with this username already exists in the system",
        )
        
    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
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
        "is_active": user.is_active
    }
    event = WSEvent(
        event="user.created",
        data=user_data
    )
    await manager.broadcast(event)
    
    return user
