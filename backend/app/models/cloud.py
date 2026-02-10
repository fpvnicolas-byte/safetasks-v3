from sqlalchemy import Column, String, TIMESTAMP, func, ForeignKey, TEXT, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.base import Base
import uuid


class GoogleDriveCredentials(Base):
    __tablename__ = "google_drive_credentials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True)

    # OAuth2 credentials (JSON)
    credentials = Column(JSONB, nullable=True)  # Google OAuth2 credentials

    # Service account credentials (JSON) - preferred for backend automation
    service_account_key = Column(JSONB, nullable=True)  # Google Service Account key

    # Folder IDs
    root_folder_id = Column(String, nullable=True)  # SafeTasks_V3/{org_name}
    root_folder_url = Column(String, nullable=True)

    # Settings
    auto_sync_enabled = Column(Boolean, default=True)
    sync_on_proposal_approval = Column(Boolean, default=True)
    sync_on_shooting_day_finalized = Column(Boolean, default=True)

    # Metadata
    connected_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_sync_at = Column(TIMESTAMP(timezone=True), nullable=True)
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
