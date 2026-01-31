from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import (
    get_current_profile,
    get_current_organization,
    require_owner_admin_or_producer,
    get_effective_role,
    require_billing_active,
)
from app.db.session import get_db
from app.models.profiles import Profile
from app.modules.commercial.service import project_service
from app.schemas.access import ProjectAssignment, ProjectAssignmentCreate
from app.models.access import ProjectAssignment as ProjectAssignmentModel
from app.services.access import project_assignment_service

router = APIRouter()


@router.get("/my", response_model=List[ProjectAssignment])
async def get_my_assignments(
    profile: Profile = Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectAssignment]:
    """
    List project assignments for the current user.
    """
    return await project_assignment_service.list_for_user(
        db=db,
        organization_id=profile.organization_id,
        user_id=profile.id
    )


@router.get("/", response_model=List[ProjectAssignment], dependencies=[Depends(require_owner_admin_or_producer)])
async def list_assignments(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> List[ProjectAssignment]:
    """
    List assignments for a project (admin/producer only).
    """
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id is required"
        )

    project = await project_service.get(db=db, organization_id=organization_id, id=project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    return await project_assignment_service.list_for_project(
        db=db,
        organization_id=organization_id,
        project_id=project_id
    )


@router.post(
    "/",
    response_model=ProjectAssignment,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def assign_user_to_project(
    assignment_in: ProjectAssignmentCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectAssignment:
    """
    Assign a freelancer to a project (admin/producer only).
    """
    # Validate project belongs to org
    project = await project_service.get(db=db, organization_id=organization_id, id=assignment_in.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Validate user belongs to org
    profile_query = select(Profile).where(
        Profile.id == assignment_in.user_id,
        Profile.organization_id == organization_id
    )
    result = await db.execute(profile_query)
    user_profile = result.scalar_one_or_none()
    if not user_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this organization"
        )

    # Only allow freelancer assignment
    if get_effective_role(user_profile) != "freelancer":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only freelancers can be assigned to projects"
        )

    # Check existing assignment
    existing_query = select(ProjectAssignment).where(
        ProjectAssignment.project_id == assignment_in.project_id,
        ProjectAssignment.user_id == assignment_in.user_id
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already assigned to this project"
        )

    return await project_assignment_service.create(db=db, obj_in=assignment_in)


@router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def remove_assignment(
    assignment_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Remove a project assignment (admin/producer only).
    """
    assignment_query = select(ProjectAssignmentModel).where(ProjectAssignmentModel.id == assignment_id)
    assignment_result = await db.execute(assignment_query)
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    project = await project_service.get(db=db, organization_id=organization_id, id=assignment.project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    await project_assignment_service.remove(db=db, assignment_id=assignment_id)
