from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List


class GoogleDriveCredentialsBase(BaseModel):
    """Base schema for Google Drive credentials."""
    service_account_key: Optional[Dict[str, Any]] = None
    auto_sync_enabled: bool = True
    sync_on_proposal_approval: bool = True
    sync_on_shooting_day_finalized: bool = True

    model_config = ConfigDict(from_attributes=True)


class GoogleDriveCredentialsCreate(GoogleDriveCredentialsBase):
    """Schema for creating Google Drive credentials."""
    service_account_key: Dict[str, Any]  # Required for creation


class GoogleDriveCredentials(GoogleDriveCredentialsBase):
    """Schema for Google Drive credentials response."""
    id: UUID
    organization_id: UUID
    root_folder_id: Optional[str]
    root_folder_url: Optional[str]
    connected_at: Optional[datetime]
    last_sync_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class GoogleDriveCredentialsUpdate(BaseModel):
    """Schema for updating Google Drive credentials."""
    service_account_key: Optional[Dict[str, Any]] = None
    auto_sync_enabled: Optional[bool] = None
    sync_on_proposal_approval: Optional[bool] = None
    sync_on_shooting_day_finalized: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectDriveFolderBase(BaseModel):
    """Base schema for project drive folder."""
    pass

    model_config = ConfigDict(from_attributes=True)


class ProjectDriveFolder(ProjectDriveFolderBase):
    """Schema for project drive folder response."""
    id: UUID
    organization_id: UUID
    project_id: UUID
    project_folder_id: Optional[str]
    project_folder_url: Optional[str]
    scripts_folder_id: Optional[str]
    scripts_folder_url: Optional[str]
    shooting_days_folder_id: Optional[str]
    shooting_days_folder_url: Optional[str]
    media_folder_id: Optional[str]
    media_folder_url: Optional[str]
    created_at: datetime
    updated_at: datetime


class GoogleDriveFolderInfo(BaseModel):
    """Schema for Google Drive folder information."""
    folder_id: str
    folder_url: str
    name: str
    created_time: str

    model_config = ConfigDict(from_attributes=True)
