"""
WebSocket router — thin accept/auth layer.

All business logic lives in app/ws/handlers/*.py, routed via EventDispatcher.
Handler modules are imported here to trigger their @dispatcher.register() decorators.
"""
from __future__ import annotations
import json
import logging
from collections import deque
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status

from app.api import deps
from app.ws.manager import manager
from app.ws.event_dispatcher import dispatcher
from app.db.session import AsyncSessionLocal

# Import handler modules so their @dispatcher.register() decorators fire
import app.ws.handlers.messaging  # noqa: F401
import app.ws.handlers.presence   # noqa: F401
import app.ws.handlers.calls      # noqa: F401

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_EVENT_BYTES = 200_000


@router.websocket("/chat")
async def websocket_endpoint(
    websocket: WebSocket,
    current_user=Depends(deps.get_current_user_ws),
):
    if not current_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, current_user.id)

    # Per-connection rate-limit state (passed to handlers as context)
    ctx = {
        "message_timestamps": deque(),
        "typing_timestamps": deque(),
        "invite_timestamps": deque(),
    }

    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > MAX_EVENT_BYTES:
                await websocket.close(code=1009)
                return

            try:
                payload = json.loads(data)
                event_type = payload.get("event", "")
                event_data = payload.get("data", {})
            except Exception:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            if not event_type:
                await websocket.send_json({"error": "Missing event field"})
                continue

            async with AsyncSessionLocal() as db:
                await dispatcher.dispatch(
                    event_type=event_type,
                    data=event_data,
                    user_id=current_user.id,
                    websocket=websocket,
                    db=db,
                    manager=manager,
                    **ctx,
                )

    except WebSocketDisconnect:
        await manager.disconnect(current_user.id)
    except Exception:
        logger.exception("Unhandled WebSocket error for user %s", current_user.id)
        await manager.disconnect(current_user.id)
