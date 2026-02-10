"""
Cloud API endpoints — OAuth2 Google Drive integration.
Endpoints will be fully implemented in Task 5.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, require_owner_admin_or_producer, require_billing_active
from app.db.session import get_db
from app.schemas.cloud import (
    GoogleOAuthConnectResponse,
    GoogleOAuthStatusResponse,
    GoogleOAuthDisconnectResponse,
    DriveUploadSessionRequest, DriveUploadSessionResponse,
    DriveUploadCompleteRequest, DriveUploadCompleteResponse,
    DriveDownloadUrlResponse,
    ProjectDriveFolderResponse,
)


router = APIRouter()


# ─── OAuth2 Flow ────────────────────────────────────────────

@router.get(
    "/google/auth/connect",
    response_model=GoogleOAuthConnectResponse,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)],
)
async def connect_google_drive(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Initiate Google Drive OAuth2 connection — generates authorization URL."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OAuth2 connect will be implemented in Task 5",
    )


@router.get(
    "/google/auth/callback",
    dependencies=[Depends(require_owner_admin_or_producer)],
)
async def google_auth_callback(
    code: str,
    state: str,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth2 callback — exchanges code for tokens."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="OAuth2 callback will be implemented in Task 5",
    )


@router.get(
    "/google/auth/status",
    response_model=GoogleOAuthStatusResponse,
    dependencies=[Depends(require_owner_admin_or_producer)],
)
async def google_drive_status(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get Google Drive connection status for the organization."""
    organization_id = profile.organization_id
    from app.models.cloud import GoogleDriveCredentials as GDCModel
    from sqlalchemy import select

    query = select(GDCModel).where(GDCModel.organization_id == organization_id)
    result = await db.execute(query)
    creds = result.scalar_one_or_none()

    if not creds:
        return GoogleOAuthStatusResponse(connected=False)

    return GoogleOAuthStatusResponse(
        connected=True,
        connected_email=creds.connected_email,
        connected_at=creds.connected_at,
        root_folder_url=creds.root_folder_url,
    )


@router.delete(
    "/google/auth",
    response_model=GoogleOAuthDisconnectResponse,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)],
)
async def disconnect_google_drive(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Google Drive — revokes tokens and removes credentials."""
    organization_id = profile.organization_id
    from app.models.cloud import GoogleDriveCredentials as GDCModel
    from sqlalchemy import select

    query = select(GDCModel).where(GDCModel.organization_id == organization_id)
    result = await db.execute(query)
    creds = result.scalar_one_or_none()

    if not creds:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google Drive not configured for this organization",
        )

    await db.delete(creds)
    await db.commit()

    return GoogleOAuthDisconnectResponse(
        status="disconnected",
        message="Google Drive disconnected successfully",
    )


# ─── Upload ─────────────────────────────────────────────────

@router.post(
    "/google/upload/session",
    response_model=DriveUploadSessionResponse,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)],
)
async def create_upload_session(
    body: DriveUploadSessionRequest,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Create a resumable upload session for direct browser-to-Drive upload."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Upload session will be implemented in Task 5",
    )


@router.post(
    "/google/upload/complete",
    response_model=DriveUploadCompleteResponse,
    dependencies=[Depends(require_owner_admin_or_producer)],
)
async def confirm_upload(
    body: DriveUploadCompleteRequest,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a completed upload and finalize the file reference."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Upload confirm will be implemented in Task 5",
    )


# ─── Download ───────────────────────────────────────────────

@router.get(
    "/google/download/{file_reference_id}",
    response_model=DriveDownloadUrlResponse,
    dependencies=[Depends(require_owner_admin_or_producer)],
)
async def get_download_url(
    file_reference_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Generate a signed download URL for a file stored on Google Drive."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Download URL will be implemented in Task 5",
    )


# ─── Project Folders ────────────────────────────────────────

@router.get(
    "/projects/{project_id}/folders",
    response_model=ProjectDriveFolderResponse,
    dependencies=[Depends(require_owner_admin_or_producer)],
)
async def get_project_drive_folders(
    project_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get Google Drive folder information for a project."""
    organization_id = profile.organization_id
    from app.models.cloud import ProjectDriveFolder
    from sqlalchemy import select

    query = select(ProjectDriveFolder).where(
        ProjectDriveFolder.organization_id == organization_id,
        ProjectDriveFolder.project_id == project_id,
    )
    result = await db.execute(query)
    folders = result.scalar_one_or_none()

    if not folders:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project Drive folders not found",
        )

    return folders
