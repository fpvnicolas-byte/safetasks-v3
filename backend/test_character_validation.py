#!/usr/bin/env python3
"""Test character creation validation to see exact error."""

import asyncio
import sys
import json
from uuid import UUID

sys.path.insert(0, '.')

from app.schemas.production import CharacterCreate

async def test_character_validation():
    """Test character creation to see validation errors."""
    
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

if __name__ == "__main__":
    asyncio.run(test_character_validation())