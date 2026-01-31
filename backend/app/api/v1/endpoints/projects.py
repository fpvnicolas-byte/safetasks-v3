from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_organization,
    require_read_only,
    require_owner_admin_or_producer,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
    get_organization_record,
)
from app.db.session import get_db
from app.models.clients import Client as ClientModel
from app.models.projects import Project as ProjectModel
from app.modules.commercial.service import project_service, client_service
from app.services.entitlements import ensure_resource_limit, increment_usage_count
from app.schemas.projects import Project, ProjectCreate, ProjectUpdate, ProjectWithClient

router = APIRouter()


@router.get("/", response_model=List[ProjectWithClient], dependencies=[Depends(require_read_only)])
async def get_projects(
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> List[ProjectWithClient]:
    """
    Get all projects for the current user's organization with client data.
    """
    if get_effective_role(profile) == "freelancer":
        assigned_project_ids = await get_assigned_project_ids(db, profile)
        if not assigned_project_ids:
            return []
        projects = await project_service.get_multi(
            db=db,
            organization_id=organization_id,
            skip=skip,
            limit=limit,
            options=[selectinload(ProjectModel.client)],
            filters={"id": assigned_project_ids}
        )
    else:
        projects = await project_service.get_multi(
            db=db,
            organization_id=organization_id,
            skip=skip,
            limit=limit,
            options=[selectinload(ProjectModel.client)]
        )
    return projects


@router.post(
    "/",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_project(
    project_in: ProjectCreate,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Create a new project in the current user's organization.
    Validates that the client belongs to the same organization.
    """
    organization = await get_organization_record(profile, db)
    project_count = await project_service.count(db=db, organization_id=organization_id)
    await ensure_resource_limit(db, organization, resource="projects", current_count=project_count)

    # Validate that the client belongs to the same organization
    client = await client_service.get(
        db=db,
        organization_id=organization_id,
        id=project_in.client_id
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client not found or does not belong to your organization"
        )

    project = await project_service.create(
        db=db,
        organization_id=organization_id,
        obj_in=project_in
    )
    await increment_usage_count(db, organization_id, resource="projects", delta=1)

    # Load client relationship for response
    return await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project.id,
        options=[selectinload(ProjectModel.client)]
    )


@router.get("/{project_id}", response_model=ProjectWithClient, dependencies=[Depends(require_read_only)])
async def get_project(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Get project by ID with client data (must belong to current user's organization).
    """
    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    await enforce_project_assignment(project_id, db, profile)

    return project


@router.put(
    "/{project_id}",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_project(
    project_id: UUID,
    project_in: ProjectUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Update project (must belong to current user's organization).
    Validates client belongs to same organization if client_id is being updated.
    """
    # If client_id is being updated, validate it belongs to the same organization
    if project_in.client_id is not None:
        client = await client_service.get(
            db=db,
            organization_id=organization_id,
            id=project_in.client_id
        )

        if not client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client not found or does not belong to your organization"
            )

    project = await project_service.update(
        db=db,
        organization_id=organization_id,
        id=project_id,
        obj_in=project_in
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Load client relationship for response
    return await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project.id,
        options=[selectinload(ProjectModel.client)]
    )


@router.delete(
    "/{project_id}",
    response_model=ProjectWithClient,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_project(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectWithClient:
    """
    Delete project (must belong to current user's organization).
    """
    # Get project with client data before deletion
    project = await project_service.get(
        db=db,
        organization_id=organization_id,
        id=project_id,
        options=[selectinload(ProjectModel.client)]
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Delete the project
    await project_service.remove(
        db=db,
        organization_id=organization_id,
        id=project_id
    )
    await increment_usage_count(db, organization_id, resource="projects", delta=-1)

    return project
