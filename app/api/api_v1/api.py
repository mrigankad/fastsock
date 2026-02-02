from fastapi import APIRouter

from app.api.api_v1.endpoints import auth, users, chat, ws, upload, webrtc

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(ws.router, prefix="/ws", tags=["websockets"])
api_router.include_router(upload.router, prefix="/utils", tags=["utils"])
api_router.include_router(webrtc.router, prefix="/webrtc", tags=["webrtc"])
