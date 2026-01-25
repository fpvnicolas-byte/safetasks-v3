#!/usr/bin/env python3
"""Debug the 422 error in character creation."""

import asyncio
import sys
import json
import requests
from uuid import UUID

sys.path.insert(0, '.')

async def debug_422_error():
    """Debug the 422 error by testing different data formats."""
    
    print("🔍 Debugging 422 Error in Character Creation")
    print("=" * 50)
    
    # Test data that should work (from console logs)
    test_data = {
        "name": "Richeti1",
        "description": "testeeee", 
        "actor_name": "Fernando1",
        "project_id": "52fec1b4-6142-4b9e-ae09-252cf4ce3f9f"
    }
    
    print("Test data from console logs:")
    print(json.dumps(test_data, indent=2))
    
    # Test 1: Send without authentication (should get 401)
    print("\n1. Testing without authentication...")
    try:
        response = requests.post(
            'http://localhost:8000/api/v1/characters/',
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: Test with mock token (should get 401 or 422)
    print("\n2. Testing with mock token...")
    try:
        response = requests.post(
            'http://localhost:8000/api/v1/characters/',
            json=test_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token'
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: Test with valid project ID format
    print("\n3. Testing with different project ID formats...")
    
    # Test with UUID object
    try:
        test_data_uuid = {
            "name": "Test UUID",
            "description": "Test description",
            "actor_name": "Test Actor",
            "project_id": UUID("52fec1b4-6142-4b9e-ae09-252cf4ce3f9f")
        }
        response = requests.post(
            'http://localhost:8000/api/v1/characters/',
            json=test_data_uuid,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token'
            }
        )
        print(f"UUID format - Status: {response.status_code}")
        print(f"UUID format - Response: {response.text}")
    except Exception as e:
        print(f"UUID format - Error: {e}")
    
    # Test 4: Test with minimal required data
    print("\n4. Testing with minimal required data...")
    minimal_data = {
        "name": "Minimal",
        "description": "Minimal test",
        "project_id": "52fec1b4-6142-4b9e-ae09-252cf4ce3f9f"
    }
    
    try:
        response = requests.post(
            'http://localhost:8000/api/v1/characters/',
            json=minimal_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token'
            }
        )
        print(f"Minimal data - Status: {response.status_code}")
        print(f"Minimal data - Response: {response.text}")
    except Exception as e:
        print(f"Minimal data - Error: {e}")
    
    print("\n" + "=" * 50)
    print("💡 ANALYSIS:")
    print("The 422 error means the data format is invalid.")
    print("Possible causes:")
    print("1. Project ID format issue")
    print("2. Field validation (description too short?)")
    print("3. Missing required fields")
    print("4. Data type mismatch")
    print("\nNext step: Check backend validation logs")

if __name__ == "__main__":
    asyncio.run(debug_422_error())