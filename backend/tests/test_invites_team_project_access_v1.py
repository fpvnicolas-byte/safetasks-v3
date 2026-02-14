import hashlib
import os
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs

import pytest
from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.base import Base
from app.models.access import ProjectAssignment
from app.models.billing import OrganizationUsage
from app.models.clients import Client
from app.models.commercial import Supplier
from app.models.invites import OrganizationInvite
from app.models.organizations import Organization
from app.models.profiles import Profile
from app.models.projects import Project
from app.schemas.access import ProjectAssignmentCreate
from app.schemas.invites import ChangeRolePayload, InviteCreate
from app.schemas.commercial import StakeholderCreate
from app.services import invite_service
from app.services.contacts import contacts_service
from app.api.v1.endpoints import project_assignments as project_assignments_endpoints
from app.api.v1.endpoints import team as team_endpoints
from app.api.v1.endpoints import stakeholders as stakeholders_endpoints


def _database_uri() -> str:
    """
    Prefer TEST_DATABASE_URI for tests (so local dev config doesn't need to change).
    Falls back to the app's assembled SQLALCHEMY_DATABASE_URI.
    """
    return os.environ.get("TEST_DATABASE_URI") or settings.SQLALCHEMY_DATABASE_URI


def _asyncpg_connect_args() -> dict:
    """
    Match our app's asyncpg settings (PgBouncer transaction pool mode safe).
    Supabase pooler will error if prepared statements are cached/reused.
    """
    return {
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4()}__",
        "statement_cache_size": 0,
    }


def _extract_token(invite_link: str) -> str:
    parsed = urlparse(invite_link)
    qs = parse_qs(parsed.query)
    token_list = qs.get("token")
    assert token_list and token_list[0]
    return token_list[0]


