from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class BugReportCreate(BaseModel):
    title: str
    category: str  # bug, feature_request, other
    description: str


class BugReportResponse(BaseModel):
    id: UUID
    organization_id: UUID
    reporter_profile_id: UUID
    title: str
    category: str
    description: str
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlatformBugReportUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
