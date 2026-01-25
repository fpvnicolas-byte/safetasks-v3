from typing import Generic, TypeVar, List, Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from uuid import UUID

from app.core.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base service class with generic CRUD operations.
    All operations are automatically filtered by organization_id for multi-tenancy.
    """

    def __init__(self, model: type[ModelType]):
        self.model = model

    async def get(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        id: UUID,
        options: Optional[List] = None
    ) -> Optional[ModelType]:
        """Get a single record by ID, filtered by organization_id."""
        query = select(self.model).where(
            and_(
                self.model.id == id,
                self.model.organization_id == organization_id
            )
        )

        if options:
            query = query.options(*options)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        skip: int = 0,
        limit: int = 100,
        options: Optional[List] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[ModelType]:
        """Get multiple records, filtered by organization_id."""
        query = select(self.model).where(self.model.organization_id == organization_id)

        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

        if options:
            query = query.options(*options)

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    async def create(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        obj_in: CreateSchemaType
    ) -> ModelType:
        """Create a new record, automatically setting organization_id."""
        # Handle both Pydantic models and dicts
        if isinstance(obj_in, dict):
            obj_in_data = obj_in.copy()
        else:
            obj_in_data = obj_in.dict()
        obj_in_data["organization_id"] = organization_id

        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        id: UUID,
        obj_in: UpdateSchemaType
    ) -> Optional[ModelType]:
        """Update a record, filtered by organization_id."""
        obj_data = obj_in.dict(exclude_unset=True)

        query = (
            update(self.model)
            .where(
                and_(
                    self.model.id == id,
                    self.model.organization_id == organization_id
                )
            )
            .values(**obj_data)
        )

        await db.execute(query)

        # Return the updated object
        return await self.get(db, organization_id=organization_id, id=id)

    async def remove(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        id: UUID
    ) -> Optional[ModelType]:
        """Delete a record, filtered by organization_id."""
        # Get the object before deletion
        obj = await self.get(db, organization_id=organization_id, id=id)
        if not obj:
            return None

        query = delete(self.model).where(
            and_(
                self.model.id == id,
                self.model.organization_id == organization_id
            )
        )

        await db.execute(query)
        return obj

    async def count(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        filters: Optional[Dict[str, Any]] = None
    ) -> int:
        """Count records, filtered by organization_id."""
        query = select(func.count(self.model.id)).where(self.model.organization_id == organization_id)

        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    query = query.where(getattr(self.model, field) == value)

        result = await db.execute(query)
        return result.scalar() or 0
