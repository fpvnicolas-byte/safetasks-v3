"""
Cloud API endpoints — OAuth2 Google Drive integration.
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
    DriveUploadSessionRequest,
    DriveUploadSessionResponse,
    DriveUploadCompleteRequest,
    DriveUploadCompleteResponse,
    DriveDownloadUrlResponse,
    ProjectDriveFolderResponse,
)
from app.services.google_oauth import google_oauth_service
from app.services.google_drive import google_drive_service


router = APIRouter()


# ─── OAuth2 Flow ────────────────────────────────────────────

@router.get(
    "/google/auth/connect",
    response_model=GoogleOAuthConnectResponse,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)],
)
async def connect_google_drive(
    profile=Depends(get_current_profile),
):
    """Initiate Google Drive OAuth2 connection — generates authorization URL."""
    auth_url = google_oauth_service.generate_auth_url(profile.organization_id)
    return GoogleOAuthConnectResponse(authorization_url=auth_url)


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
    try:
        # Verify state matches org_id to prevent CSRF / cross-org injection
        org_id_from_state = state.split(":")[0]
        if str(profile.organization_id) != org_id_from_state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter: organization mismatch",
            )

        await google_oauth_service.handle_callback(code, state, db)
        return {"message": "Google Drive connected successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect Google Drive: {str(e)}",
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
    creds = await google_oauth_service.get_status(profile.organization_id, db)

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
    await google_oauth_service.disconnect(profile.organization_id, db)
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
    try:
        # Fetch project to get name
        from app.models.projects import Project
        from sqlalchemy import select
        project_query = select(Project).where(Project.id == body.project_id, Project.organization_id == profile.organization_id)
        project_result = await db.execute(project_query)
        project = project_result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        # Ensure project folders exist
        await google_drive_service.ensure_project_folders(
            profile.organization_id, body.project_id, project.title, db
        )

        result = await google_drive_service.create_upload_session(
            organization_id=profile.organization_id,
            project_id=body.project_id,
            file_name=body.file_name,
            file_size=body.file_size,
            mime_type=body.mime_type,
            module=body.module,
            db=db,
        )
        return DriveUploadSessionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create upload session: {str(e)}",
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
    try:
        ref = await google_drive_service.confirm_upload(
            organization_id=profile.organization_id,
            file_reference_id=body.file_reference_id,
            drive_file_id=body.drive_file_id,
            drive_file_url=body.drive_file_url,
            db=db,
        )
        return DriveUploadCompleteResponse(
            id=ref.id,
            file_name=ref.file_name,
            storage_provider=ref.storage_provider,
            external_id=ref.external_id,
            external_url=ref.external_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


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
    try:
        result = await google_drive_service.get_download_url(
            organization_id=profile.organization_id,
            file_reference_id=file_reference_id,
            db=db,
        )
        return DriveDownloadUrlResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


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
    # Fetch project to get name
    from app.models.projects import Project
    from sqlalchemy import select
    project_query = select(Project).where(Project.id == project_id, Project.organization_id == profile.organization_id)
    project_result = await db.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Try to find existing folders or create new ones
    folders = await google_drive_service.ensure_project_folders(
        profile.organization_id, project_id, project.title, db
    )
    return folders
