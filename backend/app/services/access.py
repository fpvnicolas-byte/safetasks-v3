from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.access import ProjectAssignment
from app.models.profiles import Profile
from app.schemas.access import ProjectAssignmentCreate


class ProjectAssignmentService:
    """Service for managing project assignments (freelancer scope)."""

    async def list_for_project(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        project_id: UUID
    ) -> List[ProjectAssignment]:
        query = (
            select(ProjectAssignment)
            .join(Profile, Profile.id == ProjectAssignment.user_id)
            .where(
                and_(
                    ProjectAssignment.project_id == project_id,
                    Profile.organization_id == organization_id
                )
            )
        )
        result = await db.execute(query)
        return result.scalars().all()

    async def list_for_user(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        user_id: UUID
    ) -> List[ProjectAssignment]:
        query = (
            select(ProjectAssignment)
            .join(Profile, Profile.id == ProjectAssignment.user_id)
            .where(
                and_(
                    ProjectAssignment.user_id == user_id,
                    Profile.organization_id == organization_id
                )
            )
        )
        result = await db.execute(query)
        return result.scalars().all()

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: ProjectAssignmentCreate
    ) -> ProjectAssignment:
        db_obj = ProjectAssignment(
            project_id=obj_in.project_id,
            user_id=obj_in.user_id
        )
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def remove(
        self,
        db: AsyncSession,
        *,
        assignment_id: UUID
    ) -> ProjectAssignment | None:
        query = select(ProjectAssignment).where(ProjectAssignment.id == assignment_id)
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()
        if not assignment:
            return None
        await db.delete(assignment)
        return assignment


project_assignment_service = ProjectAssignmentService()
