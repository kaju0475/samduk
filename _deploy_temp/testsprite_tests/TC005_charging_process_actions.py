import os
os.environ["DB_FILENAME"] = "db.test.json"

import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

# Assuming a token based auth but no credentials were provided, so no auth header is used here.
# If auth token was provided, add headers={"Authorization": "Bearer <token>"}

def test_charging_process_actions():
    headers = {"Content-Type": "application/json"}

    # Step 1: Create a new cylinder to use for charging actions
    cylinder_payload = {
        "serialNumber": "SN-" + str(uuid.uuid4()),
        "gasType": "Type-A",
        "status": "READY"
    }
    try:
        create_resp = requests.post(
            f"{BASE_URL}/api/master/cylinders",
            json=cylinder_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert create_resp.status_code == 200 or create_resp.status_code == 201, f"Create cylinder failed: {create_resp.text}"
        created_cylinder = create_resp.json()
        serial_number = created_cylinder.get("serialNumber")
        assert serial_number, "Created cylinder has no serialNumber"

        # Step 2: START charging action
        start_payload = {
            "action": "START",
            "cylinders": [serial_number]
        }
        start_resp = requests.post(
            f"{BASE_URL}/api/work/charging",
            json=start_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert start_resp.status_code == 200, f"START charging action failed: {start_resp.text}"

        # Verify status updated to 'CHARGING' or equivalent
        get_cyl_resp = requests.get(
            f"{BASE_URL}/api/master/cylinders",
            headers=headers,
            timeout=TIMEOUT
        )
        assert get_cyl_resp.status_code == 200, f"Failed to list cylinders after START charging: {get_cyl_resp.text}"
        cylinders = get_cyl_resp.json()
        matching = [c for c in cylinders if c.get("serialNumber") == serial_number]
        assert matching, "Cylinder not found after START charging"
        status_after_start = matching[0].get("status")
        assert status_after_start in ["CHARGING", "STARTED"], f"Unexpected status after START charging: {status_after_start}"

        # Step 3: COMPLETE charging action
        complete_payload = {
            "action": "COMPLETE",
            "cylinders": [serial_number]
        }
        complete_resp = requests.post(
            f"{BASE_URL}/api/work/charging",
            json=complete_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert complete_resp.status_code == 200, f"COMPLETE charging action failed: {complete_resp.text}"

        # Verify status updated to 'CHARGED' or equivalent
        get_cyl_resp2 = requests.get(
            f"{BASE_URL}/api/master/cylinders",
            headers=headers,
            timeout=TIMEOUT
        )
        assert get_cyl_resp2.status_code == 200, f"Failed to list cylinders after COMPLETE charging: {get_cyl_resp2.text}"
        cylinders2 = get_cyl_resp2.json()
        matching2 = [c for c in cylinders2 if c.get("serialNumber") == serial_number]
        assert matching2, "Cylinder not found after COMPLETE charging"
        status_after_complete = matching2[0].get("status")
        assert status_after_complete in ["CHARGED", "COMPLETE", "READY"], f"Unexpected status after COMPLETE charging: {status_after_complete}"

    finally:
        # Clean up - delete the created cylinder
        if 'serial_number' in locals():
            requests.put(
                f"{BASE_URL}/api/master/cylinders",
                json={"serialNumber": serial_number, "deleted": True},
                headers=headers,
                timeout=TIMEOUT
            )

test_charging_process_actions()
