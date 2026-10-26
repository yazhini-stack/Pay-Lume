import logging
from typing import Optional
import httpx
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class GroqService:
    def __init__(self):
        self.timeout = settings.GROQ_REQUEST_TIMEOUT_SECONDS

    def _get_api_key(self) -> str:
        key = (settings.GROQ_API_KEY or "").strip()
        if not key:
            logger.error("GROQ_API_KEY is not configured in backend environment.")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Voice service is not configured on the server (missing GROQ_API_KEY)."
            )
        return key

    def _extract_safe_error_detail(self, response: httpx.Response) -> str:
        """
        Extracts a sanitized, safe explanation from a Groq error response.
        Never exposes credentials or internal server traces.
        """
        safe_msg = ""
        try:
            data = response.json()
            if isinstance(data, dict):
                error_obj = data.get("error", {})
                if isinstance(error_obj, dict):
                    safe_msg = error_obj.get("message") or error_obj.get("code") or ""
                elif isinstance(error_obj, str):
                    safe_msg = error_obj
                elif "detail" in data:
                    safe_msg = str(data["detail"])
                elif "message" in data:
                    safe_msg = str(data["message"])
        except Exception:
            pass

        if not safe_msg:
            clean = response.text.replace("\n", " ").strip()
            safe_msg = clean[:150] if clean else "Unknown error from transcription service."

        return safe_msg

    async def transcribe_audio(
        self,
        file_bytes: bytes,
        filename: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> str:
        """
        Transcribes speech from audio bytes using Groq Whisper API (whisper-large-v3-turbo).
        Endpoint: https://api.groq.com/openai/v1/audio/transcriptions
        """
        api_key = self._get_api_key()

        clean_filename = filename or "audio.webm"
        clean_content_type = content_type or "audio/webm"

        headers = {
            "Authorization": f"Bearer {api_key}",
        }

        data = {
            "model": settings.GROQ_STT_MODEL,
            "response_format": "json",
            "language": "en",
            "temperature": "0.0",
        }

        files = {
            "file": (clean_filename, file_bytes, clean_content_type)
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{GROQ_BASE_URL}/audio/transcriptions",
                    headers=headers,
                    data=data,
                    files=files
                )

            if response.status_code == 401:
                logger.error("Groq API rejected request with 401 Unauthorized.")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Groq API key is unauthorized or invalid (HTTP 401)."
                )

            if response.status_code == 429:
                safe_detail = self._extract_safe_error_detail(response)
                logger.warning(f"Groq STT rate limit encountered: {safe_detail}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Groq transcription rate limit exceeded (HTTP 429): {safe_detail}"
                )

            if response.status_code == 400:
                safe_detail = self._extract_safe_error_detail(response)
                logger.warning(f"Groq STT bad request (invalid audio/parameters): {safe_detail}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid audio format or corrupted file: {safe_detail}"
                )

            if response.status_code != 200:
                safe_detail = self._extract_safe_error_detail(response)
                logger.error(f"Groq STT error: HTTP {response.status_code} - {safe_detail}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Groq transcription failed (HTTP {response.status_code}): {safe_detail}"
                )

            result = response.json()
            transcription = result.get("text", "").strip()
            return transcription

        except HTTPException:
            raise
        except httpx.TimeoutException:
            logger.error("Timeout connecting to Groq Speech-to-Text API.")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Voice transcription request timed out."
            )
        except Exception as e:
            logger.error(f"Unexpected error communicating with Groq STT: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to transcribe audio."
            )


groq_service = GroqService()
