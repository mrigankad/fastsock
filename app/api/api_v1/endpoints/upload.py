import os
import uuid
from typing import Any
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.api import deps
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = "app/static/uploads"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
ALLOWED_AUDIO_CONTENT_TYPES = {"audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"}
ALLOWED_AUDIO_EXTENSIONS = {".webm", ".ogg", ".mp3", ".mp4", ".wav", ".m4a"}

@router.post("/upload", response_model=Any)
async def upload_file(
    file: UploadFile = File(...),
    _current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Upload a file (image) and return the URL.
    """
    if not file.content_type or file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    if file_ext.lower() not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file extension")
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        written = 0
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="File too large")
                buffer.write(chunk)
    except HTTPException:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        raise
    except Exception as e:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
        
    # Return URL (Assuming local serving)
    # In production, this would be an S3 URL
    return {
        "filename": file.filename, # Return original filename
        "url": f"/static/uploads/{filename}",
        "content_type": file.content_type,
        "size": written
    }


@router.post("/upload/audio", response_model=Any)
async def upload_audio(
    file: UploadFile = File(...),
    _current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Upload a voice message and return the URL."""
    if not file.content_type or file.content_type not in ALLOWED_AUDIO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported audio type")

    file_ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    if file_ext.lower() not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported audio extension")
    filename = f"audio_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        written = 0
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_AUDIO_BYTES:
                    raise HTTPException(status_code=413, detail="Audio too large (max 10 MB)")
                buffer.write(chunk)
    except HTTPException:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    return {
        "url": f"/static/uploads/{filename}",
        "content_type": file.content_type,
        "size": written,
        "duration_hint": None,  # frontend can compute from blob before upload
    }
