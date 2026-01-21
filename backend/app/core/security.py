from datetime import datetime, timezone
from typing import Dict, Optional

import jwt
from jwt import PyJWTError

from .config import settings


def decode_supabase_jwt(token: str) -> Optional[Dict]:
    """
    Decode and validate a Supabase JWT token.

    Args:
        token: The JWT token string

    Returns:
        Dict containing decoded token payload or None if invalid

    Raises:
        PyJWTError: If token is malformed or invalid
    """
    try:
        # Decode the JWT without verification first to check expiration
        payload = jwt.decode(token, options={"verify_signature": False})

        # Check if token is expired
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            return None

        # Now decode with full verification using Supabase JWT secret
        decoded = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )

        return decoded

    except PyJWTError:
        return None


def extract_user_from_token(token_payload: Dict) -> Dict:
    """
    Extract user information from decoded JWT token payload.

    Args:
        token_payload: Decoded JWT payload

    Returns:
        Dict with user_id, email, and role information
    """
    return {
        "user_id": token_payload.get("sub"),
        "email": token_payload.get("email"),
        "role": token_payload.get("role", "authenticated"),
        "tenant_id": token_payload.get("tenant_id"),  # Custom claim for multi-tenancy
    }