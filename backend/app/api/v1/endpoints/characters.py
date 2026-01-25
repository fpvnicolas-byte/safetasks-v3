from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_organization, require_admin_manager_or_crew
from app.db.session import get_db
from app.services.production import character_service
from app.schemas.production import Character, CharacterCreate, CharacterUpdate

router = APIRouter()


@router.get("/", response_model=List[Character])
async def get_characters(
    organization_id: UUID = Depends(get_current_organization),
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
        filters["project_id"] = project_id

    characters = await character_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return characters


@router.post("/", response_model=Character, dependencies=[Depends(require_admin_manager_or_crew)])
async def create_character(
    character_in: CharacterCreate,
    organization_id: UUID = Depends(get_current_organization),
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


@router.get("/{character_id}", response_model=Character)
async def get_character(
    character_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
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

    return character


@router.put("/{character_id}", response_model=Character, dependencies=[Depends(require_admin_manager_or_crew)])
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


@router.delete("/{character_id}", response_model=Character, dependencies=[Depends(require_admin_manager_or_crew)])
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
