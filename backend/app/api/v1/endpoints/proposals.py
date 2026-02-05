from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_profile,
    require_owner_admin_or_producer,
    require_admin_producer_or_finance,
    require_read_only,
    get_effective_role,
    get_assigned_project_ids,
    enforce_project_assignment,
    require_billing_active,
    get_organization_record,
)
from app.db.session import get_db
from app.modules.commercial.service import proposal_service
from app.schemas.proposals import (
    Proposal, ProposalCreate, ProposalUpdate,
    ProposalWithClient, ProposalApproval
)
from app.services.entitlements import ensure_resource_limit, increment_usage_count

router = APIRouter()


@router.get("/", response_model=List[Proposal], dependencies=[Depends(require_read_only)])
async def get_proposals(
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    client_id: UUID = None,
    status: str = Query(None, regex="^(draft|sent|approved|rejected|expired)$"),
) -> List[Proposal]:
    """
    Get all proposals for the current user's organization.
    """
    organization_id = profile.organization_id
    filters = {}
    if client_id:
        filters["client_id"] = client_id
    if status:
        filters["status"] = status

    if get_effective_role(profile) == "freelancer":
        assigned_project_ids = await get_assigned_project_ids(db, profile)
        if not assigned_project_ids:
            return []
        filters["project_id"] = assigned_project_ids

    proposals = await proposal_service.get_multi(
        db=db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
        filters=filters
    )
    return proposals


@router.post(
    "/",
    response_model=Proposal,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def create_proposal(
    proposal_in: ProposalCreate,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Create a new proposal in the current user's organization.
    Validates client ownership.
    """
    organization_id = profile.organization_id
    try:
        organization = await get_organization_record(profile, db)
        proposal_count = await proposal_service.count(db=db, organization_id=organization_id)
        await ensure_resource_limit(db, organization, resource="proposals", current_count=proposal_count)

        proposal = await proposal_service.create(
            db=db,
            organization_id=organization_id,
            obj_in=proposal_in
        )
        await increment_usage_count(db, organization_id, resource="proposals", delta=1)
        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{proposal_id}", response_model=Proposal, dependencies=[Depends(require_read_only)])
async def get_proposal(
    proposal_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Get proposal by ID (must belong to current user's organization).
    """
    organization_id = profile.organization_id
    proposal = await proposal_service.get(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )

    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )

    if proposal.project_id:
        await enforce_project_assignment(proposal.project_id, db, profile)
    else:
        if get_effective_role(profile) == "freelancer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: proposal not assigned to a project"
            )

    return proposal


