"""
WhatsApp Integration Endpoints

Stub implementation for WhatsApp proposal sending via Evolution API.
This is a placeholder that will be fully implemented when WhatsApp
credentials are configured.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import (
    get_current_profile,
    require_owner_admin_or_producer,
)
from app.db.session import get_db
from app.core.config import settings
from app.modules.commercial.service import proposal_service

router = APIRouter()


class WhatsAppSendRequest(BaseModel):
    """Request body for sending proposal via WhatsApp."""
    phone_number: str
    message: str = None  # Optional custom message


class WhatsAppSendResponse(BaseModel):
    """Response for WhatsApp send operation."""
    status: str
    message: str
    proposal_id: str = None
    phone_number: str = None


@router.post(
    "/proposals/{proposal_id}/send",
    response_model=WhatsAppSendResponse,
    dependencies=[Depends(require_owner_admin_or_producer)]
)
async def send_proposal_whatsapp(
    proposal_id: UUID,
    request: WhatsAppSendRequest,
    profile=Depends(get_current_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Send proposal PDF via WhatsApp (stub implementation).
    
    This endpoint prepares the proposal for WhatsApp sending.
    Currently returns configuration status as WhatsApp integration
    is not yet fully implemented.
    
    When fully implemented, this will:
    1. Check if proposal has a generated PDF
    2. Send the PDF via WhatsApp using Evolution API
    3. Record the send event in proposal metadata
    """
    organization_id = profile.organization_id
    
    # Verify proposal exists
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal PDF not generated. Generate PDF first before sending."
        )
    
    # Check if WhatsApp is configured
    if not settings.WHATSAPP_API_KEY or not settings.WHATSAPP_API_URL:
        return WhatsAppSendResponse(
            status="not_configured",
            message="WhatsApp integration is not configured. Please set WHATSAPP_API_KEY and WHATSAPP_API_URL in environment variables.",
            proposal_id=str(proposal_id),
            phone_number=request.phone_number
        )
    
    # TODO: Implement actual WhatsApp sending with Evolution API
    # For now, return a stub response indicating the feature is ready
    # but not yet implemented
    
    return WhatsAppSendResponse(
        status="pending",
        message="WhatsApp sending is configured but not yet implemented. This is a stub response.",
        proposal_id=str(proposal_id),
        phone_number=request.phone_number
    )


@router.get("/status")
async def get_whatsapp_status():
    """
    Check if WhatsApp integration is configured.
    Returns the current configuration status without exposing credentials.
    """
    is_configured = bool(
        settings.WHATSAPP_API_KEY and 
        settings.WHATSAPP_API_URL
    )
    
    return {
        "configured": is_configured,
        "instance_name": settings.WHATSAPP_INSTANCE_NAME if is_configured else None,
        "message": "WhatsApp is configured and ready" if is_configured else "WhatsApp is not configured"
    }
