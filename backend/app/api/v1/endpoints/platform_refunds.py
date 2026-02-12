from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.api import deps
from app.db.session import get_db
from app.models.profiles import Profile
from app.models.refunds import RefundRequest
from app.schemas.refunds import RefundDetailResponse, PlatformRefundAction
from app.services.manual_refunds import manual_refund_service

router = APIRouter()

@router.get("/", response_model=List[RefundDetailResponse])
async def list_all_refunds_queue(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Profile = Depends(deps.require_platform_admin),
) -> Any:
    """
    List ALL refund requests (Platform View).
    """
    query = select(RefundRequest).order_by(RefundRequest.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{id}", response_model=RefundDetailResponse)
async def get_platform_refund_detail(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(deps.require_platform_admin),
) -> Any:
    """
    Get refund detail for platform admin.
    """
    q = select(RefundRequest).where(RefundRequest.id == id)
    res = await db.execute(q)
    request = res.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    return request


@router.post("/{id}/action", response_model=RefundDetailResponse)
async def process_refund_action(
    id: UUID,
    action: PlatformRefundAction,
    db: AsyncSession = Depends(get_db),
    current_user: Profile = Depends(deps.require_platform_admin),
) -> Any:
    """
    Execute platform action: approve, reject, confirm_execution.
    """
    if action.action == "approve":
        if action.approved_amount_cents is None:
            raise HTTPException(status_code=400, detail="Must provide approved_amount_cents")
        request = await manual_refund_service.approve_request(db, id, current_user.id, action.approved_amount_cents)

    elif action.action == "reject":
        if not action.reason:
            raise HTTPException(status_code=400, detail="Must provide rejection reason")
        request = await manual_refund_service.reject_request(db, id, current_user.id, action.reason)

    elif action.action == "confirm_execution":
        if not action.provider_refund_id:
            raise HTTPException(status_code=400, detail="Must provide provider_refund_id (proof)")
        request = await manual_refund_service.confirm_manual_execution(db, id, current_user.id, action.provider_refund_id)

    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await db.commit()
    await db.refresh(request)
    return request
