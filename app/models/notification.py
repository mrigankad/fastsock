from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base


class Notification(Base):
    __tablename__ = "notification"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)           # mention/dm/reaction/call
    message_id = Column(Integer, ForeignKey("message.id", ondelete="SET NULL"), nullable=True)
    from_user_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    from_user = relationship("User", foreign_keys=[from_user_id])
