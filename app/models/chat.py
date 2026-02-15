from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Table, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

# Enhanced Association table with metadata
class ChatRoomMember(Base):
    __tablename__ = "chatroom_member"

    chatroom_id = Column(Integer, ForeignKey("chatroom.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_read_at = Column(DateTime(timezone=True), server_default=func.now())
    # v2
    role = Column(String, default="member")                   # owner/admin/member
    muted_until = Column(DateTime(timezone=True), nullable=True)
    notification_level = Column(String, default="all")        # all/mentions/nothing

    user = relationship("User", backref="chatroom_memberships")
    room = relationship("ChatRoom", back_populates="memberships")


class ChatRoom(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_group = Column(Boolean, default=True)
    # v2
    description = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_public = Column(Boolean, default=False)
    slow_mode_seconds = Column(Integer, default=0)

    memberships = relationship("ChatRoomMember", back_populates="room", cascade="all, delete-orphan")
    members = relationship("User", secondary="chatroom_member", viewonly=True)
    invite_links = relationship("RoomInviteLink", back_populates="room", cascade="all, delete-orphan")


class RoomInviteLink(Base):
    __tablename__ = "room_invite_link"

    token = Column(String, primary_key=True)
    room_id = Column(Integer, ForeignKey("chatroom.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    max_uses = Column(Integer, nullable=True)
    use_count = Column(Integer, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("ChatRoom", back_populates="invite_links")
