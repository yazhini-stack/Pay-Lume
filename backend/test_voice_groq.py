"""
Unit and integration tests for Groq Whisper Speech-to-Text service and API route.
All tests use mocked provider responses to ensure zero external API calls, zero quota consumption,
and zero requirement for real API keys during automated testing.
"""

import sys
import os
from unittest.mock import patch, AsyncMock, MagicMock
import httpx
from fastapi.testclient import TestClient

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.config import settings
from app.auth import AuthenticatedUser, get_current_user
from app.services.groq_service import groq_service, GroqService

client = TestClient(app)

# Test dummy user for bypassing external Supabase network verification in unit tests
mock_user = AuthenticatedUser(
    id="test-user-uuid-12345",
    email="tester@example.com",
    role="authenticated",
    user_metadata={"full_name": "Test User"}
)


def test_unauthenticated_transcribe_rejected():
    """Verify that POST /api/voice/transcribe rejects requests missing an Authorization header."""
    print("\n--- Test 1: Unauthenticated POST /api/voice/transcribe ---")
    files = {"file": ("audio.webm", b"dummy audio content", "audio/webm")}
    response = client.post("/api/voice/transcribe", files=files)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    assert "Missing Authorization header" in response.json()["detail"]
    print("PASS: Unauthenticated voice request correctly rejected with HTTP 401.")


