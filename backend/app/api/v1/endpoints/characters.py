from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_organization,
    require_owner_admin_or_producer,
    require_read_only,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
)
from app.db.session import get_db
from app.services.production import character_service
from app.schemas.production import Character, CharacterCreate, CharacterUpdate

router = APIRouter()


@router.get("/", response_model=List[Character], dependencies=[Depends(require_read_only)])
async def get_characters(
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: UUID = None,
) -> List[Character]:
    """
    Get all characters for the current user's organization.
    """
    filters = {}
    if project_id:
        await enforce_project_assignment(project_id, db, profile)
        filters["project_id"] = project_id
    elif get_effective_role(profile) == "freelancer":
        assigned_project_ids = await get_assigned_project_ids(db, profile)
        if not assigned_project_ids:
            return []
        filters["project_id"] = assigned_project_ids

    characters = await character_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return characters


@router.post(
    "/",
    response_model=Character,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_character(
    character_in: CharacterCreate,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Character:
    """
    Create a new character in the current user's organization.
    Only admins and managers can create characters.
    """
    try:
        character = await character_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=character_in
        )
        return character
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{character_id}", response_model=Character, dependencies=[Depends(require_read_only)])
async def get_character(
    character_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Character:
    """
    Get character by ID (must belong to current user's organization).
    """
    character = await character_service.get(
        db=db,
        organization_id=organization_id,
        id=character_id
    )

    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found"
        )

    await enforce_project_assignment(character.project_id, db, profile)

    return character


@router.put(
    "/{character_id}",
    response_model=Character,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_character(
    character_id: UUID,
    character_in: CharacterUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Character:
    """
    Update character (must belong to current user's organization).
    Only admins and managers can update characters.
    """
    try:
        character = await character_service.update(
            db=db,
            organization_id=organization_id,
            id=character_id,
            obj_in=character_in
        )

        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Character not found"
            )

        return character
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{character_id}",
    response_model=Character,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_character(
    character_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> Character:
    """
    Delete character (must belong to current user's organization).
    Only admins and managers can delete characters.
    """
    character = await character_service.remove(
        db=db,
        organization_id=organization_id,
        id=character_id
    )

    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Character not found"
        )

    return character
