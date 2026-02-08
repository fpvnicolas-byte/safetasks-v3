from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class InviteCreate(BaseModel):
    email: str = Field(min_length=1)
    role_v2: str  # admin | producer | finance | freelancer
    supplier_id: Optional[UUID] = None


class InviteAccept(BaseModel):
    token: str = Field(min_length=1)


class InviteOut(BaseModel):
    id: UUID
    invited_email: str
    role_v2: str
    status: str
    supplier_id: Optional[UUID] = None
    invited_by_id: UUID
    expires_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InviteCreateResponse(BaseModel):
    invite: InviteOut
    invite_link: str
    seat_warning: Optional[str] = None


class TeamMemberOut(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    effective_role: str
    is_master_owner: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChangeRolePayload(BaseModel):
    role_v2: str  # admin | producer | finance | freelancer