def _sha256(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def _setup_engine(*, schema: str):
    engine = create_async_engine(
        _database_uri(),
        echo=False,
        connect_args=_asyncpg_connect_args(),
        # Avoid cross-event-loop connection reuse when pytest creates one loop per test.
        poolclass=NullPool,
    )
    async with engine.begin() as conn:
        # Keep all setup on the same sync-conn used by create_all, otherwise
        # search_path can be lost depending on how the async wrapper executes.
        def _create_schema_and_tables(sync_conn):
            sync_conn.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
            sync_conn.exec_driver_sql(f'SET search_path TO "{schema}", public')
            # If this DB already has tables in public, SQLAlchemy's checkfirst
            # can incorrectly skip creating them in our isolated schema.
            Base.metadata.create_all(sync_conn, checkfirst=False)

        await conn.run_sync(_create_schema_and_tables)

    return engine


async def _truncate_core_tables(db: AsyncSession, *, schema: str) -> None:
    # If a test raised after a DB error, the session may need a rollback
    # before we can run any cleanup statements.
    await db.rollback()

    tables = [
        "organization_invites",
        "project_assignments",
        "suppliers",
        "projects",
        "clients",
        "profiles",
        "organization_usage",
        "organizations",
    ]
    quoted = ", ".join(f'"{schema}"."{name}"' for name in tables)

    try:
        # Fail fast instead of hanging if something holds locks (e.g. shared DB).
        await db.execute(text("SET LOCAL lock_timeout = '5s'"))
        await db.execute(text("SET LOCAL statement_timeout = '30s'"))

        await db.execute(text(f"TRUNCATE TABLE {quoted} CASCADE"))
        await db.commit()
    except Exception:
        await db.rollback()
        raise


@pytest.fixture(scope="session")
async def engine():
    schema = f"pytest_{uuid.uuid4().hex}"
    engine = await _setup_engine(schema=schema)
    try:
        yield engine, schema
    finally:
        async with engine.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        await engine.dispose()


@pytest.fixture
async def db(engine):
    engine_obj, schema = engine
    async_session = sessionmaker(engine_obj, class_=AsyncSession, expire_on_commit=False, autoflush=False)
    async with async_session() as session:
        await _truncate_core_tables(session, schema=schema)

        # Ensure all SQL in this test resolves to our isolated schema.
        # Use SET LOCAL so this is safe even with PgBouncer transaction pooling.
        await session.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        yield session

        await session.rollback()
        await _truncate_core_tables(session, schema=schema)


async def _create_org(db: AsyncSession) -> Organization:
    org = Organization(
        id=uuid.uuid4(),
        name="Test Org",
        slug=f"test-org-{uuid.uuid4().hex[:8]}",
    )
    db.add(org)
    await db.flush()
    return org


async def _create_profile(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID | None,
    email: str,
    role_v2: str | None,
    role_legacy: str = "viewer",
    is_master_owner: bool = False,
    is_active: bool = True,
) -> Profile:
    profile = Profile(
        id=uuid.uuid4(),
        organization_id=organization_id,
        email=email,
        full_name=email.split("@")[0],
        role=role_legacy,
        role_v2=role_v2,
        is_master_owner=is_master_owner,
        is_active=is_active,
    )
    db.add(profile)
    await db.flush()
    return profile


async def _create_client(db: AsyncSession, *, organization_id: uuid.UUID) -> Client:
    client = Client(
        id=uuid.uuid4(),
        organization_id=organization_id,
        name="Client Co",
        email="client@example.com",
    )
    db.add(client)
    await db.flush()
    return client


async def _create_project(db: AsyncSession, *, organization_id: uuid.UUID, client_id: uuid.UUID) -> Project:
    project = Project(
        id=uuid.uuid4(),
        organization_id=organization_id,
        client_id=client_id,
        title="Test Project",
        status="draft",
    )
    db.add(project)
    await db.flush()
    return project


async def _create_supplier(db: AsyncSession, *, organization_id: uuid.UUID, category: str = "freelancer") -> Supplier:
    supplier = Supplier(
        id=uuid.uuid4(),
        organization_id=organization_id,
        name="Test Supplier",
        category=category,
        email="supplier@example.com",
    )
    db.add(supplier)
    await db.flush()
    return supplier


@pytest.mark.asyncio
async def test_create_invite_normalizes_email_and_hashes_token(db: AsyncSession):
    org = await _create_org(db)
    creator = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )

    resp = await invite_service.create_invite(
        db=db,
        org_id=org.id,
        creator_profile=creator,
        payload=InviteCreate(email="  Foo@Example.Com  ", role_v2="freelancer"),
        frontend_url="https://frontend.test",
    )

    assert resp.invite.invited_email == "foo@example.com"
    assert resp.invite.status == "pending"
    assert resp.seat_warning is None

    raw_token = _extract_token(resp.invite_link)
    assert raw_token

    invite = await db.get(OrganizationInvite, resp.invite.id)
    assert invite is not None
    assert invite.token_hash == _sha256(raw_token)
    assert invite.token_hash != raw_token
    assert len(invite.token_hash) == 64
    assert invite.expires_at > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_create_invite_rejects_self_invite(db: AsyncSession):
    org = await _create_org(db)
    creator = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )

    with pytest.raises(HTTPException) as exc:
        await invite_service.create_invite(
            db=db,
            org_id=org.id,
            creator_profile=creator,
            payload=InviteCreate(email="Admin@Example.Com", role_v2="freelancer"),
            frontend_url="https://frontend.test",
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_create_invite_permission_matrix_admin_cannot_invite_admin(db: AsyncSession):
    org = await _create_org(db)
    creator = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )

    with pytest.raises(HTTPException) as exc:
        await invite_service.create_invite(
            db=db,
            org_id=org.id,
            creator_profile=creator,
            payload=InviteCreate(email="newadmin@example.com", role_v2="admin"),
            frontend_url="https://frontend.test",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_create_invite_duplicate_pending_and_reinvite_after_revoke(db: AsyncSession):
    org = await _create_org(db)
    creator = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )

    first = await invite_service.create_invite(
        db=db,
        org_id=org.id,
        creator_profile=creator,
        payload=InviteCreate(email="user@example.com", role_v2="freelancer"),
        frontend_url="https://frontend.test",
    )

    with pytest.raises(HTTPException) as exc:
        await invite_service.create_invite(
            db=db,
            org_id=org.id,
            creator_profile=creator,
            payload=InviteCreate(email="user@example.com", role_v2="freelancer"),
            frontend_url="https://frontend.test",
        )
    assert exc.value.status_code == 409

    await invite_service.revoke_invite(
        db=db,
        org_id=org.id,
        invite_id=first.invite.id,
        revoker_profile=creator,
    )

    reinvite = await invite_service.create_invite(
        db=db,
        org_id=org.id,
        creator_profile=creator,
        payload=InviteCreate(email="user@example.com", role_v2="freelancer"),
        frontend_url="https://frontend.test",
    )
    assert reinvite.invite.id != first.invite.id


