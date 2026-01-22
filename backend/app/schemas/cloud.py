from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List


class GoogleDriveCredentialsBase(BaseModel):
    """Base schema for Google Drive credentials."""
    service_account_key: Optional[Dict[str, Any]] = None
    auto_sync_enabled: bool = True
    sync_on_proposal_approval: bool = True
    sync_on_call_sheet_finalized: bool = True

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
    sync_on_call_sheet_finalized: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class CloudSyncStatusBase(BaseModel):
    """Base schema for cloud sync status."""
    provider: str
    sync_status: str = "pending"
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CloudSyncStatus(CloudSyncStatusBase):
    """Schema for cloud sync status response."""
    id: UUID
    organization_id: UUID
    file_id: Optional[UUID]
    file_path: Optional[str]
    file_name: Optional[str]
    project_id: Optional[UUID]
    module: Optional[str]
    external_id: Optional[str]
    external_url: Optional[str]
    sync_started_at: Optional[datetime]
    sync_completed_at: Optional[datetime]
    file_version: Optional[str]
    created_at: datetime
    updated_at: datetime


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
    call_sheets_folder_id: Optional[str]
    call_sheets_folder_url: Optional[str]
    media_folder_id: Optional[str]
    media_folder_url: Optional[str]
    created_at: datetime
    updated_at: datetime


class SyncFileRequest(BaseModel):
    """Schema for file sync request."""
    file_id: UUID
    project_id: UUID
    module: str  # proposals, call_sheets, scripts, media

    model_config = ConfigDict(from_attributes=True)


class SyncResult(BaseModel):
    """Schema for sync operation result."""
    sync_id: str
    provider: str
    status: str  # completed, failed, pending
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    synced_at: Optional[str] = None
    error: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectSyncRequest(BaseModel):
    """Schema for project sync request."""
    modules: Optional[List[str]] = None  # proposals, call_sheets, scripts, media

    model_config = ConfigDict(from_attributes=True)


class ProjectSyncResult(BaseModel):
    """Schema for project sync result."""
    project_id: str
    organization_id: str
    modules_synced: List[str]
    sync_results: List[Dict[str, Any]]
    total_files: int
    successful_syncs: int
    failed_syncs: int

    model_config = ConfigDict(from_attributes=True)


class SyncStatusResponse(BaseModel):
    """Schema for sync status response."""
    organization_id: str
    file_path: Optional[str] = None
    project_id: Optional[str] = None
    sync_records: List[Dict[str, Any]]
    total_records: int

    model_config = ConfigDict(from_attributes=True)


class GoogleDriveFolderInfo(BaseModel):
    """Schema for Google Drive folder information."""
    folder_id: str
    folder_url: str
    name: str
    created_time: str

    model_config = ConfigDict(from_attributes=True)
