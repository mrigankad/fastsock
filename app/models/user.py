from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, index=True)
    username = Column(String, unique=True, index=True, nullable=True)  # unique @handle e.g. john_doe
    bio = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    status_message = Column(String, nullable=True)
    presence_status = Column(String, default="available")  # available, busy, dnd, away
    is_active = Column(Boolean(), default=True)
    is_superuser = Column(Boolean(), default=False)
    email_verified = Column(Boolean(), default=False)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    privacy = relationship("UserPrivacy", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    blocked = relationship("UserBlock", foreign_keys="[UserBlock.blocker_id]", back_populates="blocker", cascade="all, delete-orphan")
    blocked_by = relationship("UserBlock", foreign_keys="[UserBlock.blocked_id]", back_populates="blocked", cascade="all, delete-orphan")


class UserPrivacy(Base):
    __tablename__ = "user_privacy"

    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    show_last_seen = Column(String, default="everyone")  # everyone/contacts/nobody
    show_avatar = Column(String, default="everyone")
    show_bio = Column(String, default="everyone")
    allow_dms = Column(String, default="everyone")       # everyone/contacts/nobody
    show_read_receipts = Column(Boolean, default=True)

    user = relationship("User", back_populates="privacy")


class UserSession(Base):
    __tablename__ = "user_session"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


class UserBlock(Base):
    __tablename__ = "user_block"

    blocker_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    blocked_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    blocker = relationship("User", foreign_keys=[blocker_id], back_populates="blocked")
    blocked = relationship("User", foreign_keys=[blocked_id], back_populates="blocked_by")


class UserContact(Base):
    __tablename__ = "user_contact"

    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    contact_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

