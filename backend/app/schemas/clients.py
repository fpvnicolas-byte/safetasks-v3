from pydantic import BaseModel, ConfigDict, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional


class ClientBase(BaseModel):
    """Base schema for Client."""
    name: str
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None  # CPF/CNPJ
    phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ClientCreate(ClientBase):
    """Schema for creating a Client."""
    pass


class ClientUpdate(BaseModel):
    """Schema for updating a Client."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    document_id: Optional[str] = None
    phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class Client(ClientBase):
    """Schema for Client response."""
    id: UUID
    organization_id: UUID
    created_at: datetime
