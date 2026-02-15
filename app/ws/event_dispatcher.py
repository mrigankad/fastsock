"""
EventDispatcher — registry-based WebSocket event router.

Replaces the monolithic if/elif chain in ws.py.
Each handler module registers itself with @dispatcher.register("event.name").
"""
from __future__ import annotations
import logging
from typing import Callable, Any
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import WebSocket
from app.ws.manager import ConnectionManager

logger = logging.getLogger(__name__)


class EventDispatcher:
    """Maps event type strings to async handler functions."""

    def __init__(self) -> None:
        self._handlers: dict[str, Callable] = {}

    def register(self, event_type: str):
        """Decorator: @dispatcher.register('message.send')"""
        def decorator(fn: Callable) -> Callable:
            self._handlers[event_type] = fn
            return fn
        return decorator

    async def dispatch(
        self,
        event_type: str,
        data: dict,
        user_id: int,
        websocket: WebSocket,
        db: AsyncSession,
        manager: ConnectionManager,
        **ctx: Any,
    ) -> None:
        handler = self._handlers.get(event_type)
        if handler is None:
            logger.warning("No handler registered for event: %s", event_type)
            await websocket.send_json({"error": f"Unknown event: {event_type}"})
            return
        try:
            await handler(
                data=data,
                user_id=user_id,
                websocket=websocket,
                db=db,
                manager=manager,
                **ctx,
            )
        except Exception:
            logger.exception("Error in handler for %s", event_type)
            await websocket.send_json({"event": "error", "data": {"message": "Internal error"}})


# Singleton shared across the app
dispatcher = EventDispatcher()
