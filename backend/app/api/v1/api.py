from fastapi import APIRouter

from app.api.v1.endpoints import (
    organizations, clients, projects, bank_accounts, transactions,
    kits, call_sheets, proposals, storage, notifications, ai,
    scenes, characters, shooting_days, production, financial,
    suppliers, stakeholders, inventory, cloud, dashboard, profiles,
    ai_monitoring, services, project_assignments, billing, whatsapp
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(
    organizations.router,
    prefix="/organizations",
    tags=["organizations"]
)

api_router.include_router(
    clients.router,
    prefix="/clients",
    tags=["clients"]
)

api_router.include_router(
    projects.router,
    prefix="/projects",
    tags=["projects"]
)

api_router.include_router(
    bank_accounts.router,
    prefix="/bank-accounts",
    tags=["bank_accounts"]
)

api_router.include_router(
    transactions.router,
    prefix="/transactions",
    tags=["transactions"]
)

api_router.include_router(
    kits.router,
    prefix="/kits",
    tags=["kits"]
)

api_router.include_router(
    call_sheets.router,
    prefix="/call-sheets",
    tags=["call_sheets"]
)

api_router.include_router(
    proposals.router,
    prefix="/proposals",
    tags=["proposals"]
)

api_router.include_router(
    storage.router,
    prefix="/storage",
    tags=["storage"]
)

api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["notifications"]
)

api_router.include_router(
    ai.router,
    prefix="/ai",
    tags=["ai"]
)

api_router.include_router(
    scenes.router,
    prefix="/scenes",
    tags=["scenes"]
)

api_router.include_router(
    characters.router,
    prefix="/characters",
    tags=["characters"]
)

api_router.include_router(
    shooting_days.router,
    prefix="/shooting-days",
    tags=["shooting_days"]
)

api_router.include_router(
    production.router,
    prefix="/production",
    tags=["production"]
)

api_router.include_router(
    financial.router,
    prefix="/financial",
    tags=["financial"]
)

api_router.include_router(
    suppliers.router,
    prefix="/suppliers",
    tags=["suppliers"]
)

api_router.include_router(
    stakeholders.router,
    prefix="/stakeholders",
    tags=["stakeholders"]
)

api_router.include_router(
    inventory.router,
    prefix="/inventory",
    tags=["inventory"]
)

api_router.include_router(
    cloud.router,
    prefix="/cloud",
    tags=["cloud"]
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["dashboard"]
)

api_router.include_router(
    profiles.router,
    prefix="/profiles",
    tags=["profiles"]
)

# Include AI monitoring endpoints
api_router.include_router(
    ai_monitoring.router,
    prefix="/ai/monitoring",
    tags=["ai_monitoring"]
)

api_router.include_router(
    services.router,
    prefix="/services",
    tags=["services"]
)

api_router.include_router(
    project_assignments.router,
    prefix="/project-assignments",
    tags=["project_assignments"]
)

api_router.include_router(
    billing.router,
    prefix="/billing",
    tags=["billing"]
)

api_router.include_router(
    whatsapp.router,
    prefix="/whatsapp",
    tags=["whatsapp"]
)
