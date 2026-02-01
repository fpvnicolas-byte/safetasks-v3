from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
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
from app.models.access import ProjectAssignment as ProjectAssignmentModel
from app.models.ai import AiRecommendation, AiSuggestion, AiUsageLog, ScriptAnalysis
from app.models.call_sheets import CallSheet as CallSheetModel
from app.models.clients import Client as ClientModel
from app.models.cloud import CloudSyncStatus as CloudSyncStatusModel, ProjectDriveFolder as ProjectDriveFolderModel
from app.models.commercial import Stakeholder as StakeholderModel
from app.models.financial import Invoice as InvoiceModel, InvoiceItem as InvoiceItemModel
from app.models.production import Character as CharacterModel, Scene as SceneModel, SceneCharacter as SceneCharacterModel
from app.models.proposals import Proposal as ProposalModel
from app.models.projects import Project as ProjectModel
from app.models.projects import project_services
from app.models.scheduling import ShootingDay as ShootingDayModel
from app.models.transactions import Transaction as TransactionModel
from app.modules.commercial.service import project_service, client_service
from app.services.entitlements import ensure_resource_limit, increment_usage_count
from app.schemas.projects import Project, ProjectCreate, ProjectUpdate, ProjectWithClient, ProjectStats

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

    try:
        # Detach financial and optional references (keep records for audit trails)
        await db.execute(
            update(TransactionModel)
            .where(TransactionModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(InvoiceModel)
            .where(InvoiceModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(InvoiceItemModel)
            .where(InvoiceItemModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(ProposalModel)
            .where(ProposalModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(CloudSyncStatusModel)
            .where(CloudSyncStatusModel.project_id == project_id)
            .values(project_id=None)
        )
        await db.execute(
            update(AiUsageLog)
            .where(AiUsageLog.project_id == project_id)
            .values(project_id=None)
        )

        # Remove assignment + association rows
        await db.execute(
            delete(ProjectAssignmentModel).where(ProjectAssignmentModel.project_id == project_id)
        )
        await db.execute(
            delete(project_services).where(project_services.c.project_id == project_id)
        )

        # Remove scene-character links before deleting scenes/characters
        scene_ids_subq = select(SceneModel.id).where(SceneModel.project_id == project_id)
        character_ids_subq = select(CharacterModel.id).where(CharacterModel.project_id == project_id)
        await db.execute(
            delete(SceneCharacterModel).where(SceneCharacterModel.scene_id.in_(scene_ids_subq))
        )
        await db.execute(
            delete(SceneCharacterModel).where(SceneCharacterModel.character_id.in_(character_ids_subq))
        )

        # Detach stakeholder-linked transactions before removing stakeholders
        stakeholder_ids_subq = select(StakeholderModel.id).where(StakeholderModel.project_id == project_id)
        await db.execute(
            update(TransactionModel)
            .where(TransactionModel.stakeholder_id.in_(stakeholder_ids_subq))
            .values(stakeholder_id=None)
        )

        # Delete production records tied to the project
        await db.execute(delete(SceneModel).where(SceneModel.project_id == project_id))
        await db.execute(delete(CharacterModel).where(CharacterModel.project_id == project_id))
        await db.execute(delete(ShootingDayModel).where(ShootingDayModel.project_id == project_id))
        await db.execute(delete(CallSheetModel).where(CallSheetModel.project_id == project_id))
        await db.execute(delete(StakeholderModel).where(StakeholderModel.project_id == project_id))
        await db.execute(delete(ProjectDriveFolderModel).where(ProjectDriveFolderModel.project_id == project_id))

        # Delete AI artifacts for the project
        await db.execute(delete(ScriptAnalysis).where(ScriptAnalysis.project_id == project_id))
        await db.execute(delete(AiSuggestion).where(AiSuggestion.project_id == project_id))
        await db.execute(delete(AiRecommendation).where(AiRecommendation.project_id == project_id))

        # Delete the project itself
        await project_service.remove(
            db=db,
            organization_id=organization_id,
            id=project_id
        )
        await db.flush()
        await increment_usage_count(db, organization_id, resource="projects", delta=-1)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Project has related records that must be removed before deletion. "
                "Delete linked items (e.g., call sheets, stakeholders, AI artifacts), "
                "or archive the project instead."
            ),
        ) from exc

    return project


@router.get(
    "/{project_id}/stats",
    response_model=ProjectStats,
    dependencies=[Depends(require_read_only)]
)
async def get_project_stats(
    project_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> ProjectStats:
    """
    Get statistics for a project (scenes, characters, shooting days, etc.).
    """
    from sqlalchemy import func
    from app.schemas.projects import ProjectStats
    
    # Check if project exists and belongs to organization
    validation = await db.execute(
        select(ProjectModel.id)
        .where(ProjectModel.id == project_id)
        .where(ProjectModel.organization_id == organization_id)
    )
    if not validation.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # 1. Scenes Count
    scenes_result = await db.execute(
        select(func.count(SceneModel.id))
        .where(SceneModel.project_id == project_id)
    )
    scenes_count = scenes_result.scalar() or 0

    # 2. Characters Count
    chars_result = await db.execute(
        select(func.count(CharacterModel.id))
        .where(CharacterModel.project_id == project_id)
    )
    chars_count = chars_result.scalar() or 0

    # 3. Shooting Days (Total)
    days_result = await db.execute(
        select(func.count(ShootingDayModel.id))
        .where(ShootingDayModel.project_id == project_id)
    )
    days_count = days_result.scalar() or 0

    # 4. Confirmed Shooting Days
    confirmed_days_result = await db.execute(
        select(func.count(ShootingDayModel.id))
        .where(ShootingDayModel.project_id == project_id)
        .where(ShootingDayModel.status == 'confirmed')
    )
    confirmed_days_count = confirmed_days_result.scalar() or 0

    # 5. Team Count (Stakeholders)
    team_result = await db.execute(
        select(func.count(StakeholderModel.id))
        .where(StakeholderModel.project_id == project_id)
    )
    team_count = team_result.scalar() or 0

    return ProjectStats(
        scenes_count=scenes_count,
        characters_count=chars_count,
        shooting_days_count=days_count,
        confirmed_shooting_days_count=confirmed_days_count,
        team_count=team_count
    )
