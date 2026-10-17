import logging
from typing import Optional
import httpx
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


class ElevenLabsService:
    def __init__(self):
        self.timeout = settings.ELEVENLABS_REQUEST_TIMEOUT_SECONDS

    def _get_api_key(self) -> str:
        key = (settings.ELEVENLABS_API_KEY or "").strip()
        if not key:
            logger.error("ELEVENLABS_API_KEY is not configured in backend environment.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Voice service is not configured on the server."
            )
        return key

    async def transcribe_audio(
        self,
        file_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> str:
        """
        Transcribes speech from audio bytes using ElevenLabs Speech-to-Text API (Scribe).
        """
        api_key = self._get_api_key()

        clean_filename = filename or "audio.webm"
        clean_content_type = content_type or "audio/webm"

        headers = {
            "xi-api-key": api_key,
        }

        data = {
            "model_id": settings.ELEVENLABS_STT_MODEL,
        }

        files = {
            "file": (clean_filename, file_bytes, clean_content_type)
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{ELEVENLABS_BASE_URL}/speech-to-text",
                    headers=headers,
                    data=data,
                    files=files
                )

            if response.status_code == 401:
                logger.error("ElevenLabs API rejected request with 401 Unauthorized.")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Voice transcription service authentication failed."
                )

            if response.status_code == 429:
                logger.warning("ElevenLabs STT rate limit encountered.")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Voice transcription rate limit exceeded. Please try again shortly."
                )

            if response.status_code != 200:
                logger.error(f"ElevenLabs STT error: HTTP {response.status_code} - {response.text[:200]}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Voice transcription service error."
                )

            result = response.json()
            transcription = result.get("text", "").strip()
            return transcription

        except HTTPException:
            raise
        except httpx.TimeoutException:
            logger.error("Timeout connecting to ElevenLabs Speech-to-Text API.")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Voice transcription request timed out."
            )
        except Exception as e:
            logger.error(f"Unexpected error communicating with ElevenLabs STT: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to transcribe audio."
            )

    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None
    ) -> bytes:
        """
        Generates spoken audio from text using ElevenLabs Text-to-Speech API.
        """
        api_key = self._get_api_key()
        target_voice = voice_id or settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"

        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }

        payload = {
            "text": text,
            "model_id": settings.ELEVENLABS_TTS_MODEL,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{ELEVENLABS_BASE_URL}/text-to-speech/{target_voice}",
                    headers=headers,
                    json=payload
                )

            if response.status_code == 401:
                logger.error("ElevenLabs API rejected request with 401 Unauthorized.")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Voice speech synthesis authentication failed."
                )

            if response.status_code == 429:
                logger.warning("ElevenLabs TTS rate limit encountered.")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Voice speech synthesis rate limit reached. Please wait a moment."
                )

            if response.status_code != 200:
                logger.error(f"ElevenLabs TTS error: HTTP {response.status_code} - {response.text[:200]}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Voice speech synthesis service error."
                )

            return response.content

        except HTTPException:
            raise
        except httpx.TimeoutException:
            logger.error("Timeout connecting to ElevenLabs Text-to-Speech API.")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Voice speech synthesis request timed out."
            )
        except Exception as e:
            logger.error(f"Unexpected error communicating with ElevenLabs TTS: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to synthesize speech."
            )


elevenlabs_service = ElevenLabsService()
