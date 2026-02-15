from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str
    username: Optional[str] = None  # if omitted, auto-generated from email

class UserUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status_message: Optional[str] = None
    presence_status: Optional[str] = None  # available, busy, dnd, away

class UserInDBBase(UserBase):
    id: Optional[int] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status_message: Optional[str] = None
    presence_status: Optional[str] = "available"

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str


# ── Privacy ──────────────────────────────────────────────────────────────────

class UserPrivacySchema(BaseModel):
    show_last_seen: str = "everyone"
    show_avatar: str = "everyone"
    show_bio: str = "everyone"
    allow_dms: str = "everyone"
    show_read_receipts: bool = True

    class Config:
        from_attributes = True


class UserPrivacyUpdate(BaseModel):
    show_last_seen: Optional[str] = None
    show_avatar: Optional[str] = None
    show_bio: Optional[str] = None
    allow_dms: Optional[str] = None
    show_read_receipts: Optional[bool] = None


# ── Session ───────────────────────────────────────────────────────────────────

class UserSessionSchema(BaseModel):
    id: str
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Change-password ───────────────────────────────────────────────────────────

class ChangePassword(BaseModel):
    current_password: str
    new_password: str
