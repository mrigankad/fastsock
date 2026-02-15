from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, UniqueConstraint
from sqlalchemy.sql import func
from app.db.base_class import Base


class PinnedMessage(Base):
    """A message pinned in a conversation (DM or room)."""
    __tablename__ = "pinned_message"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("message.id", ondelete="CASCADE"), nullable=False, index=True)
    pinned_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    # Scope: either a room_id or a dm between two users (encoded as "dm:{min_id}:{max_id}")
    scope = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("message_id", "scope", name="uq_pinned_message_scope"),
    )


class BookmarkedMessage(Base):
    """A message bookmarked/saved by a user for later review."""
    __tablename__ = "bookmarked_message"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("message.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_bookmark_user_message"),
    )
