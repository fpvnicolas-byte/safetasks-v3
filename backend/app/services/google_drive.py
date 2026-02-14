"""
Google Drive service — folder management, upload sessions, downloads.
Uses OAuth2 tokens via GoogleOAuthService.
"""
import logging
import uuid as uuid_lib
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.cloud import GoogleDriveCredentials, ProjectDriveFolder, CloudFileReference
from app.services.google_oauth import google_oauth_service

logger = logging.getLogger(__name__)

DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"


class GoogleDriveService:
    """
    Google Drive operations using OAuth2 credentials.

    - Root / project folder creation
    - Resumable upload session creation
    - Upload confirmation & file reference bookkeeping
    - Signed download URL generation
    """

    SCOPES = ["https://www.googleapis.com/auth/drive.file"]

    # ── Folders ──────────────────────────────────────────────

    async def ensure_root_folder(
        self,
        organization_id: UUID,
        org_name: str,
        db: AsyncSession,
    ) -> str:
        """
        Ensure the SafeTasks root folder exists for this org.
        Returns the folder ID.
        """
        # Check if we already have a root folder
        creds = await self._get_creds(organization_id, db)
        if creds.root_folder_id:
            return creds.root_folder_id

        access_token = await google_oauth_service.get_valid_access_token(organization_id, db)
        folder_name = f"SafeTasks - {org_name}"

        folder_id = await self._create_folder(access_token, folder_name, parent_id=None)
        folder_url = f"https://drive.google.com/drive/folders/{folder_id}"

        creds.root_folder_id = folder_id
        creds.root_folder_url = folder_url
        await db.commit()

        return folder_id

    async def ensure_project_folders(
        self,
        organization_id: UUID,
        project_id: UUID,
        project_name: str,
        db: AsyncSession,
    ) -> ProjectDriveFolder:
        """
        Ensure project folder structure exists:
          root / project_name / {scripts, shooting_days, media}
        """
        # Check existing
        query = select(ProjectDriveFolder).where(
            ProjectDriveFolder.organization_id == organization_id,
            ProjectDriveFolder.project_id == project_id,
        )
        result = await db.execute(query)
        pf = result.scalar_one_or_none()
        if pf and pf.project_folder_id:
            return pf

        access_token = await google_oauth_service.get_valid_access_token(organization_id, db)

        # Ensure root folder exists (auto-create if needed)
        creds = await self._get_creds(organization_id, db)
        if not creds.root_folder_id:
            # Auto-create root folder
            folder_name = f"SafeTasks - {project_name}"
            root_id = await self._create_folder(access_token, folder_name, parent_id=None)
            creds.root_folder_id = root_id
            creds.root_folder_url = f"https://drive.google.com/drive/folders/{root_id}"
            await db.commit()
        root_id = creds.root_folder_id

        # Create project folder
        project_folder_id = await self._create_folder(access_token, project_name, parent_id=root_id)

        # Create sub-folders
        scripts_id = await self._create_folder(access_token, "Scripts", parent_id=project_folder_id)
        shooting_id = await self._create_folder(access_token, "Shooting Days", parent_id=project_folder_id)
        media_id = await self._create_folder(access_token, "Media", parent_id=project_folder_id)

        def _url(fid: str) -> str:
            return f"https://drive.google.com/drive/folders/{fid}"

        if pf:
            pf.project_folder_id = project_folder_id
            pf.project_folder_url = _url(project_folder_id)
            pf.scripts_folder_id = scripts_id
            pf.scripts_folder_url = _url(scripts_id)
            pf.shooting_days_folder_id = shooting_id
            pf.shooting_days_folder_url = _url(shooting_id)
            pf.media_folder_id = media_id
            pf.media_folder_url = _url(media_id)
        else:
            pf = ProjectDriveFolder(
                organization_id=organization_id,
                project_id=project_id,
                project_folder_id=project_folder_id,
                project_folder_url=_url(project_folder_id),
                scripts_folder_id=scripts_id,
                scripts_folder_url=_url(scripts_id),
                shooting_days_folder_id=shooting_id,
                shooting_days_folder_url=_url(shooting_id),
                media_folder_id=media_id,
                media_folder_url=_url(media_id),
            )
            db.add(pf)

        await db.commit()
        await db.refresh(pf)
        return pf

    # ── Upload ───────────────────────────────────────────────

    async def create_upload_session(
        self,
        organization_id: UUID,
        project_id: UUID,
        file_name: str,
        file_size: int,
        mime_type: str,
        module: str,
        db: AsyncSession,
    ) -> dict:
        """
        Create a resumable upload session.
        Returns {"session_uri": "...", "file_reference_id": UUID}.
        """
        access_token = await google_oauth_service.get_valid_access_token(organization_id, db)

        # Determine target folder
        folder_id = await self._resolve_folder(organization_id, project_id, module, db)

        # Initiate resumable upload
        session_uri = await self._initiate_resumable_upload(
            access_token, file_name, mime_type, folder_id
        )

        # Pre-create file reference
        ref = CloudFileReference(
            organization_id=organization_id,
            project_id=project_id,
            module=module,
            file_name=file_name,
            file_size=str(file_size),
            mime_type=mime_type,
            storage_provider="google_drive",
        )
        db.add(ref)
        await db.commit()
        await db.refresh(ref)

        return {"session_uri": session_uri, "file_reference_id": ref.id}

    async def confirm_upload(
        self,
        organization_id: UUID,
        file_reference_id: UUID,
        drive_file_id: str,
        drive_file_url: Optional[str],
        db: AsyncSession,
    ) -> CloudFileReference:
        """Mark upload as completed and store Drive identifiers."""
        query = select(CloudFileReference).where(
            CloudFileReference.id == file_reference_id,
            CloudFileReference.organization_id == organization_id,
        )
        result = await db.execute(query)
        ref = result.scalar_one_or_none()
        if not ref:
            raise ValueError("File reference not found")

        ref.external_id = drive_file_id
        ref.external_url = drive_file_url or f"https://drive.google.com/file/d/{drive_file_id}/view"
        await db.commit()
        await db.refresh(ref)
        return ref

    # ── Download ─────────────────────────────────────────────

    async def get_download_url(
        self,
        organization_id: UUID,
        file_reference_id: UUID,
        db: AsyncSession,
    ) -> dict:
        """
        Generate a temporary download link for a Drive file.
        Returns {"download_url": "...", "expires_in": seconds}.
        """
        query = select(CloudFileReference).where(
            CloudFileReference.id == file_reference_id,
            CloudFileReference.organization_id == organization_id,
        )
        result = await db.execute(query)
        ref = result.scalar_one_or_none()
        if not ref or not ref.external_id:
            raise ValueError("File reference not found or not on Drive")

        access_token = await google_oauth_service.get_valid_access_token(organization_id, db)

        # Use alt=media URL with access token — valid for token lifetime
        download_url = (
            f"{DRIVE_API}/files/{ref.external_id}?alt=media"
            f"&access_token={access_token}"
        )
        return {"download_url": download_url, "file_name": ref.file_name, "expires_in": 3600}

    # ── List ──────────────────────────────────────────────────

    async def list_folder_files(
        self,
        organization_id: UUID,
        folder_id: str,
        db: AsyncSession,
    ) -> list[dict]:
        """
        List all files in a Google Drive folder.
        Returns a list of dicts with: id, name, mimeType, size, webViewLink, createdTime.
        Excludes sub-folders (only files).
        """
        try:
            access_token = await google_oauth_service.get_valid_access_token(organization_id, db)
            files: list[dict] = []
            page_token: str | None = None

            async with httpx.AsyncClient() as client:
                while True:
                    params: dict = {
                        "q": f"'{folder_id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'",
                        "fields": "nextPageToken, files(id, name, mimeType, size, webViewLink, createdTime)",
                        "pageSize": 100,
                    }
                    if page_token:
                        params["pageToken"] = page_token

                    resp = await client.get(
                        f"{DRIVE_API}/files",
                        params=params,
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    files.extend(data.get("files", []))

                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break

            return files
        except Exception as e:
            logger.warning(f"Failed to list folder {folder_id}: {e}")
            return None

    # ── Delete ───────────────────────────────────────────────

    async def delete_file(
        self,
        organization_id: UUID,
        drive_file_id: str,
        db: AsyncSession,
    ) -> bool:
        """Delete a file from Google Drive. Returns True if successful."""
        try:
            access_token = await google_oauth_service.get_valid_access_token(organization_id, db)
            async with httpx.AsyncClient() as client:
                resp = await client.delete(
                    f"{DRIVE_API}/files/{drive_file_id}",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                # 204 = success, 404 = already deleted
                if resp.status_code in (204, 404):
                    return True
                resp.raise_for_status()
                return True
        except Exception as e:
            logger.warning(f"Failed to delete file {drive_file_id} from Drive: {e}")
            return False

    # ── Private helpers ──────────────────────────────────────

    async def _get_creds(
        self, organization_id: UUID, db: AsyncSession
    ) -> GoogleDriveCredentials:
        query = select(GoogleDriveCredentials).where(
            GoogleDriveCredentials.organization_id == organization_id
        )
        result = await db.execute(query)
        creds = result.scalar_one_or_none()
        if not creds:
            raise ValueError("Google Drive not connected")
        return creds

    async def _create_folder(
        self, access_token: str, name: str, parent_id: Optional[str]
    ) -> str:
        """Create a folder on Google Drive, return its ID."""
        metadata: dict = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
        }
        if parent_id:
            metadata["parents"] = [parent_id]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{DRIVE_API}/files",
                headers={"Authorization": f"Bearer {access_token}"},
                json=metadata,
                params={"fields": "id"},
            )
            resp.raise_for_status()
            return resp.json()["id"]

    async def _resolve_folder(
        self,
        organization_id: UUID,
        project_id: UUID,
        module: str,
        db: AsyncSession,
    ) -> str:
        """Get the target folder ID for a module upload."""
        query = select(ProjectDriveFolder).where(
            ProjectDriveFolder.organization_id == organization_id,
            ProjectDriveFolder.project_id == project_id,
        )
        result = await db.execute(query)
        pf = result.scalar_one_or_none()

        if not pf or not pf.project_folder_id:
            raise ValueError(
                "Project folders not set up. Call ensure_project_folders first."
            )

        mapping = {
            "scripts": pf.scripts_folder_id,
            "shooting_days": pf.shooting_days_folder_id,
            "media": pf.media_folder_id,
        }
        folder_id = mapping.get(module, pf.project_folder_id)
        if not folder_id:
            folder_id = pf.project_folder_id
        return folder_id  # type: ignore[return-value]

    async def _initiate_resumable_upload(
        self,
        access_token: str,
        file_name: str,
        mime_type: str,
        parent_folder_id: str,
    ) -> str:
        """
        Start a resumable upload and return the session URI.
        The browser will PUT chunks directly to this URI.
        The Origin header is critical — Google uses it to set CORS
        headers on subsequent PUT requests from the browser.
        """
        metadata = {
            "name": file_name,
            "parents": [parent_folder_id],
        }

        # Determine frontend origin for CORS
        frontend_url = str(getattr(settings, "FRONTEND_URL", "https://produzo.vercel.app"))
        # Strip trailing slash
        origin = frontend_url.rstrip("/")

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{DRIVE_UPLOAD_API}/files",
                params={
                    "uploadType": "resumable",
                    "fields": "id,webViewLink",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                    "X-Upload-Content-Type": mime_type,
                    "Origin": origin,
                },
                json=metadata,
            )
            resp.raise_for_status()
            session_uri = resp.headers.get("Location")
            if not session_uri:
                raise ValueError("Google did not return a resumable upload URI")
            return session_uri


# Global instance
google_drive_service = GoogleDriveService()