def test_empty_audio_rejected():
    """Verify that uploading an empty audio file is rejected with HTTP 400."""
    print("\n--- Test 2: Empty audio file upload ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        files = {"file": ("empty.webm", b"", "audio/webm")}
        response = client.post(
            "/api/voice/transcribe",
            files=files,
            headers={"Authorization": "Bearer mock-token"}
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "empty" in response.json()["detail"].lower()
        print("PASS: Empty audio correctly rejected with HTTP 400.")
    finally:
        app.dependency_overrides.clear()


def test_oversized_audio_rejected():
    """Verify that uploading audio exceeding MAX_AUDIO_SIZE_BYTES (15 MB) is rejected with HTTP 400."""
    print("\n--- Test 3: Oversized audio file (> 15 MB) ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        # Create bytes just exceeding 15 MB limit
        oversized_bytes = b"x" * (settings.MAX_AUDIO_SIZE_BYTES + 1024)
        files = {"file": ("huge.webm", oversized_bytes, "audio/webm")}
        response = client.post(
            "/api/voice/transcribe",
            files=files,
            headers={"Authorization": "Bearer mock-token"}
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "maximum allowed size" in response.json()["detail"]
        print("PASS: Oversized audio correctly rejected with HTTP 400.")
    finally:
        app.dependency_overrides.clear()


def test_missing_groq_api_key():
    """Verify that missing GROQ_API_KEY fails safely with HTTP 503 Service Unavailable."""
    print("\n--- Test 4: Missing GROQ_API_KEY ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    original_key = settings.GROQ_API_KEY
    settings.GROQ_API_KEY = ""
    try:
        files = {"file": ("sample.webm", b"valid audio bytes here", "audio/webm")}
        response = client.post(
            "/api/voice/transcribe",
            files=files,
            headers={"Authorization": "Bearer mock-token"}
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 503, f"Expected 503, got {response.status_code}"
        assert "missing GROQ_API_KEY" in response.json()["detail"]
        print("PASS: Missing API key fails safely with HTTP 503.")
    finally:
        settings.GROQ_API_KEY = original_key
        app.dependency_overrides.clear()


def test_successful_transcription_with_groq():
    """Verify successful end-to-end transcription using mocked Groq response and whisper-large-v3-turbo."""
    print("\n--- Test 5: Successful transcription with whisper-large-v3-turbo ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    original_key = settings.GROQ_API_KEY
    settings.GROQ_API_KEY = "gsk_dummy_test_key_for_unit_tests"

    captured_requests = []

    def mock_post(url, *args, **kwargs):
        captured_requests.append({
            "url": url,
            "headers": kwargs.get("headers"),
            "data": kwargs.get("data"),
            "files": kwargs.get("files"),
        })
        # Simulate successful Groq Whisper JSON response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "text": "Is this electricity disconnection message a scam?"
        }
        return mock_resp

    try:
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_client_post:
            mock_client_post.side_effect = mock_post

            files = {"file": ("question.webm", b"sample voice bytes", "audio/webm")}
            response = client.post(
                "/api/voice/transcribe",
                files=files,
                headers={"Authorization": "Bearer mock-token"}
            )

            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")

            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            json_data = response.json()
            assert "text" in json_data, "Response missing 'text' field"
            assert json_data["text"] == "Is this electricity disconnection message a scam?"

            # Verify the request sent to Groq
            assert len(captured_requests) == 1
            req = captured_requests[0]
            assert req["url"] == "https://api.groq.com/openai/v1/audio/transcriptions"
            assert req["headers"]["Authorization"] == "Bearer gsk_dummy_test_key_for_unit_tests"
            assert req["data"]["model"] == "whisper-large-v3-turbo"
            assert req["data"]["response_format"] == "json"
            assert req["data"]["language"] == "en"

            print("PASS: Groq Whisper transcription returned exact expected format and used whisper-large-v3-turbo.")
    finally:
        settings.GROQ_API_KEY = original_key
        app.dependency_overrides.clear()


def test_groq_401_unauthorized():
    """Verify that Groq HTTP 401 is mapped to HTTP 502 with a sanitized error."""
    print("\n--- Test 6: Groq 401 Unauthorized handling ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    original_key = settings.GROQ_API_KEY
    settings.GROQ_API_KEY = "gsk_invalid_key"

    try:
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_client_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 401
            mock_resp.json.return_value = {"error": {"message": "Invalid API Key"}}
            mock_client_post.return_value = mock_resp

            files = {"file": ("audio.webm", b"voice bytes", "audio/webm")}
            response = client.post(
                "/api/voice/transcribe",
                files=files,
                headers={"Authorization": "Bearer mock-token"}
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            assert response.status_code == 502
            assert "unauthorized or invalid" in response.json()["detail"]
            print("PASS: Groq 401 correctly sanitized and mapped to HTTP 502.")
    finally:
        settings.GROQ_API_KEY = original_key
        app.dependency_overrides.clear()


def test_groq_429_rate_limit():
    """Verify that Groq HTTP 429 rate limit is mapped to HTTP 429 with sanitized detail."""
    print("\n--- Test 7: Groq 429 Rate Limit handling ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    original_key = settings.GROQ_API_KEY
    settings.GROQ_API_KEY = "gsk_valid_key"

    try:
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_client_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 429
            mock_resp.json.return_value = {"error": {"message": "Rate limit reached for model whisper-large-v3-turbo"}}
            mock_client_post.return_value = mock_resp

            files = {"file": ("audio.webm", b"voice bytes", "audio/webm")}
            response = client.post(
                "/api/voice/transcribe",
                files=files,
                headers={"Authorization": "Bearer mock-token"}
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            assert response.status_code == 429
            assert "rate limit exceeded" in response.json()["detail"]
            print("PASS: Groq 429 rate limit correctly mapped to HTTP 429.")
    finally:
        settings.GROQ_API_KEY = original_key
        app.dependency_overrides.clear()


def test_groq_400_invalid_audio():
    """Verify that Groq HTTP 400 (corrupt/unsupported audio) is mapped to HTTP 400."""
    print("\n--- Test 8: Groq 400 Bad Request handling ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    original_key = settings.GROQ_API_KEY
    settings.GROQ_API_KEY = "gsk_valid_key"

    try:
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_client_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 400
            mock_resp.json.return_value = {"error": {"message": "Could not decode audio file"}}
            mock_client_post.return_value = mock_resp

            files = {"file": ("corrupt.webm", b"not really an audio", "audio/webm")}
            response = client.post(
                "/api/voice/transcribe",
                files=files,
                headers={"Authorization": "Bearer mock-token"}
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            assert response.status_code == 400
            assert "Invalid audio format" in response.json()["detail"]
            print("PASS: Groq 400 bad audio correctly mapped to HTTP 400.")
    finally:
        settings.GROQ_API_KEY = original_key
        app.dependency_overrides.clear()


def test_groq_timeout_handling():
    """Verify that httpx.TimeoutException maps to HTTP 504 Gateway Timeout."""
    print("\n--- Test 9: Provider timeout handling ---")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    original_key = settings.GROQ_API_KEY
    settings.GROQ_API_KEY = "gsk_valid_key"

    try:
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_client_post:
            mock_client_post.side_effect = httpx.TimeoutException("Connection timed out")

            files = {"file": ("audio.webm", b"voice bytes", "audio/webm")}
            response = client.post(
                "/api/voice/transcribe",
                files=files,
                headers={"Authorization": "Bearer mock-token"}
            )
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            assert response.status_code == 504
            assert "timed out" in response.json()["detail"]
            print("PASS: Timeout correctly mapped to HTTP 504.")
    finally:
        settings.GROQ_API_KEY = original_key
        app.dependency_overrides.clear()


if __name__ == "__main__":
    try:
        test_unauthenticated_transcribe_rejected()
        test_empty_audio_rejected()
        test_oversized_audio_rejected()
        test_missing_groq_api_key()
        test_successful_transcription_with_groq()
        test_groq_401_unauthorized()
        test_groq_429_rate_limit()
        test_groq_400_invalid_audio()
        test_groq_timeout_handling()
        print("\n" + "=" * 50)
        print("ALL GROQ WHISPER STT TESTS PASSED SUCCESSFULLY!")
        print("=" * 50)
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nUNEXPECTED TEST ERROR: {e}")
        sys.exit(1)
