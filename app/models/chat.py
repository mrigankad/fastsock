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
    
    # Relationships
    user = relationship("User", backref="chatroom_memberships")
    room = relationship("ChatRoom", back_populates="memberships")

class ChatRoom(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_group = Column(Boolean, default=True)
    
    # Updated relationship via Association Object
    memberships = relationship("ChatRoomMember", back_populates="room", cascade="all, delete-orphan")
    members = relationship("User", secondary="chatroom_member", viewonly=True)
