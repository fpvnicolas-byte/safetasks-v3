#!/usr/bin/env python3
"""Test if the project exists and belongs to the organization."""

import asyncio
import sys
from uuid import UUID

sys.path.insert(0, '.')

from app.db.session import get_db
from app.services.production import character_service

async def test_project_exists():
    """Test if the project exists."""
    
    project_id = UUID("52fec1b4-6142-4b9e-ae09-252cf4ce3f9f")
    organization_id = UUID("4384a92c-df41-444b-b34d-6c80e7820486")
    
    print(f"Testing project {project_id} in organization {organization_id}")
    
    async for db in get_db():
        try:
            # Use the character service to validate project ownership
            # This will raise ValueError if project doesn't exist or doesn't belong to org
            await character_service._validate_project_ownership(
                db=db,
                organization_id=organization_id,
                project_id=project_id
            )
            
            print("✅ Project exists and belongs to organization")
                
        except Exception as e:
            print(f"❌ Error checking project: {e}")
        break

if __name__ == "__main__":
    asyncio.run(test_project_exists())