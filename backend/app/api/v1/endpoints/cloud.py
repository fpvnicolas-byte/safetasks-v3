from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_profile, require_owner_admin_or_producer, require_billing_active
from app.db.session import get_db
from app.schemas.cloud import (
    GoogleDriveCredentials, GoogleDriveCredentialsCreate, GoogleDriveCredentialsUpdate,
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
