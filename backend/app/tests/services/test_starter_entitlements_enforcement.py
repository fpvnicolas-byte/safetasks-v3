"""
Starter plan entitlement enforcement tests.

These are pure unit tests with mocked DB interactions.
"""
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.commercial import service as commercial_module
from app.modules.commercial.service import ProposalService
from app.services.proposal_pdf import ProposalPDFService
from app.schemas.proposals import ProposalApproval
from app.services import entitlements as entitlements_module
from app.api.v1.endpoints import production as production_endpoint


# This module is unit-test only (all DB interactions are mocked), so avoid
# forcing live DB schema truncation from app/tests/conftest.py.
@pytest.fixture(autouse=True)
async def _truncate_public_schema():
    yield


def _starter_entitlement() -> SimpleNamespace:
    gb = 1024 * 1024 * 1024
    return SimpleNamespace(
        max_projects=5,
        max_clients=20,
        max_proposals=20,
        max_users=5,
        max_storage_bytes=25 * gb,
        ai_credits=100,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "resource,limit",
    [
        ("projects", 5),
        ("clients", 20),
        ("proposals", 20),
        ("users", 5),
    ],
)
async def test_resource_limit_blocks_at_starter_threshold(resource: str, limit: int):
    org = SimpleNamespace(id=uuid4(), plan_id=uuid4())
    db = AsyncMock()
    usage = SimpleNamespace(
        projects_count=0,
        clients_count=0,
        proposals_count=0,
        users_count=0,
    )
    setattr(usage, f"{resource}_count", limit)

    with patch.object(
        entitlements_module,
        "get_entitlement",
        AsyncMock(return_value=_starter_entitlement()),
    ), patch.object(
        entitlements_module,
        "_lock_usage_row",
        AsyncMock(return_value=usage),
    ), patch.object(
        entitlements_module,
        "_count_resource_records",
        AsyncMock(return_value=limit),
    ):
        with pytest.raises(HTTPException) as exc:
            await entitlements_module.ensure_and_reserve_resource_limit(
                db,
                org,
                resource=resource,
            )

    assert exc.value.status_code == 402
    assert resource in exc.value.detail


@pytest.mark.asyncio
async def test_storage_limit_blocks_when_upload_exceeds_starter_capacity():
    org = SimpleNamespace(id=uuid4(), plan_id=uuid4())
    db = AsyncMock()
    gb = 1024 * 1024 * 1024
    usage = SimpleNamespace(storage_bytes_used=(25 * gb) - 10)

    with patch.object(
        entitlements_module,
        "get_entitlement",
        AsyncMock(return_value=_starter_entitlement()),
    ), patch.object(
        entitlements_module,
        "_lock_usage_row",
        AsyncMock(return_value=usage),
    ):
        with pytest.raises(HTTPException) as exc:
            await entitlements_module.ensure_and_reserve_storage_capacity(
                db,
                org,
                bytes_to_add=20,
            )

    assert exc.value.status_code == 402
    assert "storage" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_ai_credit_limit_blocks_when_starter_credits_are_exhausted():
    org = SimpleNamespace(id=uuid4(), plan_id=uuid4())
    db = AsyncMock()
    usage = SimpleNamespace(ai_credits_used=100)

    with patch.object(
        entitlements_module,
        "get_entitlement",
        AsyncMock(return_value=_starter_entitlement()),
    ), patch.object(
        entitlements_module,
        "_lock_usage_row",
        AsyncMock(return_value=usage),
    ):
        with pytest.raises(HTTPException) as exc:
            await entitlements_module.ensure_and_reserve_ai_credits(
                db,
                org,
                credits_to_add=1,
            )

    assert exc.value.status_code == 402
    assert "ai credits" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_approve_proposal_blocks_when_starter_project_limit_reached():
    organization_id = uuid4()
    proposal_id = uuid4()
    organization = SimpleNamespace(id=organization_id, plan_id=uuid4())
    proposal = SimpleNamespace(
        id=proposal_id,
        status="sent",
        client_id=uuid4(),
        title="Starter Proposal",
        description="Starter plan test",
        start_date=None,
        end_date=None,
        services=[],
        project_id=None,
    )
    db = AsyncMock()
    db.get = AsyncMock(return_value=organization)
    db.flush = AsyncMock()
    db.refresh = AsyncMock()

    @asynccontextmanager
    async def _tx():
        yield

    db.begin_nested = _tx

    service = ProposalService()

    with patch.object(
        service,
        "get",
        AsyncMock(return_value=proposal),
    ), patch.object(
        commercial_module,
        "ensure_and_reserve_resource_limit",
        AsyncMock(
            side_effect=HTTPException(
                status_code=402,
                detail="Plan limit reached for projects. Please upgrade your plan.",
            )
        ),
    ) as mock_limit, patch.object(
        commercial_module.project_service,
        "create",
        AsyncMock(),
    ) as mock_create, patch.object(
        service,
        "_send_proposal_approval_notifications",
        AsyncMock(),
    ):
        with pytest.raises(HTTPException) as exc:
            await service.approve_proposal(
                db=db,
                organization_id=organization_id,
                proposal_id=proposal_id,
                approval_data=ProposalApproval(notes=None),
            )

    assert exc.value.status_code == 402
    mock_limit.assert_awaited_once()
    mock_create.assert_not_called()


