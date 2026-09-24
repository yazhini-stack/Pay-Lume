from fastapi import APIRouter
from app.models.schemas import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
@router.get("/api/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint returning system operational status.
    """
    return HealthResponse(status="ok")
