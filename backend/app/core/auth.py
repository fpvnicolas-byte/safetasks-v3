from typing import Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .security import decode_supabase_jwt, extract_user_from_token

# HTTP Bearer token scheme for JWT authentication
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    FastAPI dependency to get the current authenticated user from JWT token.

    Args:
        credentials: HTTP Bearer token credentials

    Returns:
        Dict containing user information

    Raises:
        HTTPException: If token is invalid, expired, or missing
    """
    token = credentials.credentials

    # Decode and validate the JWT
    payload = decode_supabase_jwt(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract user information from token
    user = extract_user_from_token(payload)

    return user


async def get_current_active_user(
    current_user: Dict = Depends(get_current_user)
) -> Dict:
    """
    FastAPI dependency to get the current active user.
    Ensures the user account is active (placeholder for future user status checks).

    Args:
        current_user: Current authenticated user from get_current_user

    Returns:
        Dict containing active user information

    Raises:
        HTTPException: If user account is inactive
    """
    # TODO: Add database check for user active status
    # For now, assume all authenticated users are active
    return current_user


class UserContext:
    """
    User context object containing user information and tenant data.
    Used for multi-tenancy and user-specific operations.
    """

    def __init__(self, user_data: Dict):
        self.user_id = user_data.get("user_id")
        self.email = user_data.get("email")
        self.role = user_data.get("role")
        self.tenant_id = user_data.get("tenant_id")

    @classmethod
    async def from_token(
        cls,
        current_user: Dict = Depends(get_current_active_user)
    ) -> "UserContext":
        """
        Create UserContext from current user dependency.
        """
        return cls(current_user)