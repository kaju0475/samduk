import os
os.environ['DB_FILENAME'] = 'db.test.json'

import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30


def test_user_login_functionality():
    login_url = f"{BASE_URL}/api/auth/login"

    # Valid credentials for test - assuming these are valid for test DB
    # Replace with actual valid test credentials if known
    payload = {
        "username": "testuser",
        "password": "testpassword"
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        # Perform login request
        response = requests.post(login_url, json=payload, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Login request failed: {e}"

    # Assert HTTP 200 OK
    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    # Parse JSON response
    try:
        data = response.json()
    except Exception as e:
        assert False, f"Response is not valid JSON: {e}"

    # Validate presence of token/session info (common in login)
    assert 'token' in data or 'sessionId' in data or 'accessToken' in data, (
        "Login response does not contain a session token or access token")

    # Optionally check that token is non-empty string
    token = data.get('token') or data.get('sessionId') or data.get('accessToken')
    assert isinstance(token, str) and len(token) > 0, "Token/session id is empty or invalid"

    # Further test session management by attempting a logout or other authorized call could be done,
    # but not requested explicitly in this test case


test_user_login_functionality()