from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.message import MessageType

class MessageBase(BaseModel):
    content: str
    receiver_id: Optional[int] = None
    room_id: Optional[int] = None
    message_type: MessageType = MessageType.TEXT

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    sender_id: int
    receiver_id: Optional[int]
    room_id: Optional[int]
    timestamp: datetime
    is_read: bool
    message_type: str = "text"

    class Config:
        from_attributes = True
