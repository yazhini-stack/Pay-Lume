import logging
from typing import Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends
from pydantic import BaseModel, Field
from app.config import settings
from app.auth import get_current_user, AuthenticatedUser
from app.services.groq_service import groq_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["Voice"])


class TranscribeResponse(BaseModel):
    text: str = Field(..., description="Transcribed speech text")


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_voice(
    file: UploadFile = File(..., description="Recorded audio file (WebM, WAV, MP4, etc.)"),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Transcribes uploaded microphone audio into text using Groq Whisper STT (whisper-large-v3-turbo).
    Protected endpoint: requires valid Supabase authentication.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio file provided."
        )

    try:
        audio_bytes = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded audio file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded audio recording."
        )

    if not audio_bytes or len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded audio recording is empty."
        )

    if len(audio_bytes) > settings.MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio file exceeds maximum allowed size ({settings.MAX_AUDIO_SIZE_BYTES // (1024 * 1024)} MB)."
        )

    content_type = file.content_type or "audio/webm"
    transcription = await groq_service.transcribe_audio(
        file_bytes=audio_bytes,
        filename=file.filename,
        content_type=content_type
    )

    logger.info(f"User {current_user.id} transcribed {len(audio_bytes)} bytes of audio ({len(transcription)} chars).")
    return TranscribeResponse(text=transcription)

