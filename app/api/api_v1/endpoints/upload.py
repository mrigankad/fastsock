import shutil
import os
import uuid
from typing import Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings

router = APIRouter()

UPLOAD_DIR = "app/static/uploads"

@router.post("/upload", response_model=Any)
async def upload_file(
    file: UploadFile = File(...)
) -> Any:
    """
    Upload a file (image) and return the URL.
    """
    # Verify file type (basic check)
    # Allow images and basic docs
    # if not file.content_type.startswith("image/"):
    #    raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
        
    # Return URL (Assuming local serving)
    # In production, this would be an S3 URL
    return {
        "filename": file.filename, # Return original filename
        "url": f"/static/uploads/{filename}",
        "content_type": file.content_type,
        "size": file.size
    }
