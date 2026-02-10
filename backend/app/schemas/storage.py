from pydantic import BaseModel, ConfigDict
from typing import Optional


class FileUploadRequest(BaseModel):
    """Schema for file upload request."""
    module: str  # kits, scripts, shooting-days, proposals
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