@router.put(
    "/{proposal_id}",
    response_model=Proposal,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def update_proposal(
    proposal_id: UUID,
    proposal_in: ProposalUpdate,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Update proposal (must belong to current user's organization).
    Validates client ownership if client_id is being changed.
    """
    organization_id = profile.organization_id
    try:
        proposal = await proposal_service.update(
            db=db,
            organization_id=organization_id,
            id=proposal_id,
            obj_in=proposal_in
        )

        if not proposal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proposal not found"
            )

        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete(
    "/{proposal_id}",
    response_model=Proposal,
    dependencies=[Depends(require_owner_admin_or_producer), Depends(require_billing_active)]
)
async def delete_proposal(
    proposal_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Delete proposal (must belong to current user's organization).
    """
    organization_id = profile.organization_id
    proposal = await proposal_service.remove(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )

    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )

    await increment_usage_count(db, organization_id, resource="proposals", delta=-1)
    return proposal


@router.post(
    "/{proposal_id}/approve",
    response_model=Proposal,
    dependencies=[Depends(require_admin_producer_or_finance), Depends(require_billing_active)]
)
async def approve_proposal(
    proposal_id: UUID,
    approval_data: ProposalApproval,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
) -> Proposal:
    """
    Approve proposal and automatically convert to project.
    Only proposals with 'sent' status can be approved.
    This creates a new project and links it to the proposal.
    """
    organization_id = profile.organization_id
    try:
        proposal = await proposal_service.approve_proposal(
            db=db,
            organization_id=organization_id,
            proposal_id=proposal_id,
            approval_data=approval_data
        )
        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# =============================================================================
# PDF Generation Endpoints
# =============================================================================

@router.post(
    "/{proposal_id}/pdf",
    response_model=dict,
    dependencies=[Depends(require_owner_admin_or_producer)]
)
async def generate_proposal_pdf(
    proposal_id: UUID,
    regenerate: bool = Query(False, description="Force regeneration even if PDF exists"),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate PDF for proposal and store in storage.
    Returns PDF metadata including signed URL for download.
    """
    from app.services.proposal_pdf import proposal_pdf_service
    from app.modules.commercial.service import organization_service
    
    organization_id = profile.organization_id
    
    # Get proposal with client and services
    proposal = await proposal_service.get(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )
    
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )
    
    # Check if PDF already exists and regenerate is not requested
    if not regenerate:
        existing_url = await proposal_pdf_service.get_existing_pdf_url(proposal)
        if existing_url:
            pdf_info = (proposal.proposal_metadata or {}).get("pdf", {})
            return {
                "status": "exists",
                "signed_url": existing_url,
                "pdf_path": pdf_info.get("path"),
                "version": pdf_info.get("version"),
                "generated_at": pdf_info.get("generated_at")
            }
    
    # Get organization for header/logo
    organization = await organization_service.get(
        db=db,
        organization_id=organization_id,
        id=organization_id
    )
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    try:
        # Generate and store PDF
        result = await proposal_pdf_service.generate_and_store(
            db=db,
            proposal=proposal,
            organization=organization,
            client=proposal.client,
            services=list(proposal.services) if proposal.services else []
        )
        
        await db.commit()
        
        return {
            "status": "generated",
            "signed_url": result["signed_url"],
            "pdf_path": result["pdf_path"],
            "version": result["version"],
            "size_bytes": result["size_bytes"]
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
    "/{proposal_id}/pdf",
    dependencies=[Depends(require_read_only)]
)
async def get_proposal_pdf(
    proposal_id: UUID,
    download: bool = Query(False, description="Return PDF bytes directly for download"),
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Get PDF access for proposal.
    If download=true, returns PDF bytes with Content-Disposition for direct download.
    Otherwise returns signed URL for accessing the PDF.
    """
    from fastapi.responses import Response
    from app.services.proposal_pdf import proposal_pdf_service
    from app.services.storage import storage_service
    
    organization_id = profile.organization_id
    
    # Get proposal
    proposal = await proposal_service.get(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )
    
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )
    
    # Check if PDF exists
    metadata = proposal.proposal_metadata or {}
    pdf_info = metadata.get("pdf")
    
    if not pdf_info or not pdf_info.get("path"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF not generated yet. Use POST to generate."
        )
    
    if download:
        # For direct download, we need to fetch the PDF bytes
        # This is useful for mobile apps or direct save
        try:
            signed_url = await storage_service.generate_signed_url(
                bucket=pdf_info["bucket"],
                file_path=pdf_info["path"],
                expires_in=60  # Short expiry for redirect
            )
            # Return redirect or signed URL
            return {
                "status": "redirect",
                "download_url": signed_url,
                "filename": f"proposal_{proposal_id}.pdf"
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get download URL: {str(e)}"
            )
    else:
        # Return signed URL for viewing
        signed_url = await proposal_pdf_service.get_existing_pdf_url(proposal)
        if not signed_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate signed URL"
            )
        
        return {
            "status": "ok",
            "signed_url": signed_url,
            "pdf_path": pdf_info["path"],
            "version": pdf_info.get("version"),
            "generated_at": pdf_info.get("generated_at")
        }


@router.get(
    "/{proposal_id}/pdf/preview",
    dependencies=[Depends(require_read_only)]
)
async def preview_proposal_pdf(
    proposal_id: UUID,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Render proposal as HTML for preview.
    Useful for template development and quick preview without generating PDF.
    """
    from fastapi.responses import HTMLResponse
    from app.services.proposal_pdf import proposal_pdf_service
    from app.modules.commercial.service import organization_service
    
    organization_id = profile.organization_id
    
    # Get proposal with client and services
    proposal = await proposal_service.get(
        db=db,
        organization_id=organization_id,
        id=proposal_id
    )
    
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proposal not found"
        )
    
    # Get organization
    organization = await organization_service.get(
        db=db,
        organization_id=organization_id,
        id=organization_id
    )
    
    try:
        html_content = await proposal_pdf_service.render_html(
            proposal=proposal,
            organization=organization,
            client=proposal.client,
            services=list(proposal.services) if proposal.services else []
        )
        
        return HTMLResponse(content=html_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"HTML rendering failed: {str(e)}"
        )