@pytest.mark.asyncio
async def test_accept_invite_happy_path_sets_roles_links_supplier_and_increments_usage(db: AsyncSession):
    org = await _create_org(db)
    # Seat lock row (exercise SELECT ... FOR UPDATE path).
    db.add(OrganizationUsage(org_id=org.id, users_count=0))
    await db.flush()

    inviter = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )
    accepting = await _create_profile(
        db,
        organization_id=None,
        email="User@Example.Com",
        role_v2=None,
        role_legacy="viewer",
    )
    supplier = await _create_supplier(db, organization_id=org.id, category="freelancer")

    created = await invite_service.create_invite(
        db=db,
        org_id=org.id,
        creator_profile=inviter,
        payload=InviteCreate(email="user@example.com", role_v2="freelancer", supplier_id=supplier.id),
        frontend_url="https://frontend.test",
    )

    raw_token = _extract_token(created.invite_link)
    updated_profile = await invite_service.accept_invite(
        db=db,
        token=raw_token,
        accepting_profile=accepting,
    )
    await db.commit()

    assert updated_profile.organization_id == org.id
    assert updated_profile.role_v2 == "freelancer"
    assert updated_profile.role == "crew"

    usage = await db.get(OrganizationUsage, org.id)
    assert usage is not None
    # invite acceptance reserves a seat after reconciling current active org users,
    # so existing inviter + accepted profile = 2
    assert usage.users_count == 2

    invite = await db.get(OrganizationInvite, created.invite.id)
    assert invite is not None
    assert invite.status == "accepted"
    assert invite.accepted_by_id == accepting.id
    assert invite.accepted_at is not None

    supplier_refreshed = await db.get(Supplier, supplier.id)
    assert supplier_refreshed is not None
    assert supplier_refreshed.profile_id == accepting.id


@pytest.mark.asyncio
async def test_accept_invite_mismatched_email_403(db: AsyncSession):
    org = await _create_org(db)
    db.add(OrganizationUsage(org_id=org.id, users_count=0))
    await db.flush()

    inviter = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )
    accepting = await _create_profile(
        db,
        organization_id=None,
        email="other@example.com",
        role_v2=None,
        role_legacy="viewer",
    )

    created = await invite_service.create_invite(
        db=db,
        org_id=org.id,
        creator_profile=inviter,
        payload=InviteCreate(email="invited@example.com", role_v2="freelancer"),
        frontend_url="https://frontend.test",
    )
    raw_token = _extract_token(created.invite_link)

    with pytest.raises(HTTPException) as exc:
        await invite_service.accept_invite(
            db=db,
            token=raw_token,
            accepting_profile=accepting,
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_accept_invite_expired_marks_invite_expired_and_returns_410(db: AsyncSession):
    org = await _create_org(db)
    db.add(OrganizationUsage(org_id=org.id, users_count=0))
    await db.flush()

    inviter = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )
    accepting = await _create_profile(
        db,
        organization_id=None,
        email="invited@example.com",
        role_v2=None,
        role_legacy="viewer",
    )

    created = await invite_service.create_invite(
        db=db,
        org_id=org.id,
        creator_profile=inviter,
        payload=InviteCreate(email="invited@example.com", role_v2="freelancer"),
        frontend_url="https://frontend.test",
    )
    raw_token = _extract_token(created.invite_link)

    invite = await db.get(OrganizationInvite, created.invite.id)
    assert invite is not None
    invite.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    await db.flush()

    with pytest.raises(HTTPException) as exc:
        await invite_service.accept_invite(
            db=db,
            token=raw_token,
            accepting_profile=accepting,
        )
    assert exc.value.status_code == 410

    invite_after = await db.get(OrganizationInvite, created.invite.id)
    assert invite_after is not None
    assert invite_after.status == "expired"


@pytest.mark.asyncio
async def test_resend_invite_rotates_token_and_old_token_no_longer_works(db: AsyncSession):
    org = await _create_org(db)
    db.add(OrganizationUsage(org_id=org.id, users_count=0))
    await db.flush()

    inviter = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )
    accepting = await _create_profile(
        db,
        organization_id=None,
        email="invited@example.com",
        role_v2=None,
        role_legacy="viewer",
    )

    created = await invite_service.create_invite(
        db=db,
        org_id=org.id,
        creator_profile=inviter,
        payload=InviteCreate(email="invited@example.com", role_v2="freelancer"),
        frontend_url="https://frontend.test",
    )
    old_token = _extract_token(created.invite_link)

    invite_before = await db.get(OrganizationInvite, created.invite.id)
    assert invite_before is not None
    old_hash = invite_before.token_hash

    new_link = await invite_service.resend_invite(
        db=db,
        org_id=org.id,
        invite_id=created.invite.id,
        resender_profile=inviter,
        frontend_url="https://frontend.test",
    )
    new_token = _extract_token(new_link)

    invite_after = await db.get(OrganizationInvite, created.invite.id)
    assert invite_after is not None
    assert invite_after.token_hash != old_hash
    assert invite_after.token_hash == _sha256(new_token)

    with pytest.raises(HTTPException) as exc:
        await invite_service.accept_invite(
            db=db,
            token=old_token,
            accepting_profile=accepting,
        )
    assert exc.value.status_code == 404

    await invite_service.accept_invite(
        db=db,
        token=new_token,
        accepting_profile=accepting,
    )


