from sqlalchemy import Column, String, TIMESTAMP, func, ForeignKey, TEXT
from sqlalchemy.dialects.postgresql import UUID
from app.core.base import Base
import uuid


class GoogleDriveCredentials(Base):
    __tablename__ = "google_drive_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True)

    # OAuth2 tokens
    access_token = Column(TEXT, nullable=True)
    refresh_token = Column(TEXT, nullable=True)
    token_expiry = Column(TIMESTAMP(timezone=True), nullable=True)
    connected_email = Column(String, nullable=True)
    oauth_scopes = Column(String, nullable=True)  # comma-separated scopes

    # Folder IDs
    root_folder_id = Column(String, nullable=True)
    root_folder_url = Column(String, nullable=True)

    # Metadata
    connected_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {'schema': None}
    )


class CloudFileReference(Base):
    __tablename__ = "cloud_file_references"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    module = Column(String, nullable=True)  # scripts, shooting_days, media

    # File metadata
    file_name = Column(String, nullable=False)
    file_size = Column(String, nullable=True)  # bytes as string for large files
    mime_type = Column(String, nullable=True)

    # Storage location
    storage_provider = Column(String, nullable=False)  # "supabase" or "google_drive"
    supabase_path = Column(String, nullable=True)  # path in Supabase Storage
    external_id = Column(String, nullable=True)  # Google Drive file ID
    external_url = Column(String, nullable=True)  # Google Drive file URL

    # Cached thumbnail
    thumbnail_path = Column(String, nullable=True)  # Supabase path to thumbnail

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {'schema': None}
    )


class ProjectDriveFolder(Base):
    __tablename__ = "project_drive_folders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, unique=True)

    # Google Drive folder IDs
    project_folder_id = Column(String, nullable=True)  # Project root folder
    project_folder_url = Column(String, nullable=True)
    scripts_folder_id = Column(String, nullable=True)
    scripts_folder_url = Column(String, nullable=True)
    shooting_days_folder_id = Column(String, nullable=True)
    shooting_days_folder_url = Column(String, nullable=True)
    media_folder_id = Column(String, nullable=True)
    media_folder_url = Column(String, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        {'schema': None}
    )
