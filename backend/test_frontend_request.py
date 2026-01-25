#!/usr/bin/env python3
"""Test the exact request format that frontend is sending."""

import asyncio
import sys
import json
import requests
from uuid import UUID

sys.path.insert(0, '.')

async def test_frontend_request():
    """Test the exact request that frontend is sending."""
    
    # This is the data that the frontend is sending (from console logs)
    test_data = {
        "name": "Richeti1",
        "description": "testeeee",
        "actor_name": "Fernando1",
        "project_id": "52fec1b4-6142-4b9e-ae09-252cf4ce3f9f"
    }
    
    print("Testing frontend request format:")
    print(json.dumps(test_data, indent=2))
    
    # Test the actual HTTP request
    try:
        # This simulates what the frontend is doing
        headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'  # This would be the actual token
        }
        
        response = requests.post(
            'http://localhost:8000/api/v1/characters/',
            json=test_data,
            headers=headers
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            print("✅ Frontend request works!")
        else:
            print(f"❌ Frontend request failed with status {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error making request: {e}")

if __name__ == "__main__":
    asyncio.run(test_frontend_request())