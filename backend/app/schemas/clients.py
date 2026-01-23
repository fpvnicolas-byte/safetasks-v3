from pydantic import BaseModel, ConfigDict, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional


class ClientBase(BaseModel):
    """Base schema for Client."""
    name: str
    email: Optional[EmailStr] = None
    document: Optional[str] = None  # CPF/CNPJ (FIXED: was document_id)
    phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ClientCreate(ClientBase):
    """Schema for creating a Client."""
    pass


class ClientUpdate(BaseModel):
    """Schema for updating a Client."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    document: Optional[str] = None  # CPF/CNPJ (FIXED: was document_id)
    phone: Optional[str] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class Client(ClientBase):
    """Schema for Client response."""
    id: UUID
    organization_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)