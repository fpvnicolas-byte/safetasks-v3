from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional, Dict, Any
from uuid import UUID

from app.models.commercial import Supplier, Stakeholder
from app.models.transactions import Transaction
from app.models.profiles import Profile
from app.models.invites import OrganizationInvite
from app.models.access import ProjectAssignment
from app.models.projects import Project


class ContactsService:
    """Aggregation service for the unified Contacts view."""

    async def get_contacts(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        search: Optional[str] = None,
        category: Optional[str] = None,
        platform_status: Optional[str] = None,
        active_only: bool = True,
    ) -> List[Dict[str, Any]]:
        """Get all contacts (suppliers) enriched with project count, spend, and platform status."""

        # Base supplier conditions
        conditions = [Supplier.organization_id == organization_id]
        if active_only:
            conditions.append(Supplier.is_active == True)
        if category:
            conditions.append(Supplier.category == category)
        if search:
            search_term = f"%{search}%"
            conditions.append(
                or_(
                    Supplier.name.ilike(search_term),
                    Supplier.email.ilike(search_term),
                    Supplier.phone.ilike(search_term),
                )
            )

        suppliers_query = select(Supplier).where(and_(*conditions)).order_by(Supplier.name)
        result = await db.execute(suppliers_query)
        suppliers = result.scalars().all()

        if not suppliers:
            return []

        supplier_ids = [s.id for s in suppliers]

        # Project count per supplier
        project_counts_q = (
            select(
                Stakeholder.supplier_id,
                func.count(func.distinct(Stakeholder.project_id)).label("project_count"),
            )
            .where(
                Stakeholder.supplier_id.in_(supplier_ids),
                Stakeholder.organization_id == organization_id,
            )
            .group_by(Stakeholder.supplier_id)
        )
        project_counts_result = await db.execute(project_counts_q)
        project_counts = {row[0]: row[1] for row in project_counts_result.all()}

        # Total spend per supplier
        spend_q = (
            select(
                Transaction.supplier_id,
                func.coalesce(func.sum(Transaction.amount_cents), 0).label("total_spent"),
            )
            .where(
                Transaction.supplier_id.in_(supplier_ids),
                Transaction.type == "expense",
                Transaction.organization_id == organization_id,
            )
            .group_by(Transaction.supplier_id)
        )
        spend_result = await db.execute(spend_q)
        spend_map = {row[0]: row[1] for row in spend_result.all()}

        # Profile ids that are linked
        profile_ids = [s.profile_id for s in suppliers if s.profile_id]
        profile_map: Dict[UUID, Profile] = {}
        if profile_ids:
            profiles_result = await db.execute(
                select(Profile).where(
                    Profile.id.in_(profile_ids),
                    Profile.organization_id == organization_id,
                    Profile.is_active == True,
                )
            )
            for p in profiles_result.scalars().all():
                profile_map[p.id] = p

        # Pending invites for suppliers
        invite_q = (
            select(OrganizationInvite)
            .where(
                OrganizationInvite.supplier_id.in_(supplier_ids),
                OrganizationInvite.status == "pending",
                OrganizationInvite.org_id == organization_id,
            )
        )
        invite_result = await db.execute(invite_q)
        invite_map: Dict[UUID, OrganizationInvite] = {}
        for inv in invite_result.scalars().all():
            if inv.supplier_id:
                invite_map[inv.supplier_id] = inv

        contacts = []
        for s in suppliers:
            # Determine platform status
            if s.profile_id and s.profile_id in profile_map:
                platform_status_val = "active"
                profile = profile_map[s.profile_id]
                platform_role = profile.role_v2 or profile.role
            elif s.id in invite_map:
                platform_status_val = "invited"
                platform_role = None
            else:
                platform_status_val = "none"
                platform_role = None

            contacts.append({
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "email": s.email,
                "phone": s.phone,
                "document_id": s.document_id,
                "is_active": s.is_active,
                "specialties": s.specialties,
                "notes": s.notes,
                "created_at": s.created_at,
                "project_count": project_counts.get(s.id, 0),
                "total_spent_cents": spend_map.get(s.id, 0),
                "platform_status": platform_status_val,
                "platform_role": platform_role,
                "profile_id": s.profile_id,
            })

        # Apply platform_status filter after enrichment
        if platform_status and platform_status != "all":
            contacts = [c for c in contacts if c["platform_status"] == platform_status]

        return contacts

    async def get_contact_detail(
        self,
        db: AsyncSession,
        *,
        organization_id: UUID,
        supplier_id: UUID,
    ) -> Optional[Dict[str, Any]]:
        """Get full contact detail including assignments, team info, and invite status."""

        supplier_result = await db.execute(
            select(Supplier).where(
                Supplier.id == supplier_id,
                Supplier.organization_id == organization_id,
            )
        )
        supplier = supplier_result.scalar_one_or_none()
        if not supplier:
            return None

        # Get stakeholder assignments
        assignments_result = await db.execute(
            select(Stakeholder).where(
                Stakeholder.supplier_id == supplier_id,
                Stakeholder.organization_id == organization_id,
            )
        )
        assignments = assignments_result.scalars().all()

        # Get project names for assignments
        project_ids = list(set(a.project_id for a in assignments))
        project_map: Dict[UUID, str] = {}
        if project_ids:
            projects_result = await db.execute(
                select(Project.id, Project.title).where(
                    Project.id.in_(project_ids),
                    Project.organization_id == organization_id,
                )
            )
            for pid, ptitle in projects_result.all():
                project_map[pid] = ptitle

        assignments_data = []
        for a in assignments:
            assignments_data.append({
                "id": str(a.id),
                "project_id": str(a.project_id),
                "project_title": project_map.get(a.project_id, "Unknown"),
                "role": a.role,
                "status": a.status.value if hasattr(a.status, 'value') else str(a.status),
                "rate_type": a.rate_type,
                "rate_value_cents": a.rate_value_cents,
                "booking_start_date": str(a.booking_start_date) if a.booking_start_date else None,
                "booking_end_date": str(a.booking_end_date) if a.booking_end_date else None,
                "is_active": a.is_active,
            })

        # Team info
        team_info = None
        team_profile: Optional[Profile] = None
        if supplier.profile_id:
            profile_result = await db.execute(
                select(Profile).where(
                    Profile.id == supplier.profile_id,
                    Profile.organization_id == organization_id,
                    Profile.is_active == True,
                )
            )
            team_profile = profile_result.scalar_one_or_none()
            if team_profile:
                team_info = {
                    "profile_id": str(team_profile.id),
                    "email": team_profile.email,
                    "full_name": team_profile.full_name,
                    "effective_role": team_profile.role_v2 or team_profile.role,
                    "is_master_owner": team_profile.is_master_owner,
                    "created_at": str(team_profile.created_at) if team_profile.created_at else None,
                }

        # Pending invite
        pending_invite = None
        invite_result = await db.execute(
            select(OrganizationInvite).where(
                OrganizationInvite.supplier_id == supplier_id,
                OrganizationInvite.status == "pending",
                OrganizationInvite.org_id == organization_id,
            )
        )
        invite = invite_result.scalar_one_or_none()
        if invite:
            pending_invite = {
                "id": str(invite.id),
                "invited_email": invite.invited_email,
                "role_v2": invite.role_v2,
                "status": invite.status,
                "expires_at": str(invite.expires_at) if invite.expires_at else None,
                "created_at": str(invite.created_at) if invite.created_at else None,
            }

        # Spend
        spend_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount_cents), 0)).where(
                Transaction.supplier_id == supplier_id,
                Transaction.type == "expense",
                Transaction.organization_id == organization_id,
            )
        )
        total_spent = spend_result.scalar() or 0

        # Project access assignments for linked freelancer profiles
        project_access_assignments: List[Dict[str, Any]] = []
        if team_profile and (team_profile.role_v2 or team_profile.role) == "freelancer":
            access_result = await db.execute(
                select(
                    ProjectAssignment.id,
                    ProjectAssignment.project_id,
                    Project.title,
                    ProjectAssignment.created_at,
                )
                .join(Project, Project.id == ProjectAssignment.project_id)
                .where(
                    ProjectAssignment.user_id == team_profile.id,
                    Project.organization_id == organization_id,
                )
                .order_by(ProjectAssignment.created_at.desc())
            )
            project_access_assignments = [
                {
                    "id": str(pa_id),
                    "project_id": str(project_id),
                    "project_title": project_title,
                    "created_at": str(created_at) if created_at else None,
                }
                for pa_id, project_id, project_title, created_at in access_result.all()
            ]

        # Platform status
        if team_info:
            platform_status = "active"
            platform_role = team_info["effective_role"]
        elif pending_invite:
            platform_status = "invited"
            platform_role = None
        else:
            platform_status = "none"
            platform_role = None

        return {
            "id": supplier.id,
            "name": supplier.name,
            "category": supplier.category,
            "email": supplier.email,
            "phone": supplier.phone,
            "document_id": supplier.document_id,
            "address": supplier.address,
            "bank_info": supplier.bank_info,
            "is_active": supplier.is_active,
            "specialties": supplier.specialties,
            "notes": supplier.notes,
            "created_at": supplier.created_at,
            "project_count": len(set(a.project_id for a in assignments)),
            "total_spent_cents": total_spent,
            "platform_status": platform_status,
            "platform_role": platform_role,
            "profile_id": supplier.profile_id,
            "assignments": assignments_data,
            "project_access_assignments": project_access_assignments,
            "team_info": team_info,
            "pending_invite": pending_invite,
        }


contacts_service = ContactsService()
