import json
from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from app.api import deps
from app.core.config import settings
from app.models.user import User

router = APIRouter()


@router.get("/ice-servers", response_model=Dict[str, Any])
async def get_ice_servers(
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    ice_servers: List[Dict[str, Any]] = [{"urls": ["stun:stun.l.google.com:19302"]}]

    raw = getattr(settings, "WEBRTC_ICE_SERVERS_JSON", "") or ""
    if raw.strip():
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list) and all(isinstance(x, dict) for x in parsed):
                ice_servers = parsed
        except Exception:
            pass

    return {"ice_servers": ice_servers}
