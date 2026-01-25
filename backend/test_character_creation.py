#!/usr/bin/env python3
"""Test actual character creation to see the exact error."""

import asyncio
import sys
import json
from uuid import UUID

sys.path.insert(0, '.')

from app.db.session import get_db
from app.schemas.production import CharacterCreate
from app.services.production import character_service

async def test_character_creation():
    """Test actual character creation to see the exact error."""
    
    # Test data that should work
    test_data = {
        "name": "Richeti1",
        "description": "testeeee", 
        "actor_name": "Fernando1",
        "project_id": "52fec1b4-6142-4b9e-ae09-252cf4ce3f9f"
    }
    
    print("Testing character creation with data:")
    print(json.dumps(test_data, indent=2))
    
    # Validate against Pydantic schema
    try:
        character_create = CharacterCreate(**test_data)
        print("✅ Pydantic validation passed")
        print(f"✅ CharacterCreate object: {character_create}")
    except Exception as e:
        print(f"❌ Pydantic validation failed: {e}")
        return
    
    # Test with database
    async for db in get_db():
        try:
            print("Attempting character creation...")
            character = await character_service.create(
                db=db,
                organization_id=UUID("4384a92c-df41-444b-b34d-6c80e7820486"),
                obj_in=character_create
            )
            print(f"✅ Character created successfully: {character}")
        except Exception as e:
            print(f"❌ Character creation failed: {e}")
            print(f"❌ Error type: {type(e)}")
            print(f"❌ Error args: {e.args}")
        break

if __name__ == "__main__":
    asyncio.run(test_character_creation())