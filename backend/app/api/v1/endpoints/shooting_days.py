from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_organization_from_profile,
    require_read_only,
    require_owner_admin_or_producer,
    get_current_profile,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
)
from app.db.session import get_db
from app.services.production import shooting_day_service, production_service
from app.schemas.production import (
    ShootingDay,
    ShootingDayCreate,
    ShootingDayUpdate,
    ShootingDayDetail,
    CrewAssignmentCreate,
    CrewAssignmentUpdate,
    CrewAssignmentOut,
    UnassignScenesRequest,
)
from app.models.scheduling import ShootingDayCrewAssignment
from app.models.profiles import Profile
from app.models.organizations import Organization
from sqlalchemy import select

router = APIRouter()


@router.get("/", response_model=List[ShootingDay], dependencies=[Depends(require_read_only)])
async def get_shooting_days(
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    project_id: UUID = None,
) -> List[ShootingDay]:
    """
    Get all shooting days for the current user's organization.
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

    shooting_days = await shooting_day_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters,
        options=[
            selectinload(shooting_day_service.model.project).selectinload(shooting_day_service.model.project.property.mapper.class_.client)
        ]
    )
    return shooting_days


@router.post(
    "/",
    response_model=ShootingDay,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_shooting_day(
    shooting_day_in: ShootingDayCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDay:
    """
    Create a new shooting day in the current user's organization.
    Only admins and managers can create shooting days.
    """
    try:
        shooting_day = await shooting_day_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=shooting_day_in
        )
        # Eagerly load the project relationship to avoid async lazy-load errors during serialization
        await db.refresh(shooting_day, attribute_names=["project"])
        if shooting_day.project:
            await db.refresh(shooting_day.project, attribute_names=["client"])
        return shooting_day
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{shooting_day_id}", response_model=ShootingDayDetail, dependencies=[Depends(require_read_only)])
async def get_shooting_day(
    shooting_day_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDayDetail:
    """
    Get shooting day by ID with scenes and crew (must belong to current user's organization).
    """
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id,
        options=[
            selectinload(shooting_day_service.model.project).selectinload(shooting_day_service.model.project.property.mapper.class_.client),
            selectinload(shooting_day_service.model.scenes),
            selectinload(shooting_day_service.model.crew_assignments).selectinload(ShootingDayCrewAssignment.profile)
        ]
    )

    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    await enforce_project_assignment(shooting_day.project_id, db, profile)

    # Manually populate crew assignment profile info for the response
    crew_assignments = []
    for assignment in shooting_day.crew_assignments:
        crew_assignments.append(CrewAssignmentOut(
            id=assignment.id,
            profile_id=assignment.profile_id,
            profile_name=assignment.profile.full_name,
            profile_email=assignment.profile.email,
            profile_phone=assignment.profile.phone,
            production_function=assignment.production_function,
            created_at=assignment.created_at
        ))

    # Create the response with enriched data
    return ShootingDayDetail(
        **shooting_day.__dict__,
        scenes=shooting_day.scenes,
        crew_assignments=crew_assignments
    )


@router.put(
    "/{shooting_day_id}",
    response_model=ShootingDay,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_shooting_day(
    shooting_day_id: UUID,
    shooting_day_in: ShootingDayUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDay:
    """
    Update shooting day (must belong to current user's organization).
    Only admins and managers can update shooting days.
    """
    try:
        shooting_day = await shooting_day_service.update(
            db=db,
            organization_id=organization_id,
            id=shooting_day_id,
            obj_in=shooting_day_in
        )

        if not shooting_day:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shooting day not found"
            )

        await db.refresh(shooting_day, attribute_names=["project"])
        if shooting_day.project:
            await db.refresh(shooting_day.project, attribute_names=["client"])
        return shooting_day
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{shooting_day_id}",
    response_model=ShootingDay,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_shooting_day(
    shooting_day_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> ShootingDay:
    """
    Delete shooting day (must belong to current user's organization).
    Only admins and managers can delete shooting days.
    """
    shooting_day = await shooting_day_service.remove(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id
    )

    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    await db.refresh(shooting_day, attribute_names=["project"])
    if shooting_day.project:
        await db.refresh(shooting_day.project, attribute_names=["client"])
    return shooting_day


@router.post(
    "/{shooting_day_id}/assign-scenes",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def assign_scenes_to_shooting_day(
    shooting_day_id: UUID,
    scene_ids: List[UUID],
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Assign multiple scenes to a shooting day.
    Only admins and managers can assign scenes.
    """
    try:
        result = await production_service.assign_scenes_to_shooting_day(
            db=db,
            organization_id=organization_id,
            shooting_day_id=shooting_day_id,
            scene_ids=scene_ids
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/{shooting_day_id}/unassign-scenes",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def unassign_scenes_from_shooting_day(
    shooting_day_id: UUID,
    request: UnassignScenesRequest,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Unassign multiple scenes from a shooting day.
    Only admins and producers can unassign scenes.
    """
    # Verify shooting day exists and belongs to org
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id
    )
    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    # Unassign each scene
    unassigned_count = 0
    for scene_id in request.scene_ids:
        scene = await production_service.scene_service.get(
            db=db,
            organization_id=organization_id,
            id=scene_id
        )
        if scene and scene.shooting_day_id == shooting_day_id:
            await production_service.scene_service.update(
                db=db,
                organization_id=organization_id,
                id=scene_id,
                obj_in={"shooting_day_id": None}
            )
            unassigned_count += 1

    return {
        "message": f"Successfully unassigned {unassigned_count} scene(s)",
        "unassigned_count": unassigned_count
    }


@router.post(
    "/{shooting_day_id}/crew",
    response_model=CrewAssignmentOut,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def add_crew_member(
    shooting_day_id: UUID,
    crew_in: CrewAssignmentCreate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> CrewAssignmentOut:
    """
    Add a crew member to a shooting day.
    Only admins and producers can manage crew.
    """
    # Verify shooting day exists and belongs to org
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id
    )
    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    # Verify profile exists and belongs to same org
    result = await db.execute(
        select(Profile).where(
            Profile.id == crew_in.profile_id,
            Profile.organization_id == organization_id
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found in this organization"
        )

    # Create crew assignment
    crew_assignment = ShootingDayCrewAssignment(
        organization_id=organization_id,
        shooting_day_id=shooting_day_id,
        profile_id=crew_in.profile_id,
        production_function=crew_in.production_function
    )
    db.add(crew_assignment)

    try:
        await db.commit()
        await db.refresh(crew_assignment)
    except Exception as e:
        await db.rollback()
        if "uq_shooting_day_profile" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This crew member is already assigned to this shooting day"
            )
        raise

    # Return with profile info
    return CrewAssignmentOut(
        id=crew_assignment.id,
        profile_id=crew_assignment.profile_id,
        profile_name=profile.full_name,
        profile_email=profile.email,
        profile_phone=profile.phone,
        production_function=crew_assignment.production_function,
        created_at=crew_assignment.created_at
    )


@router.get(
    "/{shooting_day_id}/crew",
    response_model=List[CrewAssignmentOut],
    dependencies=[Depends(require_read_only)]
)
async def get_crew_members(
    shooting_day_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> List[CrewAssignmentOut]:
    """
    Get all crew members assigned to a shooting day.
    """
    # Verify shooting day exists and belongs to org
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id
    )
    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    # Get crew assignments with profile info
    result = await db.execute(
        select(ShootingDayCrewAssignment, Profile)
        .join(Profile, ShootingDayCrewAssignment.profile_id == Profile.id)
        .where(
            ShootingDayCrewAssignment.shooting_day_id == shooting_day_id,
            ShootingDayCrewAssignment.organization_id == organization_id
        )
        .order_by(ShootingDayCrewAssignment.created_at)
    )
    crew_data = result.all()

    return [
        CrewAssignmentOut(
            id=assignment.id,
            profile_id=assignment.profile_id,
            profile_name=profile.full_name,
            profile_email=profile.email,
            profile_phone=profile.phone,
            production_function=assignment.production_function,
            created_at=assignment.created_at
        )
        for assignment, profile in crew_data
    ]


@router.put(
    "/{shooting_day_id}/crew/{crew_assignment_id}",
    response_model=CrewAssignmentOut,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_crew_member(
    shooting_day_id: UUID,
    crew_assignment_id: UUID,
    crew_in: CrewAssignmentUpdate,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> CrewAssignmentOut:
    """
    Update a crew member's production function.
    Only admins and producers can manage crew.
    """
    # Get crew assignment with profile
    result = await db.execute(
        select(ShootingDayCrewAssignment, Profile)
        .join(Profile, ShootingDayCrewAssignment.profile_id == Profile.id)
        .where(
            ShootingDayCrewAssignment.id == crew_assignment_id,
            ShootingDayCrewAssignment.shooting_day_id == shooting_day_id,
            ShootingDayCrewAssignment.organization_id == organization_id
        )
    )
    crew_data = result.one_or_none()
    if not crew_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Crew assignment not found"
        )

    assignment, profile = crew_data
    assignment.production_function = crew_in.production_function

    await db.commit()
    await db.refresh(assignment)

    return CrewAssignmentOut(
        id=assignment.id,
        profile_id=assignment.profile_id,
        profile_name=profile.full_name,
        profile_email=profile.email,
        profile_phone=profile.phone,
        production_function=assignment.production_function,
        created_at=assignment.created_at
    )


@router.delete(
    "/{shooting_day_id}/crew/{crew_assignment_id}",
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def remove_crew_member(
    shooting_day_id: UUID,
    crew_assignment_id: UUID,
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Remove a crew member from a shooting day.
    Only admins and producers can manage crew.
    """
    # Get crew assignment
    result = await db.execute(
        select(ShootingDayCrewAssignment)
        .where(
            ShootingDayCrewAssignment.id == crew_assignment_id,
            ShootingDayCrewAssignment.shooting_day_id == shooting_day_id,
            ShootingDayCrewAssignment.organization_id == organization_id
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Crew assignment not found"
        )

    await db.delete(assignment)
    await db.commit()

    return {"message": "Crew member removed successfully"}


# =============================================================================
# Shooting Day PDF Generation Endpoints
# =============================================================================

@router.post(
    "/{shooting_day_id}/pdf",
    response_model=dict,
    dependencies=[Depends(require_owner_admin_or_producer)]
)
async def generate_shooting_day_pdf(
    shooting_day_id: UUID,
    regenerate: bool = Query(False, description="Force regeneration even if PDF exists"),
    locale: str = Query("pt-BR", description="Locale for PDF rendering (pt-BR or en)"),
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate PDF for shooting day and store in storage.
    Returns PDF metadata including signed URL for download.
    """
    from app.services.shooting_day_pdf import shooting_day_pdf_service
    from app.models.organizations import Organization
    from app.models.projects import Project

    # Get shooting day with all related data
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id,
        options=[
            selectinload(shooting_day_service.model.project),
            selectinload(shooting_day_service.model.scenes),
            selectinload(shooting_day_service.model.crew_assignments).selectinload(ShootingDayCrewAssignment.profile)
        ]
    )

    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    # Check if PDF already exists and regenerate is not requested
    if not regenerate:
        existing = await shooting_day_pdf_service.get_existing_pdf_url(
            organization_id=str(organization_id),
            shooting_day_id=str(shooting_day_id)
        )
        if existing:
            return {
                "status": "exists",
                "signed_url": existing["signed_url"],
                "pdf_path": existing["file_path"],
            }

    # Get organization for header/logo
    org_result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = org_result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Get project
    project = shooting_day.project

    # Prepare crew assignments with profile info
    crew_assignments = []
    for assignment in shooting_day.crew_assignments:
        crew_assignments.append(CrewAssignmentOut(
            id=assignment.id,
            profile_id=assignment.profile_id,
            profile_name=assignment.profile.full_name,
            profile_email=assignment.profile.email,
            profile_phone=assignment.profile.phone,
            production_function=assignment.production_function,
            created_at=assignment.created_at
        ))

    try:
        # Generate and store PDF
        pdf_result = await shooting_day_pdf_service.generate_and_store(
            db=db,
            shooting_day=shooting_day,
            organization=organization,
            project=project,
            scenes=list(shooting_day.scenes) if shooting_day.scenes else [],
            crew_assignments=crew_assignments,
            locale=locale
        )

        return {
            "status": "generated",
            "signed_url": pdf_result["signed_url"],
            "pdf_path": pdf_result["pdf_path"],
            "size_bytes": pdf_result["size_bytes"],
            "filename": pdf_result["filename"],
        }
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {str(e)}"
        )


@router.get(
    "/{shooting_day_id}/pdf",
    dependencies=[Depends(require_read_only)]
)
async def get_shooting_day_pdf(
    shooting_day_id: UUID,
    download: bool = Query(False, description="Return download URL for direct download"),
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Get PDF access for shooting day.
    If download=true, returns a short-lived signed URL for direct download.
    Otherwise returns signed URL for viewing the PDF.
    """
    from app.services.shooting_day_pdf import shooting_day_pdf_service

    # Check shooting day exists
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id
    )

    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    # Check if PDF exists
    existing = await shooting_day_pdf_service.get_existing_pdf_url(
        organization_id=str(organization_id),
        shooting_day_id=str(shooting_day_id),
        expires_in=60 if download else 3600
    )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not generated yet. Use POST to generate."
        )

    if download:
        date_str = shooting_day.date.strftime("%Y-%m-%d") if shooting_day.date else "unknown"
        return {
            "status": "redirect",
            "download_url": existing["signed_url"],
            "filename": f"shooting_day_{date_str}.pdf"
        }
    else:
        return {
            "status": "ok",
            "signed_url": existing["signed_url"],
            "pdf_path": existing["file_path"],
        }


@router.get(
    "/{shooting_day_id}/pdf/preview",
    dependencies=[Depends(require_read_only)]
)
async def preview_shooting_day_pdf(
    shooting_day_id: UUID,
    locale: str = Query("pt-BR", description="Locale for PDF rendering (pt-BR or en)"),
    organization_id: UUID = Depends(get_organization_from_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Render shooting day as HTML for preview.
    Useful for template development and quick preview without generating PDF.
    """
    from fastapi.responses import HTMLResponse
    from app.services.shooting_day_pdf import shooting_day_pdf_service
    from app.models.organizations import Organization

    # Get shooting day with all related data
    shooting_day = await shooting_day_service.get(
        db=db,
        organization_id=organization_id,
        id=shooting_day_id,
        options=[
            selectinload(shooting_day_service.model.project),
            selectinload(shooting_day_service.model.scenes),
            selectinload(shooting_day_service.model.crew_assignments).selectinload(ShootingDayCrewAssignment.profile)
        ]
    )

    if not shooting_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shooting day not found"
        )

    # Get organization
    org_result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = org_result.scalar_one_or_none()

    # Get project
    project = shooting_day.project

    # Prepare crew assignments with profile info
    crew_assignments = []
    for assignment in shooting_day.crew_assignments:
        crew_assignments.append(CrewAssignmentOut(
            id=assignment.id,
            profile_id=assignment.profile_id,
            profile_name=assignment.profile.full_name,
            profile_email=assignment.profile.email,
            profile_phone=assignment.profile.phone,
            production_function=assignment.production_function,
            created_at=assignment.created_at
        ))

    try:
        html_content = await shooting_day_pdf_service.render_html(
            shooting_day=shooting_day,
            organization=organization,
            project=project,
            scenes=list(shooting_day.scenes) if shooting_day.scenes else [],
            crew_assignments=crew_assignments,
            locale=locale
        )

        return HTMLResponse(content=html_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HTML rendering failed: {str(e)}"
        )
