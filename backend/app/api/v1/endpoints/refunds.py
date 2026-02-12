from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.api import deps
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.refunds import RefundRequest, BillingPurchase
from app.schemas.refunds import RefundRequestCreate, RefundRequestResponse, RefundDetailResponse
from app.services.manual_refunds import manual_refund_service
from app.services.refunds import refund_eligibility_service

router = APIRouter()

@router.post("/request", response_model=RefundRequestResponse)
async def request_refund(
    *,
    db: AsyncSession = Depends(get_db),
    params: RefundRequestCreate,
    current_user: Profile = Depends(deps.get_current_profile),
) -> Any:
    """
    Submit a refund request for a purchase.
    """
    # 1. Verify Purchase Ownership
    q = select(BillingPurchase).where(BillingPurchase.id == params.purchase_id)
    res = await db.execute(q)
    purchase = res.scalar_one_or_none()
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
        
    if purchase.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized for this purchase")

    # 2. Check Logic & Create
    # (Service handles eligibility check and raises 400 if failed)
    
    # Check duplicate
    await refund_eligibility_service.validate_duplicate_request(db, purchase.id)
    
    request = await manual_refund_service.create_request(
        db=db,
        purchase=purchase,
        requester=current_user,
        reason_code=params.reason_code,
        reason_detail=params.reason_detail
    )
    await db.commit()
    await db.refresh(request)
    return request


@router.get("/", response_model=List[RefundRequestResponse])
async def list_my_refunds(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Profile = Depends(deps.get_current_profile),
) -> Any:
    """
    List refund requests for my organization.
    """
    if not current_user.organization_id:
        return []
        
    query = select(RefundRequest).where(
        RefundRequest.organization_id == current_user.organization_id
    ).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{id}", response_model=RefundDetailResponse)
async def get_refund_detail(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(deps.get_current_profile),
) -> Any:
    """
    Get detailed status of a refund request.
    """
    query = select(RefundRequest).where(
        RefundRequest.id == id,
        RefundRequest.organization_id == current_user.organization_id
    )
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    return request
