from typing import Any, List, Dict, Optional
from datetime import datetime, timezone
import bleach
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func

from app.api import deps
from app.db.session import get_db
from app.models.chat import ChatRoom, ChatRoomMember
from app.models.message import Message, DisappearingTimer
from app.models.user import User
from app.schemas.message import Message as MessageSchema
from app.domain.messaging.service import MessageService
from app.ws.manager import manager as ws_manager
from app.schemas.ws_events import WSEvent
from pydantic import BaseModel

router = APIRouter()


@router.get("/search", response_model=List[MessageSchema])
async def search_messages(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Search messages across all conversations the current user participates in.
    Returns messages matching the query, ordered by newest first.
    """
    # Get room IDs the user belongs to
    stmt_rooms = select(ChatRoomMember.chatroom_id).where(
        ChatRoomMember.user_id == current_user.id
    )
    room_result = await db.execute(stmt_rooms)
    user_room_ids = [row[0] for row in room_result.all()]

    # Build search across DMs + rooms
    filters = [
        # DMs where user is sender or receiver
        and_(
            Message.room_id.is_(None),
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id,
            ),
        ),
    ]
    if user_room_ids:
        filters.append(Message.room_id.in_(user_room_ids))

    stmt = (
        select(Message)
        .where(
            and_(
                or_(*filters),
                Message.content.ilike(f"%{q}%"),
            )
        )
        .order_by(Message.timestamp.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return messages

class RoomCreate(BaseModel):
    name: str
    member_ids: List[int]

class RoomRead(BaseModel):
    id: int
    name: str
    is_group: bool
    
    class Config:
        from_attributes = True

class UnreadCount(BaseModel):
    user_id: int
    count: int

@router.get("/unread", response_model=Dict[str, Any])
async def get_unread_counts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get unread message counts for all conversations.
    Returns: { "users": { "1": 5 }, "rooms": { "2": 3 } }
    """
    
    # Unread from Users (Direct Messages)
    stmt_users = (
        select(Message.sender_id, func.count(Message.id))
        .where(
            and_(
                Message.receiver_id == current_user.id,
                Message.is_read == False
            )
        )
        .group_by(Message.sender_id)
    )
    result_users = await db.execute(stmt_users)
    unread_users = {str(row[0]): row[1] for row in result_users.all()}
    
    # Unread from Rooms
    # 1. Get user's membership info (last_read_at for each room)
    stmt_memberships = select(ChatRoomMember).where(ChatRoomMember.user_id == current_user.id)
    result_memberships = await db.execute(stmt_memberships)
    memberships = result_memberships.scalars().all()
    
    unread_rooms = {}
    for membership in memberships:
        # Count messages in room sent AFTER last_read_at
        stmt_count = (
            select(func.count(Message.id))
            .where(
                and_(
                    Message.room_id == membership.chatroom_id,
                    Message.timestamp > membership.last_read_at
                )
            )
        )
        count = await db.scalar(stmt_count)
        if count > 0:
            unread_rooms[str(membership.chatroom_id)] = count
    
    return {
        "users": unread_users,
        "rooms": unread_rooms 
    }

@router.post("/rooms", response_model=RoomRead)
async def create_room(
    room_in: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new chat room (group).
    """
    room = ChatRoom(name=bleach.clean(room_in.name, tags=[], strip=True)[:100], is_group=True)
    db.add(room)
    await db.flush() # Get ID
    
    # Add current user
    db.add(ChatRoomMember(chatroom_id=room.id, user_id=current_user.id))
    
    # Add other members
    for member_id in room_in.member_ids:
        db.add(ChatRoomMember(chatroom_id=room.id, user_id=member_id))
        
    await db.commit()
    await db.refresh(room)
    
    # Broadcast Room Creation
    room_data = {
        "id": room.id,
        "name": room.name,
        "is_group": room.is_group
    }
    event = WSEvent(
        event="room.created",
        data=room_data,
        recipient_ids=room_in.member_ids + [current_user.id]
    )
    await ws_manager.broadcast(event)
    
    return room

@router.get("/rooms", response_model=List[RoomRead])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    List rooms current user is member of.
    """
    stmt = select(ChatRoom).join(ChatRoomMember).where(ChatRoomMember.user_id == current_user.id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/history/room/{room_id}", response_model=List[MessageSchema])
async def get_room_history(
    room_id: int,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    stmt_access = select(ChatRoomMember).where(
        and_(ChatRoomMember.chatroom_id == room_id, ChatRoomMember.user_id == current_user.id)
    )
    access = (await db.execute(stmt_access)).scalar_one_or_none()
    if not access:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    
    stmt = select(Message).where(Message.room_id == room_id).order_by(Message.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return messages[::-1] # Return oldest first

@router.post("/rooms/{room_id}/read", response_model=Dict[str, bool])
async def mark_room_read(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    stmt = select(ChatRoomMember).where(
        and_(ChatRoomMember.chatroom_id == room_id, ChatRoomMember.user_id == current_user.id)
    )
    membership = (await db.execute(stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    membership.last_read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}

@router.get("/history/user/{user_id}", response_model=List[MessageSchema])
async def get_private_history(
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    stmt = select(Message).where(
        or_(
            and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
            and_(Message.sender_id == user_id, Message.receiver_id == current_user.id)
        )
    ).order_by(Message.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return messages[::-1]
    
class MessageUpdate(BaseModel):
    content: str

class ReactionToggle(BaseModel):
    emoji: str

@router.put("/messages/{message_id}", response_model=MessageSchema)
async def update_message(
    message_id: int,
    message_in: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    svc = MessageService(db, ws_manager)
    return await svc.edit(message_id, current_user.id, message_in.content)

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    svc = MessageService(db, ws_manager)
    await svc.delete(message_id, current_user.id)
    return {"ok": True}

@router.post("/messages/{message_id}/reactions", response_model=Dict[str, Any])
async def toggle_reaction(
    message_id: int,
    reaction: ReactionToggle,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    svc = MessageService(db, ws_manager)
    reactions = await svc.toggle_reaction(message_id, current_user.id, reaction.emoji)
    return {"message_id": message_id, "reactions": reactions}


# ---------------------------------------------------------------------------
# Message Pinning
# ---------------------------------------------------------------------------

from app.models.pins import PinnedMessage, BookmarkedMessage
import secrets
from app.models.chat import RoomInviteLink


def _pin_scope(msg: Message, current_user_id: int) -> str:
    """Compute a scope key for a message (room vs DM)."""
    if msg.room_id is not None:
        return f"room:{msg.room_id}"
    ids = sorted([msg.sender_id, msg.receiver_id or current_user_id])
    return f"dm:{ids[0]}:{ids[1]}"


class PinResponse(BaseModel):
    id: int
    message_id: int
    pinned_by: int
    scope: str

    class Config:
        from_attributes = True


@router.post("/messages/{message_id}/pin", response_model=PinResponse)
async def pin_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Pin a message in its conversation."""
    stmt = select(Message).where(Message.id == message_id)
    msg = (await db.execute(stmt)).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    scope = _pin_scope(msg, current_user.id)

    # Check for duplicate
    existing = (
        await db.execute(
            select(PinnedMessage).where(
                and_(PinnedMessage.message_id == message_id, PinnedMessage.scope == scope)
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Message already pinned")

    pin = PinnedMessage(message_id=message_id, pinned_by=current_user.id, scope=scope)
    db.add(pin)
    await db.commit()
    await db.refresh(pin)

    # Broadcast
    await ws_manager.broadcast(WSEvent(
        event="message.pinned",
        data={"message_id": message_id, "scope": scope, "pinned_by": current_user.id},
    ))

    return pin


@router.delete("/messages/{message_id}/pin")
async def unpin_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Unpin a message from its conversation."""
    stmt = select(Message).where(Message.id == message_id)
    msg = (await db.execute(stmt)).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    scope = _pin_scope(msg, current_user.id)
    pin = (
        await db.execute(
            select(PinnedMessage).where(
                and_(PinnedMessage.message_id == message_id, PinnedMessage.scope == scope)
            )
        )
    ).scalar_one_or_none()
    if not pin:
        raise HTTPException(status_code=404, detail="Message is not pinned")

    await db.delete(pin)
    await db.commit()

    await ws_manager.broadcast(WSEvent(
        event="message.unpinned",
        data={"message_id": message_id, "scope": scope},
    ))

    return {"ok": True}


@router.get("/pins/{scope}", response_model=List[PinResponse])
async def list_pins(
    scope: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List all pinned messages for a conversation scope."""
    stmt = (
        select(PinnedMessage)
        .where(PinnedMessage.scope == scope)
        .order_by(PinnedMessage.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Bookmarks (Saved Messages)
# ---------------------------------------------------------------------------

class BookmarkResponse(BaseModel):
    id: int
    message_id: int
    note: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BookmarkCreate(BaseModel):
    note: Optional[str] = None


@router.post("/messages/{message_id}/bookmark", response_model=BookmarkResponse)
async def toggle_bookmark(
    message_id: int,
    body: BookmarkCreate = BookmarkCreate(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Toggle bookmark on a message. If already bookmarked, removes it."""
    existing = (
        await db.execute(
            select(BookmarkedMessage).where(
                and_(BookmarkedMessage.message_id == message_id, BookmarkedMessage.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return BookmarkResponse(id=0, message_id=message_id, note=None)

    bookmark = BookmarkedMessage(
        message_id=message_id,
        user_id=current_user.id,
        note=body.note,
    )
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return bookmark


@router.get("/bookmarks", response_model=List[BookmarkResponse])
async def list_bookmarks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List all bookmarked messages for the current user."""
    stmt = (
        select(BookmarkedMessage)
        .where(BookmarkedMessage.user_id == current_user.id)
        .order_by(BookmarkedMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()

# ---------------------------------------------------------------------------
# Group management
# ---------------------------------------------------------------------------

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    slow_mode_seconds: Optional[int] = None


class RoomReadFull(BaseModel):
    id: int
    name: str
    is_group: bool
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    slow_mode_seconds: int = 0

    class Config:
        from_attributes = True


@router.patch("/rooms/{room_id}", response_model=RoomReadFull)
async def update_room(
    room_id: int,
    body: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Update room name/description/avatar/slow_mode. Requires admin or owner role."""
    membership = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.chatroom_id == room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    if membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner role required")

    room = (await db.execute(select(ChatRoom).where(ChatRoom.id == room_id))).scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if body.name is not None:
        room.name = body.name.strip()[:100]
    if body.description is not None:
        room.description = body.description[:500]
    if body.avatar_url is not None:
        room.avatar_url = body.avatar_url
    if body.slow_mode_seconds is not None:
        room.slow_mode_seconds = max(0, min(body.slow_mode_seconds, 3600))

    await db.commit()
    await db.refresh(room)

    await ws_manager.broadcast(WSEvent(
        event="room.updated",
        data={"id": room.id, "name": room.name, "description": room.description,
              "avatar_url": room.avatar_url, "slow_mode_seconds": room.slow_mode_seconds},
    ))
    return room


@router.delete("/rooms/{room_id}/members/{user_id}", status_code=204)
async def kick_member(
    room_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Kick a member from a room. Requires admin or owner role."""
    my_membership = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.chatroom_id == room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not my_membership or my_membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner role required")

    target = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.chatroom_id == room_id, ChatRoomMember.user_id == user_id)
            )
        )
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(target)
    await db.commit()

    await ws_manager.broadcast(WSEvent(
        event="room.member_removed",
        data={"room_id": room_id, "user_id": user_id, "kicked_by": current_user.id},
    ))


# ---------------------------------------------------------------------------
# Room invite links
# ---------------------------------------------------------------------------

class InviteLinkRead(BaseModel):
    token: str
    room_id: int
    use_count: int
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.post("/rooms/{room_id}/invite", response_model=InviteLinkRead)
async def create_invite_link(
    room_id: int,
    max_uses: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Generate a shareable invite link for a room. Returns a token."""
    membership = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.chatroom_id == room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    if membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin or owner role required")

    token = secrets.token_urlsafe(16)
    link = RoomInviteLink(
        token=token,
        room_id=room_id,
        created_by=current_user.id,
        max_uses=max_uses,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


@router.get("/join/{token}", response_model=RoomReadFull)
async def join_via_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Accept an invite link and join the room."""
    link = (
        await db.execute(select(RoomInviteLink).where(RoomInviteLink.token == token))
    ).scalar_one_or_none()
    if not link or link.revoked_at is not None:
        raise HTTPException(status_code=404, detail="Invalid or revoked invite link")
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite link has expired")
    if link.max_uses is not None and link.use_count >= link.max_uses:
        raise HTTPException(status_code=410, detail="Invite link has reached its usage limit")

    existing = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.chatroom_id == link.room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(ChatRoomMember(chatroom_id=link.room_id, user_id=current_user.id, role="member"))
        link.use_count += 1
        await db.commit()

    room = (await db.execute(select(ChatRoom).where(ChatRoom.id == link.room_id))).scalar_one_or_none()
    return room


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

from app.models.notification import Notification as NotificationModel


class NotificationRead(BaseModel):
    id: int
    type: str
    message_id: Optional[int] = None
    from_user_id: Optional[int] = None
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/notifications", response_model=List[NotificationRead])
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Return the most recent notifications for the current user."""
    stmt = (
        select(NotificationModel)
        .where(NotificationModel.user_id == current_user.id)
        .order_by(NotificationModel.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/notifications/unread-count")
async def unread_notification_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    from sqlalchemy import func as sqlfunc
    count = await db.scalar(
        select(sqlfunc.count(NotificationModel.id)).where(
            NotificationModel.user_id == current_user.id,
            NotificationModel.is_read == False,  # noqa: E712
        )
    )
    return {"count": count or 0}


@router.post("/notifications/read-all", status_code=204)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Mark all notifications as read."""
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(NotificationModel)
        .where(NotificationModel.user_id == current_user.id, NotificationModel.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()


@router.post("/notifications/{notification_id}/read", status_code=204)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    notif = (
        await db.execute(
            select(NotificationModel).where(
                NotificationModel.id == notification_id,
                NotificationModel.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()

# ---------------------------------------------------------------------------
# Disappearing Messages
# ---------------------------------------------------------------------------

class DisappearingTimerSet(BaseModel):
    target_type: str   # 'dm' | 'room'
    target_id: int
    duration_seconds: int  # 0 = off; 30, 300, 3600, 86400, 604800 etc.

class DisappearingTimerRead(BaseModel):
    target_type: str
    target_id: int
    duration_seconds: int

    class Config:
        from_attributes = True


@router.post("/disappearing", response_model=DisappearingTimerRead)
async def set_disappearing_timer(
    body: DisappearingTimerSet,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> DisappearingTimerRead:
    """Set (or clear) the disappearing message timer for a conversation."""
    if body.target_type not in ("dm", "room"):
        raise HTTPException(400, "target_type must be 'dm' or 'room'")
    if body.duration_seconds < 0:
        raise HTTPException(400, "duration_seconds must be >= 0")

    row = (
        await db.execute(
            select(DisappearingTimer).where(
                DisappearingTimer.user_id == current_user.id,
                DisappearingTimer.target_type == body.target_type,
                DisappearingTimer.target_id == body.target_id,
            )
        )
    ).scalar_one_or_none()

    if row:
        row.duration_seconds = body.duration_seconds
    else:
        row = DisappearingTimer(
            user_id=current_user.id,
            target_type=body.target_type,
            target_id=body.target_id,
            duration_seconds=body.duration_seconds,
        )
        db.add(row)

    await db.commit()
    await db.refresh(row)
    return row


@router.get("/disappearing", response_model=DisappearingTimerRead)
async def get_disappearing_timer(
    target_type: str,
    target_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> DisappearingTimerRead:
    """Get the active disappearing timer for a conversation (0 = disabled)."""
    row = (
        await db.execute(
            select(DisappearingTimer).where(
                DisappearingTimer.user_id == current_user.id,
                DisappearingTimer.target_type == target_type,
                DisappearingTimer.target_id == target_id,
            )
        )
    ).scalar_one_or_none()

    duration = row.duration_seconds if row else 0
    return DisappearingTimerRead(
        target_type=target_type,
        target_id=target_id,
        duration_seconds=duration,
    )
