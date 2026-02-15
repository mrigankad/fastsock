"""
APScheduler instance shared across the app.
Import `scheduler` and call start() / shutdown() in main.py lifespan.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone="UTC")


def setup_jobs() -> None:
    """Register all periodic background jobs."""
    from app.workers.disappearing import delete_expired_messages

    # Delete expired (disappearing) messages every 60 seconds
    scheduler.add_job(
        delete_expired_messages,
        trigger="interval",
        seconds=60,
        id="delete_expired_messages",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
