from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, desc
from pydantic import BaseModel

from app.api import deps
from app.db.session import get_db
from app.models.call import CallSession
from app.models.user import User

router = APIRouter()


class CallHistoryItem(BaseModel):
    call_id: str
    caller_id: int
    callee_id: int
    room_id: Optional[int] = None
    status: str
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/history", response_model=List[CallHistoryItem])
async def get_call_history(
    peer_user_id: Optional[int] = Query(None, description="Filter by peer user"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get call history for the current user.
    Optionally filter by a specific peer user to see the call timeline for a conversation.
    """
    filters = [
        or_(
            CallSession.caller_id == current_user.id,
            CallSession.callee_id == current_user.id,
        )
    ]

    if peer_user_id is not None:
        filters.append(
            or_(
                and_(CallSession.caller_id == current_user.id, CallSession.callee_id == peer_user_id),
                and_(CallSession.caller_id == peer_user_id, CallSession.callee_id == current_user.id),
            )
        )

    stmt = (
        select(CallSession)
        .where(and_(*filters))
        .order_by(desc(CallSession.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    calls = result.scalars().all()
    return calls
