from typing import Any, Dict, Generic, List, Optional, Type, TypeVar
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_active_user, UserContext
from .crud import CRUDBase
from .database import get_db
from .schemas import (
    BaseSchema,
    CreateSchema,
    UpdateSchema,
    FilterParams,
    PaginationParams,
    PaginatedResponse,
    SuccessResponse,
    ListResponse,
    ErrorResponse
)

# Type variables for generic router
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType", bound=CreateSchema)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=UpdateSchema)
ReadSchemaType = TypeVar("ReadSchemaType", bound=BaseSchema)


class BaseRouter(Generic[ModelType, CreateSchemaType, UpdateSchemaType, ReadSchemaType]):
    """
    Base router class providing common CRUD endpoints.
    All domain routers should inherit from this class.
    """

    def __init__(
        self,
        prefix: str,
        tags: List[str],
        crud_service: CRUDBase[ModelType, CreateSchemaType, UpdateSchemaType],
        read_schema: Type[ReadSchemaType],
        create_schema: Type[CreateSchemaType],
        update_schema: Type[UpdateSchemaType],
        filter_schema: Optional[Type[FilterParams]] = None
    ):
        """
        Initialize the base router.

        Args:
            prefix: API prefix for the router
            tags: OpenAPI tags for documentation
            crud_service: CRUD service instance for the model
            read_schema: Pydantic schema for read operations
            create_schema: Pydantic schema for create operations
            update_schema: Pydantic schema for update operations
            filter_schema: Optional filter schema for list operations
        """
        self.router = APIRouter(prefix=prefix, tags=tags)
        self.crud_service = crud_service
        self.read_schema = read_schema
        self.create_schema = create_schema
        self.update_schema = update_schema
        self.filter_schema = filter_schema or FilterParams

        self._setup_routes()

    def _setup_routes(self):
        """Set up the CRUD routes."""

        @self.router.get(
            "/",
            response_model=ListResponse[self.read_schema],
            summary="List items",
            description="Get a paginated list of items with optional filtering."
        )
        async def read_items(
            db: AsyncSession = Depends(get_db),
            current_user: Dict = Depends(get_current_active_user),
            page: int = Query(1, ge=1, description="Page number"),
            page_size: int = Query(50, ge=1, le=100, description="Items per page"),
            search: Optional[str] = Query(None, description="Search query"),
            order_by: Optional[str] = Query(None, description="Field to order by"),
            order_desc: bool = Query(False, description="Order descending"),
            is_active: Optional[bool] = Query(None, description="Filter by active status")
        ):
            """Get paginated list of items."""
            # Create filter params
            filters = self.filter_schema(
                search=search,
                is_active=is_active
            )

            # Calculate pagination
            skip = (page - 1) * page_size

            # Get items and count
            items = await self.crud_service.get_multi(
                db=db,
                skip=skip,
                limit=page_size,
                filters=filters if any([search, is_active is not None]) else None,
                order_by=order_by,
                order_desc=order_desc
            )

            total = await self.crud_service.get_count(db=db, filters=filters if any([search, is_active is not None]) else None)
            total_pages = (total + page_size - 1) // page_size

            # Create pagination response
            pagination = PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1
            )

            return ListResponse(
                data=items,
                pagination=pagination,
                message=f"Found {len(items)} items"
            )

        @self.router.get(
            "/{item_id}",
            response_model=SuccessResponse[self.read_schema],
            summary="Get item by ID",
            description="Get a single item by its ID."
        )
        async def read_item(
            item_id: Any,
            db: AsyncSession = Depends(get_db),
            current_user: Dict = Depends(get_current_active_user)
        ):
            """Get item by ID."""
            item = await self.crud_service.get(db=db, id=item_id)
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found"
                )

            return SuccessResponse(
                data=item,
                message="Item retrieved successfully"
            )

        @self.router.post(
            "/",
            response_model=SuccessResponse[self.read_schema],
            status_code=status.HTTP_201_CREATED,
            summary="Create item",
            description="Create a new item."
        )
        async def create_item(
            item_in: self.create_schema,
            db: AsyncSession = Depends(get_db),
            current_user: Dict = Depends(get_current_active_user)
        ):
            """Create new item."""
            item = await self.crud_service.create(db=db, obj_in=item_in)
            return SuccessResponse(
                data=item,
                message="Item created successfully"
            )

        @self.router.put(
            "/{item_id}",
            response_model=SuccessResponse[self.read_schema],
            summary="Update item",
            description="Update an existing item by ID."
        )
        async def update_item(
            item_id: Any,
            item_in: self.update_schema,
            db: AsyncSession = Depends(get_db),
            current_user: Dict = Depends(get_current_active_user)
        ):
            """Update item by ID."""
            # Check if item exists
            item = await self.crud_service.get(db=db, id=item_id)
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found"
                )

            # Update item
            updated_item = await self.crud_service.update(
                db=db,
                db_obj=item,
                obj_in=item_in
            )

            return SuccessResponse(
                data=updated_item,
                message="Item updated successfully"
            )

        @self.router.delete(
            "/{item_id}",
            response_model=SuccessResponse[Dict[str, Any]],
            summary="Delete item",
            description="Delete an item by ID."
        )
        async def delete_item(
            item_id: Any,
            db: AsyncSession = Depends(get_db),
            current_user: Dict = Depends(get_current_active_user)
        ):
            """Delete item by ID."""
            # Check if item exists
            item = await self.crud_service.exists(db=db, id=item_id)
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Item not found"
                )

            # Delete item
            await self.crud_service.remove(db=db, id=item_id)

            return SuccessResponse(
                data={"id": item_id},
                message="Item deleted successfully"
            )

    def get_router(self) -> APIRouter:
        """
        Get the configured FastAPI router.

        Returns:
            FastAPI APIRouter instance with all CRUD routes
        """
        return self.router