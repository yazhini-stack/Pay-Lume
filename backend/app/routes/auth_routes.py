import logging
from fastapi import APIRouter, Depends
from app.auth import get_current_user, AuthenticatedUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/me", response_model=AuthenticatedUser)
async def get_my_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns the authenticated user's profile and metadata from the verified Supabase token.
    Protected endpoint: requires valid Authorization Bearer header.
    """
    return current_user
