import os
os.environ['DB_FILENAME'] = 'db.test.json'

import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_long_term_inventory_reporting():
    headers = {}
    try:
        response = requests.get(
            f"{BASE_URL}/api/system/reports/long-term",
            headers=headers,
            timeout=TIMEOUT
        )
        assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
        data = response.json()
        # Accept either dict or list, ensure non-empty
        assert isinstance(data, (dict, list)), "Report response should be a JSON object or array"
        if isinstance(data, dict):
            assert data, "Report JSON object should not be empty"
        else:
            assert len(data) > 0, "Report JSON array should not be empty"
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

test_long_term_inventory_reporting()
