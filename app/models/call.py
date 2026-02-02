from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class CallSession(Base):
    __tablename__ = "call_session"

    call_id = Column(String(36), primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("chatroom.id"), nullable=True)

    caller_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    callee_id = Column(Integer, ForeignKey("user.id"), nullable=False)

    status = Column(String, nullable=False, default="ringing")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    caller = relationship("User", foreign_keys=[caller_id])
    callee = relationship("User", foreign_keys=[callee_id])
    room = relationship("ChatRoom", foreign_keys=[room_id])
