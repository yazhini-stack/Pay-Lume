import io
import logging
from typing import Dict, Any, Optional
from PIL import Image
logger = logging.getLogger(__name__)

try:
    import zxingcpp
except Exception as e:
    zxingcpp = None
    logger.warning(f"zxingcpp native library could not be loaded ({e}). QR scanning will fallback to multimodal vision.")

class QRService:
    def decode_qr(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Attempt to decode a QR code from image bytes using zxing-cpp.
        Returns detection status, decoded payload, and whether it represents a URL.
        """
        result: Dict[str, Any] = {
            "detected": False,
            "data": None,
            "is_url": False,
            "url": None
        }

        if not image_bytes or zxingcpp is None:
            return result

        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Convert to RGB or grayscale if needed
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")

            barcodes = zxingcpp.read_barcodes(image)
            if barcodes:
                for barcode in barcodes:
                    text = barcode.text.strip()
                    if text:
                        result["detected"] = True
                        result["data"] = text
                        # Check if it starts with http/https or contains a valid url scheme
                        lower_text = text.lower()
                        if lower_text.startswith("http://") or lower_text.startswith("https://"):
                            result["is_url"] = True
                            result["url"] = text
                        logger.info(f"QR Code detected: {text[:50]}...")
                        break
        except Exception as e:
            logger.warning(f"Error while scanning for QR code: {e}")

        return result

qr_service = QRService()
