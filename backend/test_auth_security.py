


import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_unauthenticated_chat():
    print("\n--- Test 1: POST /api/chat without Authorization header ---")
    response = client.post(
        "/api/chat",
        data={"question": "What makes this suspicious?"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    assert "Missing Authorization header" in response.json()["detail"]
    print("PASS: Unauthenticated request correctly rejected with HTTP 401.")

def test_invalid_token_chat():
    print("\n--- Test 2: POST /api/chat with invalid Bearer token ---")
    response = client.post(
        "/api/chat",
        data={"question": "What makes this suspicious?"},
        headers={"Authorization": "Bearer invalid_fake_token_12345"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    assert "Invalid, expired, or revoked" in response.json()["detail"] or "Authentication failed" in response.json()["detail"]
    print("PASS: Invalid token correctly rejected with HTTP 401.")

def test_unauthenticated_me():
    print("\n--- Test 3: GET /api/auth/me without Authorization header ---")
    response = client.get("/api/auth/me")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("PASS: Unauthenticated profile request correctly rejected with HTTP 401.")

def test_invalid_token_me():
    print("\n--- Test 4: GET /api/auth/me with invalid Bearer token ---")
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer bad.token.here"}
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("PASS: Invalid token on profile correctly rejected with HTTP 401.")

if __name__ == "__main__":
    try:
        test_unauthenticated_chat()
        test_invalid_token_chat()
        test_unauthenticated_me()
        test_invalid_token_me()
        print("\n==========================================")
        print("ALL BACKEND AUTHENTICATION TESTS PASSED!")
        print("==========================================")
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nUNEXPECTED ERROR: {e}")
        sys.exit(1)