@pytest.mark.asyncio
async def test_team_list_members_filters_inactive_and_returns_effective_role(db: AsyncSession):
    org = await _create_org(db)
    await _create_profile(
        db,
        organization_id=org.id,
        email="active@example.com",
        role_v2="producer",
        role_legacy="manager",
        is_active=True,
    )
    await _create_profile(
        db,
        organization_id=org.id,
        email="inactive@example.com",
        role_v2="finance",
        role_legacy="viewer",
        is_active=False,
    )

    members = await team_endpoints.list_members(organization_id=org.id, db=db)
    assert len(members) == 1
    assert members[0].email == "active@example.com"
    assert members[0].effective_role == "producer"


@pytest.mark.asyncio
async def test_team_change_role_removes_assignments_when_switching_from_freelancer(db: AsyncSession):
    org = await _create_org(db)
    owner = await _create_profile(
        db,
        organization_id=org.id,
        email="owner@example.com",
        role_v2="owner",
        role_legacy="admin",
        is_master_owner=True,
    )

    freelancer = await _create_profile(
        db,
        organization_id=org.id,
        email="freelancer@example.com",
        role_v2="freelancer",
        role_legacy="crew",
    )

    client = await _create_client(db, organization_id=org.id)
    project = await _create_project(db, organization_id=org.id, client_id=client.id)
    assignment = ProjectAssignment(id=uuid.uuid4(), project_id=project.id, user_id=freelancer.id)
    db.add(assignment)
    await db.flush()

    result = await team_endpoints.change_member_role(
        profile_id=freelancer.id,
        payload=ChangeRolePayload(role_v2="producer"),
        organization_id=org.id,
        profile=owner,
        db=db,
    )
    assert result["new_role"] == "producer"

    remaining = await db.execute(
        select(ProjectAssignment).where(ProjectAssignment.user_id == freelancer.id)
    )
    assert remaining.scalars().all() == []


@pytest.mark.asyncio
async def test_team_remove_member_resets_profile_deletes_assignments_and_decrements_usage(db: AsyncSession):
    org = await _create_org(db)
    db.add(OrganizationUsage(org_id=org.id, users_count=2))
    await db.flush()

    admin = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )
    target = await _create_profile(
        db,
        organization_id=org.id,
        email="freelancer@example.com",
        role_v2="freelancer",
        role_legacy="crew",
    )

    client = await _create_client(db, organization_id=org.id)
    project = await _create_project(db, organization_id=org.id, client_id=client.id)
    db.add(ProjectAssignment(id=uuid.uuid4(), project_id=project.id, user_id=target.id))
    supplier = await _create_supplier(db, organization_id=org.id, category="freelancer")
    supplier.profile_id = target.id
    db.add(supplier)
    await db.flush()

    resp = await team_endpoints.remove_member(
        profile_id=target.id,
        organization_id=org.id,
        profile=admin,
        db=db,
    )
    assert resp["detail"] == "Member removed."

    target_after = await db.get(Profile, target.id)
    assert target_after is not None
    assert target_after.organization_id is None
    assert target_after.role_v2 is None
    assert target_after.role == "viewer"

    usage = await db.get(OrganizationUsage, org.id)
    assert usage is not None
    assert usage.users_count == 1

    remaining = await db.execute(select(ProjectAssignment).where(ProjectAssignment.user_id == target.id))
    assert remaining.scalars().all() == []

    supplier_after = await db.get(Supplier, supplier.id)
    assert supplier_after is not None
    assert supplier_after.profile_id is None


