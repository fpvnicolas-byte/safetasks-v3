from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.refunds import RefundRequest, RefundEvent, RefundTransaction, BillingPurchase
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.services.email_service import send_email
from app.core.config import settings
from fastapi import HTTPException, status

class ManualRefundService:
    
    async def create_request(
        self,
        db: AsyncSession,
        purchase: BillingPurchase,
        requester: Profile,
        reason_code: str,
        reason_detail: str
    ) -> RefundRequest:
        """
        Create a new refund request and notify admins.
        """
        # Calculate snapshot values
        from app.services.refunds import refund_eligibility_service # Local import to avoid circular dependency if any

        usage_value = refund_eligibility_service.calculate_prorated_usage(purchase)
        max_refund = refund_eligibility_service.get_max_refundable_cents(
            purchase=purchase,
            consumed_usage_cents=usage_value,
        )
        
        is_eligible, eligibility_reason, eligible_until = refund_eligibility_service.check_eligibility(purchase)
        
        if not is_eligible:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund not eligible: {eligibility_reason}"
            )

        # Create Request
        request = RefundRequest(
            purchase_id=purchase.id,
            organization_id=purchase.organization_id,
            requester_profile_id=requester.id,
            status="requested",
            reason_code=reason_code,
            reason_detail=reason_detail,
            amount_paid_cents=purchase.amount_paid_cents,
            consumed_usage_value_cents=usage_value,
            calculated_max_refund_cents=max_refund,
            eligible_until=eligible_until
        )
        db.add(request)
        await db.flush()
        
        # Log Event
        event = RefundEvent(
            refund_request_id=request.id,
            actor_type="user",
            actor_id=requester.id,
            event_type="created",
            event_metadata={"reason": reason_code}
        )
        db.add(event)

        org_name = "Unknown Org"
        try:
            org_q = select(Organization).where(Organization.id == purchase.organization_id)
            res = await db.execute(org_q)
            org = res.scalar_one_or_none()
            if org and org.name:
                org_name = org.name
        except Exception:
            # Fallback to default org label if lookup fails.
            pass

        # Notify Platform Superadmins (in-app notifications)
        try:
            from app.services.notification_triggers import notify_platform_superadmins

            await notify_platform_superadmins(
                db=db,
                source_organization_id=purchase.organization_id,
                title="platform_refund_request_title",
                message="platform_refund_request_message",
                type="warning",
                metadata={
                    "refund_request_id": str(request.id),
                    "purchase_id": str(purchase.id),
                    "organization_id": str(purchase.organization_id),
                    "organization_name": org_name,
                    "requester_email": requester.email or "",
                    "reason_code": reason_code,
                    "reason_detail": reason_detail or reason_code,
                    "amount_paid_cents": purchase.amount_paid_cents,
                    "amount_paid": f"R$ {purchase.amount_paid_cents / 100:,.2f}",
                },
            )
        except Exception as e:
            print(f"Failed to send platform superadmin refund notification: {e}")
        
        # Notify Admins
        try:
            amount_fmt = f"{purchase.amount_paid_cents / 100:.2f}"
            dashboard_url = str(settings.FRONTEND_URL).rstrip("/")
            review_url = f"{dashboard_url}/platform/refunds/{request.id}"

            html = f"""
            <h2>New refund request</h2>
            <p>Organization: <strong>{org_name}</strong> ({purchase.organization_id})</p>
            <p>Requester: {requester.email}</p>
            <p>Amount paid: R$ {amount_fmt}</p>
            <p>Reason: {reason_detail or reason_code}</p>
            <p>Requested at: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</p>
            <p><a href="{review_url}">Open refund review</a></p>
            """

            # Reuse existing synchronous email helper.
            send_email(
                to=[settings.RESEND_FROM_EMAIL or "noreply@produzo.app"],
                subject=f"Refund Request: {org_name}",
                html=html,
            )
        except Exception as e:
            # Don't fail the request if email fails, but log it
            print(f"Failed to send admin notification email: {e}")

        return request

    async def approve_request(
        self,
        db: AsyncSession,
        request_id: UUID,
        admin_id: UUID,
        approved_amount_cents: int
    ) -> RefundRequest:
        """
        Admin approves the request -> Moves to 'processing'.
        Waiting for manual execution.
        """
        q = select(RefundRequest).where(RefundRequest.id == request_id)
        res = await db.execute(q)
        request = res.scalar_one_or_none()
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
            
        if request.status != "requested":
             raise HTTPException(status_code=400, detail="Request is not in 'requested' state")

        if approved_amount_cents <= 0:
            raise HTTPException(status_code=400, detail="approved_amount_cents must be greater than zero")

        if approved_amount_cents > request.calculated_max_refund_cents:
            raise HTTPException(
                status_code=400,
                detail="approved_amount_cents cannot exceed calculated_max_refund_cents",
            )

        request.status = "processing"
        request.approved_amount_cents = approved_amount_cents
        request.decided_at = datetime.now(timezone.utc)
        db.add(request)
        
        event = RefundEvent(
            refund_request_id=request.id,
            actor_type="platform_admin",
            actor_id=admin_id,
            event_type="approved",
            event_metadata={"approved_amount": approved_amount_cents}
        )
        db.add(event)
        return request

    async def confirm_manual_execution(
        self,
        db: AsyncSession,
        request_id: UUID,
        admin_id: UUID,
        provider_refund_id: str,
        provider_name: str = "infinitypay"
    ) -> RefundRequest:
        """
        Admin confirms they manually clicked 'Refund' in InfinityPay.
        move to 'refunded'.
        """
        q = select(RefundRequest).where(RefundRequest.id == request_id)
        res = await db.execute(q)
        request = res.scalar_one_or_none()
        
        if not request:
             raise HTTPException(status_code=404, detail="Request not found")

        if request.status != "processing":
             raise HTTPException(status_code=400, detail="Request must be 'processing' (approved) before confirming execution")

        if not request.approved_amount_cents or request.approved_amount_cents <= 0:
            raise HTTPException(status_code=400, detail="Request has no approved amount to confirm")

        # Create Transaction Record
        txn = RefundTransaction(
            refund_request_id=request.id,
            provider=provider_name,
            provider_refund_id=provider_refund_id,
            amount_cents=request.approved_amount_cents,
            status="succeeded",
            completed_at=datetime.now(timezone.utc)
        )
        db.add(txn)
        
        # Update Request Status
        request.status = "refunded"
        request.processed_at = datetime.now(timezone.utc)
        db.add(request)
        
        # Log Event
        event = RefundEvent(
            refund_request_id=request.id,
            actor_type="platform_admin",
            actor_id=admin_id,
            event_type="refunded_manually",
            event_metadata={"provider_refund_id": provider_refund_id}
        )
        db.add(event)
        
        # Update Purchase Totals
        # Ideally fetch purchase and update total_refunded_cents
        purchase_q = select(BillingPurchase).where(BillingPurchase.id == request.purchase_id)
        p_res = await db.execute(purchase_q)
        purchase = p_res.scalar_one_or_none()
        if purchase:
            purchase.total_refunded_cents += request.approved_amount_cents
            db.add(purchase)
            
        return request

    async def reject_request(
        self,
        db: AsyncSession,
        request_id: UUID,
        admin_id: UUID,
        reason: str
    ) -> RefundRequest:
        """
        Admin rejects the request.
        """
        q = select(RefundRequest).where(RefundRequest.id == request_id)
        res = await db.execute(q)
        request = res.scalar_one_or_none()
        
        if not request:
             raise HTTPException(status_code=404, detail="Request not found")

        if request.status not in {"requested", "processing"}:
            raise HTTPException(status_code=400, detail="Request cannot be rejected from current status")

        request.status = "rejected"
        request.decided_at = datetime.now(timezone.utc)
        db.add(request)
        
        event = RefundEvent(
            refund_request_id=request.id,
            actor_type="platform_admin",
            actor_id=admin_id,
            event_type="rejected",
            event_metadata={"reason": reason}
        )
        db.add(event)
        return request

manual_refund_service = ManualRefundService()
