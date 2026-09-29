import time
import logging
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from supabase import create_client, Client
from supabase_auth.errors import AuthApiError
from app.config import settings

logger = logging.getLogger(__name__)

# Security scheme for Bearer token extraction
security = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    """
    Extracted from verified Supabase JWT token.
    Never trust user identifiers provided directly by frontend request bodies.
    """
    id: str = Field(..., description="Supabase UUID of the user")
    email: Optional[str] = Field(None, description="User email address")
    role: Optional[str] = Field("authenticated", description="User role in Supabase")
    user_metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata such as full_name")
    auth_duration_ms: Optional[float] = Field(None, description="Time taken to verify JWT in milliseconds")


class BackendAuthService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.service_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self._client: Optional[Client] = None

    def get_client(self) -> Client:
        if not self._client:
            if not self.url or not self.service_key:
                logger.error("Supabase URL or SERVICE_ROLE_KEY is not configured in backend settings.")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Authentication service is misconfigured on the server."
                )
            try:
                self._client = create_client(self.url, self.service_key)
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client for auth: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to connect to authentication provider."
                )
        return self._client

    def verify_jwt_token(self, token: str) -> AuthenticatedUser:
        """
        Cryptographically validates the Supabase access token by querying Supabase Auth.
        Guarantees that the token is valid, signed, not expired, and not revoked.
        """
        if not token or not token.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty or missing authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        client = self.get_client()
        t0 = time.perf_counter()
        try:
            # Query Supabase Auth service with token
            user_response = client.auth.get_user(token)
            auth_ms = (time.perf_counter() - t0) * 1000
            if not user_response or not user_response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication session.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            user = user_response.user
            return AuthenticatedUser(
                id=str(user.id),
                email=user.email,
                role=getattr(user, "role", "authenticated") or "authenticated",
                user_metadata=getattr(user, "user_metadata", {}) or {},
                auth_duration_ms=auth_ms
            )

        except AuthApiError as e:
            logger.warning(f"Supabase auth validation rejected token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid, expired, or revoked authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token could not be verified.",
                headers={"WWW-Authenticate": "Bearer"},
            )


backend_auth_service = BackendAuthService()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AuthenticatedUser:
    """
    FastAPI dependency that enforces Bearer token authentication.
    Returns HTTP 401 if token is missing, invalid, or expired.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Please provide 'Authorization: Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return backend_auth_service.verify_jwt_token(credentials.credentials)
