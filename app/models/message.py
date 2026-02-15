from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SqlEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base_class import Base

class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    SYSTEM = "system"

class Message(Base):
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    sender_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("chatroom.id"), nullable=True)

    message_type = Column(SqlEnum(MessageType), default=MessageType.TEXT)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)
    status = Column(String, default="sent")  # sent, delivered, read
    reactions = Column(JSON, default=dict, nullable=False)

    # v2 fields
    reply_to_id = Column(Integer, ForeignKey("message.id"), nullable=True)
    forwarded_from = Column(Integer, ForeignKey("message.id"), nullable=True)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_silent = Column(Boolean, default=False)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    reply_to = relationship("Message", foreign_keys=[reply_to_id], remote_side="Message.id")


class DisappearingTimer(Base):
    """Per-conversation disappearing message timer preference."""
    __tablename__ = "disappearing_timer"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    # target: either a DM partner user_id or a room_id
    target_type = Column(String, nullable=False)  # 'dm' | 'room'
    target_id = Column(Integer, nullable=False)
    # duration in seconds; 0 = disabled
    duration_seconds = Column(Integer, nullable=False, default=0)


class LinkPreview(Base):
    __tablename__ = "link_preview"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("message.id", ondelete="CASCADE"), unique=True, nullable=False)
    url = Column(String, nullable=False)
    title = Column(String, nullable=True)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    site_name = Column(String, nullable=True)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

    message = relationship("Message", foreign_keys=[message_id])
