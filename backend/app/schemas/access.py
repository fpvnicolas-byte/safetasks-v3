from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime


class ProjectAssignmentBase(BaseModel):
    project_id: UUID
    user_id: UUID


class ProjectAssignmentCreate(ProjectAssignmentBase):
    pass


class ProjectAssignment(ProjectAssignmentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
