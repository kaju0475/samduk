import os
os.environ["DB_FILENAME"] = "db.test.json"
import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
AUTH_TOKEN = ""  # Insert valid token if needed or set up a method to get it.

def test_cylinder_history_retrieval():
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}" if AUTH_TOKEN else "",
        "Content-Type": "application/json"
    }

    cylinder_id = None
    created_cylinder = None

    try:
        # Step 1: Create a cylinder to have history for
        create_payload = {
            "serial_number": "TC007-HIST-001",
            "type": "TypeA"
        }
        response = requests.post(
            f"{BASE_URL}/api/master/cylinders",
            json=create_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response.status_code in [200, 201], "Failed to create test cylinder"
        created_cylinder = response.json()
        cylinder_id = created_cylinder.get("id")
        assert cylinder_id, "Created cylinder response missing ID"

        # Step 2: Perform a charging START action to generate history
        charging_payload = {
            "action": "START",
            "cylinders": [cylinder_id]
        }
        charging_response = requests.post(
            f"{BASE_URL}/api/work/charging",
            json=charging_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert charging_response.status_code == 200, "Failed to start charging action"

        # Step 3: Perform a delivery action to generate more history
        delivery_payload = {
            "action": "DELIVERY",
            "cylinders": [cylinder_id],
            "customerId": "test-customer-001"
        }
        delivery_response = requests.post(
            f"{BASE_URL}/api/work/delivery",
            json=delivery_payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert delivery_response.status_code == 200, "Failed to process delivery action"

        # Step 4: Retrieve cylinder history
        params = {"cylinders": [cylinder_id]}  # Pass list for query parameter
        history_response = requests.get(
            f"{BASE_URL}/api/history/cylinder",
            headers=headers,
            params=params,
            timeout=TIMEOUT,
        )
        assert history_response.status_code == 200, "Failed to retrieve cylinder history"

        history_data = history_response.json()
        assert isinstance(history_data, list), "History response should be list"
        assert any(
            entry.get("cylinderId") == cylinder_id for entry in history_data
        ), "History does not contain entries for the test cylinder"

        # Additional sanity checks on history content
        actions = {entry.get("action") for entry in history_data}
        assert "START" in actions or "DELIVERY" in actions, "Expected history actions not found"

    finally:
        # Clean up - delete the created cylinder if possible
        if cylinder_id:
            try:
                requests.delete(
                    f"{BASE_URL}/api/master/cylinders",
                    headers=headers,
                    json={"id": cylinder_id},
                    timeout=TIMEOUT,
                )
            except Exception:
                pass

test_cylinder_history_retrieval()