@pytest.mark.asyncio
async def test_contacts_detail_returns_project_access_assignments_for_linked_freelancer(db: AsyncSession):
    org = await _create_org(db)
    freelancer = await _create_profile(
        db,
        organization_id=org.id,
        email="freelancer@example.com",
        role_v2="freelancer",
        role_legacy="crew",
    )
    supplier = await _create_supplier(db, organization_id=org.id, category="freelancer")
    supplier.profile_id = freelancer.id
    db.add(supplier)

    client = await _create_client(db, organization_id=org.id)
    project = await _create_project(db, organization_id=org.id, client_id=client.id)
    db.add(ProjectAssignment(id=uuid.uuid4(), project_id=project.id, user_id=freelancer.id))
    await db.flush()

    detail = await contacts_service.get_contact_detail(
        db=db,
        organization_id=org.id,
        supplier_id=supplier.id,
    )

    assert detail is not None
    assert detail["team_info"] is not None
    assert detail["team_info"]["effective_role"] == "freelancer"
    assert len(detail["project_access_assignments"]) == 1
    assert detail["project_access_assignments"][0]["project_id"] == str(project.id)
    assert detail["project_access_assignments"][0]["project_title"] == project.title


@pytest.mark.asyncio
async def test_contacts_detail_ignores_linked_profile_outside_org(db: AsyncSession):
    org = await _create_org(db)
    other_org = await _create_org(db)
    foreign_profile = await _create_profile(
        db,
        organization_id=other_org.id,
        email="foreign@example.com",
        role_v2="freelancer",
        role_legacy="crew",
    )

    supplier = await _create_supplier(db, organization_id=org.id, category="freelancer")
    supplier.profile_id = foreign_profile.id
    db.add(supplier)
    await db.flush()

    detail = await contacts_service.get_contact_detail(
        db=db,
        organization_id=org.id,
        supplier_id=supplier.id,
    )

    assert detail is not None
    assert detail["platform_status"] == "none"
    assert detail["team_info"] is None
    assert detail["project_access_assignments"] == []


@pytest.mark.asyncio
async def test_create_stakeholder_rejects_supplier_from_other_org(db: AsyncSession):
    org = await _create_org(db)
    other_org = await _create_org(db)
    admin = await _create_profile(
        db,
        organization_id=org.id,
        email="admin@example.com",
        role_v2="admin",
        role_legacy="admin",
    )

    client = await _create_client(db, organization_id=org.id)
    project = await _create_project(db, organization_id=org.id, client_id=client.id)
    foreign_supplier = await _create_supplier(db, organization_id=other_org.id, category="freelancer")
    await db.flush()

    with pytest.raises(HTTPException) as exc:
        await stakeholders_endpoints.create_stakeholder(
            stakeholder_in=StakeholderCreate(
                name="Crew Member",
                role="Gaffer",
                project_id=project.id,
                supplier_id=foreign_supplier.id,
            ),
            organization_id=org.id,
            profile=admin,
            db=db,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid supplier_id for this organization"


@pytest.mark.asyncio
async def test_project_assignments_reject_non_freelancer_and_supports_crud(db: AsyncSession):
    org = await _create_org(db)

    freelancer = await _create_profile(
        db,
        organization_id=org.id,
        email="freelancer@example.com",
        role_v2="freelancer",
        role_legacy="crew",
    )
    non_freelancer = await _create_profile(
        db,
        organization_id=org.id,
        email="producer@example.com",
        role_v2="producer",
        role_legacy="manager",
    )

    client = await _create_client(db, organization_id=org.id)
    project = await _create_project(db, organization_id=org.id, client_id=client.id)

    with pytest.raises(HTTPException) as exc:
        await project_assignments_endpoints.assign_user_to_project(
            assignment_in=ProjectAssignmentCreate(project_id=project.id, user_id=non_freelancer.id),
            organization_id=org.id,
            db=db,
        )
    assert exc.value.status_code == 400

    created = await project_assignments_endpoints.assign_user_to_project(
        assignment_in=ProjectAssignmentCreate(project_id=project.id, user_id=freelancer.id),
        organization_id=org.id,
        db=db,
    )
    assert created.project_id == project.id
    assert created.user_id == freelancer.id

    # Duplicate should be 409
    with pytest.raises(HTTPException) as dup_exc:
        await project_assignments_endpoints.assign_user_to_project(
            assignment_in=ProjectAssignmentCreate(project_id=project.id, user_id=freelancer.id),
            organization_id=org.id,
            db=db,
        )
    assert dup_exc.value.status_code == 409

    listed = await project_assignments_endpoints.list_assignments(
        project_id=project.id,
        organization_id=org.id,
        db=db,
    )
    assert len(listed) == 1
    assert listed[0].id == created.id

    await project_assignments_endpoints.remove_assignment(
        assignment_id=created.id,
        organization_id=org.id,
        db=db,
    )
    await db.flush()

    after = await db.execute(select(ProjectAssignment).where(ProjectAssignment.id == created.id))
    assert after.scalar_one_or_none() is None
