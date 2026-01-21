from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union
from pydantic import BaseModel, ConfigDict

# Type variable for generic schemas
T = TypeVar('T')


class BaseSchema(BaseModel):
    """
    Base schema with common fields for all entities.
    """
    model_config = ConfigDict(from_attributes=True)

    id: Any
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CreateSchema(BaseModel):
    """
    Mixin for create operations - excludes read-only fields.
    """
    pass


class UpdateSchema(BaseModel):
    """
    Mixin for update operations - all fields optional.
    """
    pass


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Generic paginated response schema.
    """
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PaginationParams(BaseModel):
    """
    Parameters for pagination.
    """
    page: int = 1
    page_size: int = 50
    order_by: Optional[str] = None
    order_desc: bool = False


class FilterParams(BaseModel):
    """
    Base filter parameters for list endpoints.
    """
    search: Optional[str] = None
    is_active: Optional[bool] = None


class ErrorResponse(BaseModel):
    """
    Standard error response schema.
    """
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None


class SuccessResponse(BaseModel, Generic[T]):
    """
    Generic success response schema.
    """
    success: bool = True
    data: T
    message: Optional[str] = None


class ListResponse(BaseModel, Generic[T]):
    """
    Response schema for list endpoints.
    """
    success: bool = True
    data: List[T]
    pagination: PaginatedResponse[T]
    message: Optional[str] = None