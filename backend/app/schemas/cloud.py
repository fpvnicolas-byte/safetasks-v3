from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional


# ─── OAuth ──────────────────────────────────────────────────

class GoogleOAuthConnectRequest(BaseModel):
    redirect_uri: str

class GoogleOAuthConnectResponse(BaseModel):
    authorization_url: str

class GoogleOAuthStatusResponse(BaseModel):
    connected: bool
    connected_email: Optional[str] = None
    connected_at: Optional[datetime] = None
    root_folder_url: Optional[str] = None

class GoogleOAuthDisconnectResponse(BaseModel):
    status: str
    message: str


# ─── Upload ─────────────────────────────────────────────────

class DriveUploadSessionRequest(BaseModel):
    file_name: str
    file_size: int  # bytes
    mime_type: str
    project_id: UUID
    module: str  # scripts, shooting_days, media

class DriveUploadSessionResponse(BaseModel):
    session_uri: str  # Google resumable upload URI
    file_reference_id: UUID  # pre-created file reference ID

class DriveUploadCompleteRequest(BaseModel):
    file_reference_id: UUID
    drive_file_id: str
    drive_file_url: Optional[str] = None

class DriveUploadCompleteResponse(BaseModel):
    id: UUID
    file_name: str
    storage_provider: str
    external_id: str
    external_url: Optional[str]


# ─── Download ───────────────────────────────────────────────

class DriveDownloadUrlResponse(BaseModel):
    download_url: str
    expires_in: int  # seconds


# ─── File Reference ─────────────────────────────────────────

class CloudFileReferenceResponse(BaseModel):
    id: UUID
    organization_id: UUID
    project_id: Optional[UUID]
    module: Optional[str]
    file_name: str
    file_size: Optional[str]
    mime_type: Optional[str]
    storage_provider: str
    external_url: Optional[str]
    thumbnail_path: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Project Folders ────────────────────────────────────────

class ProjectDriveFolderResponse(BaseModel):
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

    model_config = ConfigDict(from_attributes=True)
