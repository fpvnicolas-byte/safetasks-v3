# Importa a classe Base do core
from app.core.base import Base

# Importa todos os modelos para que o Alembic e os testes os encontrem
# (Isso força o registro das tabelas no metadata)
from app.models import (
    Organization,
    Profile,
    Client,
    Project,
    BankAccount,
    Transaction,
    CallSheet,
    Kit,
    Proposal,
    StoredFile,
    Notification,
    GoogleDriveCredentials,
    CloudSyncStatus,
    ProjectDriveFolder,
    Plan,
    Entitlement,
    OrganizationUsage,
    BillingEvent,
    ProjectAssignment,
    Supplier,
    Scene,
    Character,
    ShootingDay,
    KitItem,
    MaintenanceLog,
    KitItemUsageLog,
    TaxTable,
    Invoice,
    OrganizationInvite,
)
