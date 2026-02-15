"""
Background worker: delete messages whose expires_at has passed.
Runs every 60 seconds via APScheduler.
Broadcasts 'message.delete' WS events so connected clients remove them live.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.models.message import Message
from app.ws.manager import manager
from app.schemas.ws_events import WSEvent

logger = logging.getLogger("fastsock.workers.disappearing")


async def delete_expired_messages() -> None:
    """Delete all messages where expires_at <= now() and broadcast removals."""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        # Fetch expired messages so we can broadcast their IDs
        result = await db.execute(
            select(Message.id, Message.sender_id, Message.receiver_id, Message.room_id)
            .where(Message.expires_at.isnot(None), Message.expires_at <= now)
        )
        rows = result.all()
        if not rows:
            return

        ids = [r.id for r in rows]
        logger.info("Deleting %d expired message(s): %s", len(ids), ids)

        await db.execute(delete(Message).where(Message.id.in_(ids)))
        await db.commit()

    # Broadcast deletions — best-effort
    for row in rows:
        try:
            recipient_ids: list[int] | None = None
            if row.receiver_id:
                recipient_ids = list({row.sender_id, row.receiver_id})
            await manager.broadcast(
                WSEvent(
                    event="message.delete",
                    data={"id": row.id},
                    recipient_ids=recipient_ids,
                )
            )
        except Exception:
            pass