@pytest.mark.asyncio
async def test_approve_proposal_checks_and_reserves_project_limit():
    organization_id = uuid4()
    proposal_id = uuid4()
    organization = SimpleNamespace(id=organization_id, plan_id=uuid4())
    project = SimpleNamespace(id=uuid4(), title="Created Project")
    proposal = SimpleNamespace(
        id=proposal_id,
        status="sent",
        client_id=uuid4(),
        title="Approved Proposal",
        description="Should become a project",
        start_date=None,
        end_date=None,
        services=[],
        project_id=None,
    )
    db = AsyncMock()
    db.get = AsyncMock(return_value=organization)
    db.flush = AsyncMock()
    db.refresh = AsyncMock()

    @asynccontextmanager
    async def _tx():
        yield

    db.begin_nested = _tx

    service = ProposalService()

    with patch.object(
        service,
        "get",
        AsyncMock(return_value=proposal),
    ), patch.object(
        commercial_module,
        "ensure_and_reserve_resource_limit",
        AsyncMock(return_value=None),
    ) as mock_limit, patch.object(
        commercial_module.project_service,
        "create",
        AsyncMock(return_value=project),
    ) as mock_create, patch.object(
        service,
        "_send_proposal_approval_notifications",
        AsyncMock(return_value=None),
    ), patch(
        "app.core.config.settings.FINANCIAL_AUTOMATION_ENABLED",
        False,
    ):
        result = await service.approve_proposal(
            db=db,
            organization_id=organization_id,
            proposal_id=proposal_id,
            approval_data=ProposalApproval(notes=None),
        )

    assert result is proposal
    assert proposal.status == "approved"
    assert proposal.project_id == project.id

    mock_limit.assert_awaited_once()
    limit_call = mock_limit.await_args
    assert limit_call.kwargs["resource"] == "projects"

    mock_create.assert_awaited_once()


@pytest.mark.asyncio
async def test_proposal_pdf_generation_reserves_storage_before_upload():
    service = ProposalPDFService()
    db = AsyncMock()
    organization = SimpleNamespace(id=uuid4())
    proposal = SimpleNamespace(
        id=uuid4(),
        organization_id=organization.id,
        title="Starter Proposal",
        proposal_metadata={},
    )
    client = SimpleNamespace(name="Client")

    with patch.object(
        service,
        "generate_pdf",
        AsyncMock(return_value=b"pdf-bytes"),
    ), patch(
        "app.services.entitlements.ensure_and_reserve_storage_capacity",
        new_callable=AsyncMock,
    ) as mock_reserve, patch(
        "app.services.storage.storage_service.upload_file",
        new_callable=AsyncMock,
        return_value={
            "file_path": f"{proposal.organization_id}/proposals/{proposal.id}/file.pdf",
            "bucket": "production-files",
            "size_bytes": 9,
        },
    ), patch(
        "app.services.storage.storage_service.generate_signed_url",
        new_callable=AsyncMock,
        return_value="https://signed.example/pdf",
    ), patch(
        "sqlalchemy.orm.attributes.flag_modified",
        lambda *_args, **_kwargs: None,
    ):
        await service.generate_and_store(
            db=db,
            proposal=proposal,
            organization=organization,
            client=client,
            services=[],
        )

    mock_reserve.assert_awaited_once_with(
        db,
        organization,
        bytes_to_add=9,
    )


@pytest.mark.asyncio
async def test_generate_breakdown_from_ai_reserves_ai_credit():
    organization_id = uuid4()
    profile = SimpleNamespace(id=uuid4(), organization_id=organization_id)
    project = SimpleNamespace(id=uuid4())
    background_tasks = SimpleNamespace(add_task=lambda *args, **kwargs: None)
    db = AsyncMock()
    organization = SimpleNamespace(id=organization_id, plan_id=uuid4())

    with patch(
        "app.modules.commercial.service.project_service.get",
        new_callable=AsyncMock,
        return_value=project,
    ), patch.object(
        production_endpoint.production_service.scene_service,
        "get_multi",
        new_callable=AsyncMock,
        return_value=[],
    ), patch.object(
        production_endpoint.notification_service,
        "create_for_user",
        new_callable=AsyncMock,
    ), patch.object(
        production_endpoint,
        "get_organization_record",
        new_callable=AsyncMock,
        return_value=organization,
    ), patch.object(
        production_endpoint,
        "ensure_and_reserve_ai_credits",
        new_callable=AsyncMock,
    ) as mock_reserve:
        result = await production_endpoint.generate_breakdown_from_ai(
            project_id=project.id,
            background_tasks=background_tasks,
            organization_id=organization_id,
            profile=profile,
            db=db,
        )

    assert result["status"] == "processing"
    mock_reserve.assert_awaited_once_with(db, organization, credits_to_add=1)
