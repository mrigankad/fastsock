import json
import asyncio
from typing import Dict, Optional
from fastapi import WebSocket
from redis.asyncio import Redis
from app.core.config import settings
from app.schemas.ws_events import WSEvent

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.redis: Redis = None
        self.pubsub = None

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        # Broadcast presence update
        await self.broadcast(
            WSEvent(event="presence.update", data={"user_id": user_id, "status": "online"})
        )

    async def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        # Broadcast presence update
        await self.broadcast(
            WSEvent(event="presence.update", data={"user_id": user_id, "status": "offline"})
        )

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_text(message)

    async def broadcast(self, message: WSEvent):
        """Publish message to Redis to reach all instances"""
        if self.redis:
            await self.redis.publish("chat:events", message.model_dump_json())
        else:
            # Fallback to local broadcast if Redis is not active
            await self.local_broadcast(message.model_dump_json())

    async def local_broadcast(self, data: str):
        event = WSEvent.model_validate_json(data)

        if event.recipient_ids:
            for uid in event.recipient_ids:
                if uid in self.active_connections:
                    try:
                        await self.active_connections[uid].send_text(data)
                    except Exception:
                        pass
            return
        
        # If it's a direct message/typing/read-receipt/update/delete, check if recipient is local
        if event.event in ["message.receive", "typing.start", "typing.stop", "message.read_receipt", "message.update", "message.delete", "room.created"]:
            receiver_id = event.data.get("receiver_id")
            room_id = event.data.get("room_id")
            
            # If room_id exists, broadcast to all active connections (simple approach for now)
            # Ideal: broadcast only to room members
            if room_id:
                for connection in self.active_connections.values():
                    # Optimization: In a real app we would track which user is in which room
                    try:
                        await connection.send_text(data)
                    except Exception:
                        pass
                return

            if receiver_id and receiver_id in self.active_connections:
                await self.active_connections[receiver_id].send_text(data)
                
            # Also send to sender (for update/delete reflection on other devices)
            sender_id = event.data.get("sender_id")
            if sender_id and sender_id in self.active_connections:
                await self.active_connections[sender_id].send_text(data)
                return
        
        # If it's a broadcast (like presence), send to all local connections
        for connection in self.active_connections.values():
            try:
                await connection.send_text(data)
            except Exception:
                pass # Handle stale connections

    async def start_redis(self):
        if not settings.REDIS_URL:
            print("Redis not configured, using in-memory broadcast.")
            return

        try:
            self.redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
            self.pubsub = self.redis.pubsub()
            await self.pubsub.subscribe("chat:events")
            
            # Start listening in background
            asyncio.create_task(self.redis_listener())
        except Exception as e:
            print(f"Failed to connect to Redis: {e}. Using in-memory broadcast.")
            self.redis = None

    async def redis_listener(self):
        if not self.pubsub:
            return
            
        async for message in self.pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                await self.local_broadcast(data)

manager = ConnectionManager()
