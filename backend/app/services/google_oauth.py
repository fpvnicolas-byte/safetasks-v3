"""
Google OAuth2 service — token management and credential storage.
"""
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.cloud import GoogleDriveCredentials

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"


class GoogleOAuthService:
    """Manages Google OAuth2 flow: authorize → callback → store/refresh tokens."""

    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI

    # ── Authorization ────────────────────────────────────────

    def generate_auth_url(self, organization_id: UUID) -> str:
        """Build the Google OAuth2 authorization URL with CSRF state."""
        state = f"{organization_id}:{secrets.token_urlsafe(32)}"
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": DRIVE_FILE_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        qs = "&".join(f"{k}={httpx.URL('', params={k: v}).params[k]}" for k, v in params.items())
        return f"{GOOGLE_AUTH_URL}?{qs}"

    # ── Callback ─────────────────────────────────────────────

    async def handle_callback(
        self,
        code: str,
        state: str,
        db: AsyncSession,
    ) -> GoogleDriveCredentials:
        """
        Exchange the authorization code for tokens, fetch user info,
        and store/update credentials.
        """
        # Parse org ID from state
        org_id_str = state.split(":")[0]
        organization_id = UUID(org_id_str)

        # Exchange code for tokens
        token_data = await self._exchange_code(code)
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        token_expiry = datetime.now(timezone.utc).__class__.fromtimestamp(
            datetime.now(timezone.utc).timestamp() + expires_in,
            tz=timezone.utc,
        )

        # Fetch connected email
        email = await self._fetch_user_email(access_token)

        # Upsert credentials
        query = select(GoogleDriveCredentials).where(
            GoogleDriveCredentials.organization_id == organization_id
        )
        result = await db.execute(query)
        creds = result.scalar_one_or_none()

        if creds:
            creds.access_token = access_token
            if refresh_token:
                creds.refresh_token = refresh_token
            creds.token_expiry = token_expiry
            creds.connected_email = email
            creds.oauth_scopes = DRIVE_FILE_SCOPE
            creds.connected_at = datetime.now(timezone.utc)
        else:
            creds = GoogleDriveCredentials(
                organization_id=organization_id,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expiry=token_expiry,
                connected_email=email,
                oauth_scopes=DRIVE_FILE_SCOPE,
                connected_at=datetime.now(timezone.utc),
            )
            db.add(creds)

        await db.commit()
        await db.refresh(creds)
        return creds

    # ── Token refresh ────────────────────────────────────────

    async def get_valid_access_token(
        self, organization_id: UUID, db: AsyncSession
    ) -> str:
        """Return a valid access token, refreshing if needed."""
        query = select(GoogleDriveCredentials).where(
            GoogleDriveCredentials.organization_id == organization_id
        )
        result = await db.execute(query)
        creds = result.scalar_one_or_none()

        if not creds or not creds.refresh_token:
            raise ValueError("Google Drive not connected for this organization")

        # Check if token is expired or close to expiring (< 5 min)
        now = datetime.now(timezone.utc)
        if creds.token_expiry and (creds.token_expiry.timestamp() - now.timestamp()) > 300:
            return creds.access_token  # type: ignore[return-value]

        # Refresh
        token_data = await self._refresh_access_token(creds.refresh_token)
        creds.access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        creds.token_expiry = datetime.fromtimestamp(
            now.timestamp() + expires_in, tz=timezone.utc
        )
        await db.commit()

        return creds.access_token  # type: ignore[return-value]

    # ── Status ───────────────────────────────────────────────

    async def get_status(
        self, organization_id: UUID, db: AsyncSession
    ) -> Optional[GoogleDriveCredentials]:
        """Return credentials row or None."""
        query = select(GoogleDriveCredentials).where(
            GoogleDriveCredentials.organization_id == organization_id
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    # ── Disconnect ───────────────────────────────────────────

    async def disconnect(
        self, organization_id: UUID, db: AsyncSession
    ) -> None:
        """Revoke the token and delete credentials."""
        query = select(GoogleDriveCredentials).where(
            GoogleDriveCredentials.organization_id == organization_id
        )
        result = await db.execute(query)
        creds = result.scalar_one_or_none()

        if not creds:
            return

        # Best-effort revoke
        if creds.access_token:
            try:
                await self._revoke_token(creds.access_token)
            except Exception:
                logger.warning("Failed to revoke Google token, continuing with deletion")

        await db.delete(creds)
        await db.commit()

    # ── Private helpers ──────────────────────────────────────

    async def _exchange_code(self, code: str) -> dict:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def _refresh_access_token(self, refresh_token: str) -> dict:
        """Refresh an expired access token."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def _fetch_user_email(self, access_token: str) -> Optional[str]:
        """Fetch the authenticated user's email."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                resp.raise_for_status()
                return resp.json().get("email")
        except Exception:
            logger.warning("Failed to fetch Google user email")
            return None

    async def _revoke_token(self, token: str) -> None:
        """Revoke a token with Google."""
        async with httpx.AsyncClient() as client:
            await client.post(
                GOOGLE_REVOKE_URL,
                params={"token": token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )


# Global instance
google_oauth_service = GoogleOAuthService()
