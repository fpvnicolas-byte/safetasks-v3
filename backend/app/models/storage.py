from sqlalchemy import Column, String, BIGINT, TIMESTAMP, func, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from app.core.base import Base

class StoredFile(Base):
    __tablename__ = "stored_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    
    # Detalhes do arquivo
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False) # Caminho no bucket/drive
    file_size_bytes = Column(BIGINT, nullable=False)
    mime_type = Column(String, nullable=False)
    
    # Cloud Sync (Google Drive)
    drive_file_id = Column(String, nullable=True)
    drive_web_link = Column(String, nullable=True)
    is_synced = Column(Boolean, default=False)
    
    # CORREÇÃO: Usamos 'file_metadata' para evitar conflito com palavra reservada
    file_metadata = Column(JSONB, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())