from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from sqlalchemy import select, update, delete, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .base import Base
from .schemas import PaginationParams, FilterParams

# Type variables for generic CRUD operations
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base class for CRUD operations on SQLAlchemy models.
    Provides generic create, read, update, delete operations.
    """

    def __init__(self, model: Type[ModelType]):
        """
        Initialize CRUD operations for a specific model.

        Args:
            model: The SQLAlchemy model class
        """
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        """
        Get a single record by ID.

        Args:
            db: Database session
            id: Primary key value

        Returns:
            Model instance or None if not found
        """
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalars().first()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[FilterParams] = None,
        order_by: Optional[str] = None,
        order_desc: bool = False
    ) -> List[ModelType]:
        """
        Get multiple records with optional filtering and pagination.

        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            filters: Optional filter parameters
            order_by: Field to order by
            order_desc: Whether to order descending

        Returns:
            List of model instances
        """
        query = select(self.model)

        # Apply filters
        if filters:
            conditions = []
            if hasattr(filters, 'search') and filters.search:
                # Basic search implementation - can be extended per model
                search_conditions = []
                for column in self.model.__table__.columns:
                    if column.type.python_type == str:
                        search_conditions.append(column.ilike(f"%{filters.search}%"))
                if search_conditions:
                    conditions.append(or_(*search_conditions))

            if hasattr(filters, 'is_active') and filters.is_active is not None:
                if hasattr(self.model, 'is_active'):
                    conditions.append(self.model.is_active == filters.is_active)

            if conditions:
                query = query.where(and_(*conditions))

        # Apply ordering
        if order_by and hasattr(self.model, order_by):
            column = getattr(self.model, order_by)
            if order_desc:
                query = query.order_by(column.desc())
            else:
                query = query.order_by(column)

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    async def get_count(
        self,
        db: AsyncSession,
        filters: Optional[FilterParams] = None
    ) -> int:
        """
        Get total count of records matching filters.

        Args:
            db: Database session
            filters: Optional filter parameters

        Returns:
            Total count of matching records
        """
        query = select(func.count()).select_from(self.model)

        if filters:
            conditions = []
            if hasattr(filters, 'search') and filters.search:
                search_conditions = []
                for column in self.model.__table__.columns:
                    if column.type.python_type == str:
                        search_conditions.append(column.ilike(f"%{filters.search}%"))
                if search_conditions:
                    conditions.append(or_(*search_conditions))

            if hasattr(filters, 'is_active') and filters.is_active is not None:
                if hasattr(self.model, 'is_active'):
                    conditions.append(self.model.is_active == filters.is_active)

            if conditions:
                query = query.where(and_(*conditions))

        result = await db.execute(query)
        return result.scalar()

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: CreateSchemaType
    ) -> ModelType:
        """
        Create a new record.

        Args:
            db: Database session
            obj_in: Input data for creation

        Returns:
            Created model instance
        """
        obj_in_data = obj_in.model_dump() if hasattr(obj_in, 'model_dump') else obj_in
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """
        Update an existing record.

        Args:
            db: Database session
            db_obj: Existing database object
            obj_in: Update data

        Returns:
            Updated model instance
        """
        obj_data = obj_in.model_dump(exclude_unset=True) if hasattr(obj_in, 'model_dump') else obj_in
        update_data = {k: v for k, v in obj_data.items() if v is not None}

        await db.execute(
            update(self.model)
            .where(self.model.id == db_obj.id)
            .values(**update_data)
        )
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, *, id: Any) -> ModelType:
        """
        Remove a record by ID.

        Args:
            db: Database session
            id: Primary key value

        Returns:
            Removed model instance
        """
        result = await db.execute(select(self.model).where(self.model.id == id))
        obj = result.scalars().first()

        await db.execute(delete(self.model).where(self.model.id == id))
        await db.commit()

        return obj

    async def exists(self, db: AsyncSession, id: Any) -> bool:
        """
        Check if a record exists by ID.

        Args:
            db: Database session
            id: Primary key value

        Returns:
            True if record exists, False otherwise
        """
        result = await db.execute(
            select(func.count()).select_from(self.model).where(self.model.id == id)
        )
        return result.scalar() > 0