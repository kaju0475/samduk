import os
os.environ["DB_FILENAME"] = "db.test.json"

import requests
import json

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_qr_login_functionality():
    url = f"{BASE_URL}/api/auth/qr-login"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    # Fix: add a required payload field 'qrCode' as string
    payload = {"qrCode": "dummy-qr-code"}

    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"

    try:
        data = response.json()
    except json.JSONDecodeError:
        assert False, "Response is not valid JSON"

    assert "token" in data or "user" in data, "Authentication not successful or token/user data missing"

test_qr_login_functionality()
