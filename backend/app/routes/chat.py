import json
import logging
from typing import Optional, List, Dict, Union
from fastapi import APIRouter, Form, File, UploadFile, HTTPException, status, Depends
from app.models.schemas import ChatResponse, SourceItem
from app.graph.workflow import workflow
from app.services.ocr_service import ocr_service, ALLOWED_MIME_TYPES
from app.auth import get_current_user, AuthenticatedUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Chat"])

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    question: str = Form(..., description="The user's cybersecurity inquiry"),
    url: Optional[str] = Form(None, description="Optional suspicious or payment URL"),
    image: Optional[Union[UploadFile, str]] = File(None, description="Optional uploaded image/screenshot/QR code"),
    conversation_history: Optional[str] = Form(None, description="Optional JSON encoded list of prior messages"),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Main multimodal conversational cybersecurity analysis endpoint.
    Accepts question along with any combination of uploaded image, URL, and prior message context.
    """
    if not question or not question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'question' field cannot be empty."
        )

    # Normalize url
    if url and url.strip() in ("", "undefined", "null"):
        url = None

    # Parse conversation history if provided
    history_list: List[Dict[str, str]] = []
    if conversation_history and conversation_history.strip() and conversation_history.strip() not in ("undefined", "null"):
        try:
            parsed = json.loads(conversation_history)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict) and "role" in item and "content" in item:
                        history_list.append({
                            "role": str(item["role"]),
                            "content": str(item["content"])
                        })
        except Exception as e:
            logger.warning(f"Could not parse conversation_history JSON: {e}")

    # Process and validate image if provided
    image_bytes: Optional[bytes] = None
    image_mime: Optional[str] = None

    # Only treat as uploaded file if it has read and filename attributes (not a serialized string)
    if image and hasattr(image, "read") and hasattr(image, "filename") and image.filename:
        content_type = (getattr(image, "content_type", "") or "").lower()
        if content_type not in ALLOWED_MIME_TYPES and not any(image.filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{content_type}'. Please upload a PNG, JPEG, or WebP image."
            )

        try:
            image_bytes = await image.read()
            ocr_service.validate_image(image_bytes, content_type)
            image_mime = content_type or "image/jpeg"
        except ValueError as ve:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(ve)
            )
        except Exception as e:
            logger.error(f"Error reading uploaded file: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to read the uploaded image."
            )

    # Prepare LangGraph initial state
    initial_state = {
        "question": question.strip(),
        "url": url.strip() if url and url.strip() else None,
        "image_bytes": image_bytes,
        "image_mime": image_mime,
        "conversation_history": history_list,
        "evidence_context": "",
        "security_evidence": [],
        "rag_sources": [],
        "rag_context_text": "",
        "metadata": {
            "user_id": current_user.id,
            "user_email": current_user.email
        },
        "final_answer": ""
    }

    try:
        # Run workflow
        result = workflow.invoke(initial_state)

        metadata = result.get("metadata", {})
        metadata["user_id"] = current_user.id
        if current_user.email:
            metadata["user_email"] = current_user.email

        return ChatResponse(
            answer=result.get("final_answer", "No answer generated."),
            sources=result.get("rag_sources", []),
            security_evidence=result.get("security_evidence", []),
            metadata=metadata
        )
    except Exception as e:
        logger.error(f"Error executing chat workflow: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis pipeline error: {str(e)}"
        )
