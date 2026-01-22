from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional, Dict, Any


class FileUploadRequest(BaseModel):
    """Schema for file upload request."""
    module: str  # kits, scripts, call-sheets, proposals
    filename: str

    model_config = ConfigDict(from_attributes=True)


class FileUploadResponse(BaseModel):
    """Schema for file upload response."""
    file_path: str
    bucket: str
    access_url: Optional[str] = None
    is_public: bool
    size_bytes: int
    content_type: str

    model_config = ConfigDict(from_attributes=True)


class SignedUrlRequest(BaseModel):
    """Schema for signed URL generation request."""
    bucket: str
    file_path: str
    expires_in: Optional[int] = 3600  # Default 1 hour

    model_config = ConfigDict(from_attributes=True)


class SignedUrlResponse(BaseModel):
    """Schema for signed URL response."""
    signed_url: str
    expires_in: int
    file_path: str
    bucket: str

    model_config = ConfigDict(from_attributes=True)


class CloudSyncRequest(BaseModel):
    """Schema for cloud sync request."""
    file_path: str
    providers: Optional[list] = ["google_drive"]  # google_drive, dropbox, etc.

    model_config = ConfigDict(from_attributes=True)


class CloudSyncResponse(BaseModel):
    """Schema for cloud sync response."""
    file_path: str
    organization_id: str
    results: Dict[str, Any]  # Provider-specific results

    model_config = ConfigDict(from_attributes=True)


class SyncStatusResponse(BaseModel):
    """Schema for sync status response."""
    file_path: str
    organization_id: str
    sync_status: str
    providers: list
    last_sync: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
