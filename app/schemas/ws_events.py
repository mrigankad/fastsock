from typing import Any, Optional
from pydantic import BaseModel

class WSEvent(BaseModel):
    event: str
    data: Any
    recipient_ids: Optional[list[int]] = None

class WSMessagePayload(BaseModel):
    content: str
    sender_id: int
    receiver_id: Optional[int] = None
    room_id: Optional[int] = None
    message_type: str = "text"
    timestamp: str
    id: Optional[int] = None # Message ID for history/updates
