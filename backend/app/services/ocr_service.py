import io
import logging
from typing import Dict, Any, Optional
from PIL import Image
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp"
}

class OCRService:
    def __init__(self):
        self._client: Optional[genai.Client] = None

    def _get_client(self) -> genai.Client:
        if not self._client:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is not configured.")
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def validate_image(self, file_bytes: bytes, content_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Validates file size, MIME type, and verifies image integrity with Pillow.
        """
        if not file_bytes:
            raise ValueError("Uploaded file is empty.")

        if len(file_bytes) > settings.MAX_IMAGE_SIZE_BYTES:
            raise ValueError(f"Image size ({len(file_bytes)} bytes) exceeds maximum limit of {settings.MAX_IMAGE_SIZE_BYTES // (1024*1024)}MB.")

        try:
            img = Image.open(io.BytesIO(file_bytes))
            img.verify()  # verify integrity
            
            # Reopen to read attributes because verify() clears some data
            img = Image.open(io.BytesIO(file_bytes))
            format_lower = (img.format or "").lower()
            detected_mime = f"image/{format_lower}" if format_lower != "jpeg" else "image/jpeg"
            
            return {
                "valid": True,
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "mime_type": content_type or detected_mime
            }
        except Exception as e:
            raise ValueError(f"Invalid or corrupted image file: {e}")

    def extract_text_and_visual_context(self, file_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Uses Gemini's multimodal vision capabilities to extract all visible text,
        sender details, payment amounts, URLs, UI elements, and layout context from the image.
        """
        result = {
            "raw_text": "",
            "visual_summary": "",
            "extracted_entities": {
                "sender": None,
                "amount": None,
                "urls_found": [],
                "urgency_cues": []
            }
        }

        try:
            client = self._get_client()
            
            prompt = (
                "You are an expert cybersecurity forensic OCR engine. Carefully inspect this screenshot/image and perform a faithful transcription:\n"
                "1. Transcribe ALL visible text verbatim (SMS messages, phone numbers, email headers, payment apps, notification texts, URLs, amounts).\n"
                "2. Note any prominent UI elements (e.g. 'Bank logo present', 'Countdown timer', 'Payment confirmation button').\n"
                "3. If any URLs, domains, or shortlinks appear in the text, list them clearly.\n"
                "Do NOT give advice yet; focus strictly on precise extraction of all visible content and visual elements."
            )

            # Gemini SDK accepts Part.from_bytes
            image_part = types.Part.from_bytes(
                data=file_bytes,
                mime_type=mime_type
            )

            max_retries = 3
            delay = 1.5
            response = None

            for attempt in range(max_retries):
                try:
                    response = client.models.generate_content(
                        model=settings.GENERATION_MODEL,
                        contents=[image_part, prompt]
                    )
                    break
                except Exception as e:
                    err_str = str(e)
                    if ("503" in err_str or "UNAVAILABLE" in err_str or "demand" in err_str or "429" in err_str) and attempt < max_retries - 1:
                        logger.warning(f"OCR transient error ({err_str[:60]}). Retrying in {delay}s...")
                        import time
                        time.sleep(delay)
                        delay *= 2
                    else:
                        raise

            if response and response.text:
                result["raw_text"] = response.text.strip()
                result["visual_summary"] = response.text.strip()
                logger.info(f"Successfully extracted OCR/visual context ({len(response.text)} chars)")
            else:
                result["raw_text"] = "[No readable text detected in image]"

        except Exception as e:
            logger.warning(f"OCR/Vision extraction error with Gemini: {e}")
            result["raw_text"] = f"[OCR extraction error: {e}]"

        return result

ocr_service = OCRService()
