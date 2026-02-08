from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, require_owner_admin_or_producer, require_billing_active
from app.db.session import get_db
from app.services.google_drive import google_drive_service
from app.services.cloud import cloud_sync_service
from app.schemas.cloud import (
    GoogleDriveCredentials, GoogleDriveCredentialsCreate, GoogleDriveCredentialsUpdate,
    SyncFileRequest, SyncResult,
    ProjectSyncRequest, ProjectSyncResult,
    SyncStatusResponse
)


router = APIRouter()


@router.post(
    "/google/auth",
    response_model=GoogleDriveCredentials,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def setup_google_drive_auth(
    credentials_in: GoogleDriveCredentialsCreate,
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> GoogleDriveCredentials:
    """
    Setup Google Drive authentication for the organization.
    Only admins and managers can configure Google Drive access.
    Requires a Google Service Account key for backend automation.
    """
    organization_id = profile.organization_id
    from app.models.cloud import GoogleDriveCredentials as GDCModel

    # Check if credentials already exist
    from sqlalchemy import select
    existing_query = select(GDCModel).where(GDCModel.organization_id == organization_id)
    result = await db.execute(existing_query)
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing credentials
        for field, value in credentials_in.dict(exclude_unset=True).items():
            setattr(existing, field, value)
        db.add(existing)
    else:
        # Create new credentials
        new_credentials = GDCModel(
            organization_id=organization_id,
            **credentials_in.dict()
        )
        db.add(new_credentials)

    await db.commit()

    if existing:
        await db.refresh(existing)
        return existing
    else:
        await db.refresh(new_credentials)
        return new_credentials


@router.get("/google/auth", response_model=GoogleDriveCredentials, dependencies=[Depends(require_owner_admin_or_producer)])
async def get_google_drive_auth(
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> GoogleDriveCredentials:
    """
    Get Google Drive authentication status for the organization.
    """
    organization_id = profile.organization_id
    from app.models.cloud import GoogleDriveCredentials as GDCModel
    from sqlalchemy import select

    query = select(GDCModel).where(GDCModel.organization_id == organization_id)
    result = await db.execute(query)
    credentials = result.scalar_one_or_none()

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google Drive not configured for this organization"
        )

    return credentials


@router.put(
    "/google/auth",
    response_model=GoogleDriveCredentials,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_google_drive_auth(
    credentials_in: GoogleDriveCredentialsUpdate,
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> GoogleDriveCredentials:
    """
    Update Google Drive authentication settings.
    Only admins and managers can update Google Drive settings.
    """
    organization_id = profile.organization_id
    from app.models.cloud import GoogleDriveCredentials as GDCModel
    from sqlalchemy import select

    query = select(GDCModel).where(GDCModel.organization_id == organization_id)
    result = await db.execute(query)
    credentials = result.scalar_one_or_none()

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google Drive not configured for this organization"
        )

    # Update fields
    for field, value in credentials_in.dict(exclude_unset=True).items():
        setattr(credentials, field, value)

    db.add(credentials)
    await db.commit()
    await db.refresh(credentials)

    return credentials


@router.delete(
    "/google/auth",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def remove_google_drive_auth(
    profile: "Profile" = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Remove Google Drive authentication for the organization.
    Only admins and managers can remove Google Drive access.
    """
    organization_id = profile.organization_id
    from app.models.cloud import GoogleDriveCredentials as GDCModel
    from sqlalchemy import select

    query = select(GDCModel).where(GDCModel.organization_id == organization_id)
    result = await db.execute(query)
    credentials = result.scalar_one_or_none()

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google Drive not configured for this organization"
        )

    await db.delete(credentials)
    await db.commit()

    return {"message": "Google Drive authentication removed successfully"}


@router.post(
    "/sync/file",
    response_model=SyncResult,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def sync_file_to_drive(
    sync_request: SyncFileRequest,
    background_tasks: BackgroundTasks,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> SyncResult:
    """
    Sync a specific file to Google Drive.
    This operation runs in the background to prevent API timeouts.
    """
    organization_id = profile.organization_id
    try:
        # Start the sync operation
        result = await cloud_sync_service.sync_file_to_drive(
            file_id=sync_request.file_id,
            project_id=sync_request.project_id,
            module=sync_request.module,
            db=db
        )

        return SyncResult(**result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate file sync: {str(e)}"
        )


@router.post(
    "/projects/{project_id}/sync-all",
    response_model=ProjectSyncResult,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def sync_project_files(
    project_id: UUID,
    sync_request: ProjectSyncRequest = None,
    background_tasks: BackgroundTasks = None,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectSyncResult:
    """
    Sync all files for a project to Google Drive.
    This operation syncs files from all modules (proposals, shooting_days, scripts, media).
    """
    organization_id = profile.organization_id
    if sync_request is None:
        sync_request = ProjectSyncRequest()

    try:
        # Start the project sync operation
        result = await cloud_sync_service.sync_project_files(
            project_id=project_id,
            modules=sync_request.modules,
            db=db
        )

        return ProjectSyncResult(**result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate project sync: {str(e)}"
        )


@router.get("/status", response_model=SyncStatusResponse, dependencies=[Depends(require_owner_admin_or_producer)])
async def get_sync_status(
    project_id: UUID = None,
    file_path: str = None,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> SyncStatusResponse:
    """
    Get synchronization status for files.
    Can filter by project or specific file path.
    """
    organization_id = profile.organization_id
    try:
        status_result = await cloud_sync_service.get_sync_status(
            organization_id=organization_id,
            file_path=file_path,
            project_id=project_id,
            db=db
        )

        return SyncStatusResponse(**status_result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sync status: {str(e)}"
        )


@router.post(
    "/check-alerts",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def check_sync_alerts(
    background_tasks: BackgroundTasks,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Manually trigger sync status checks and send alerts.
    Only admins and managers can trigger alerts.
    """
    organization_id = profile.organization_id
    try:
        # This could check for failed syncs and send notifications
        # For now, return a placeholder response
        return {
            "message": "Sync alert check completed",
            "alerts_checked": 0,
            "alerts_sent": 0
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check sync alerts: {str(e)}"
        )


@router.get("/projects/{project_id}/folders", dependencies=[Depends(require_owner_admin_or_producer)])
async def get_project_drive_folders(
    project_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Get Google Drive folder information for a project.
    """
    organization_id = profile.organization_id
    from app.models.cloud import ProjectDriveFolder
    from sqlalchemy import select

    query = select(ProjectDriveFolder).where(
        ProjectDriveFolder.organization_id == organization_id,
        ProjectDriveFolder.project_id == project_id
    )
    result = await db.execute(query)
    folders = result.scalar_one_or_none()

    if not folders:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project Google Drive folders not found. Sync a file first to create folders."
        )

    return {
        "project_id": str(project_id),
        "project_folder": {
            "id": folders.project_folder_id,
            "url": folders.project_folder_url
        } if folders.project_folder_id else None,
        "scripts_folder": {
            "id": folders.scripts_folder_id,
            "url": folders.scripts_folder_url
        } if folders.scripts_folder_id else None,
        "shooting_days_folder": {
            "id": folders.shooting_days_folder_id,
            "url": folders.shooting_days_folder_url
        } if folders.shooting_days_folder_id else None,
        "media_folder": {
            "id": folders.media_folder_id,
            "url": folders.media_folder_url
        } if folders.media_folder_id else None,
    }
