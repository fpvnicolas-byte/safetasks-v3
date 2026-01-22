# Commercial module schemas - inherits from base schemas
from app.schemas.organizations import Organization, OrganizationCreate, OrganizationUpdate
from app.schemas.clients import Client, ClientCreate, ClientUpdate
from app.schemas.projects import Project, ProjectCreate, ProjectUpdate, ProjectWithClient
from app.schemas.proposals import Proposal, ProposalCreate, ProposalUpdate, ProposalWithClient, ProposalApproval

# Re-export for convenience in the commercial module
__all__ = [
    "Organization", "OrganizationCreate", "OrganizationUpdate",
    "Client", "ClientCreate", "ClientUpdate",
    "Project", "ProjectCreate", "ProjectUpdate", "ProjectWithClient",
    "Proposal", "ProposalCreate", "ProposalUpdate", "ProposalWithClient", "ProposalApproval",
]
