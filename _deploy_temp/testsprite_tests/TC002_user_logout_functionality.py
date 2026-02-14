import os
os.environ["DB_FILENAME"] = "db.test.json"

import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_user_logout_functionality():
    login_url = f"{BASE_URL}/api/auth/login"
    logout_url = f"{BASE_URL}/api/auth/logout"

    # Sample valid credentials (adjust if needed)
    credentials = {
        "username": "testuser",
        "password": "testpass"
    }

    session = requests.Session()

    # Attempt login to create a session or token for logout
    try:
        login_resp = session.post(login_url, json=credentials, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status code {login_resp.status_code}"
        # Usually logout requires auth token or cookies, using session should handle cookies if any

        # Logout request
        logout_resp = session.post(logout_url, timeout=TIMEOUT)
        assert logout_resp.status_code == 200, f"Logout failed with status code {logout_resp.status_code}"

        # Validate session terminated: attempt accessing a protected resource or logout again should fail
        # Here we try another logout which should fail or unauthorized
        logout_resp_2 = session.post(logout_url, timeout=TIMEOUT)
        assert logout_resp_2.status_code in (401, 403), "Session was not properly terminated after logout"
    finally:
        session.close()

test_user_logout_functionality()