import os
os.environ["DB_FILENAME"] = "db.test.json"

import requests
import uuid

BASE_URL = "http://localhost:3000"
HEADERS = {
    "Content-Type": "application/json"
}
TIMEOUT = 30


def test_tc004_cylinder_creation_update_and_listing():
    """
    Verify that cylinders can be created, updated, and listed correctly using the /api/master/cylinders endpoint
    with proper data validation and no data loss.
    """
    created_cylinder_id = None
    try:
        # Step 1: Create a new cylinder
        create_payload = {
            "name": f"Test Cylinder {uuid.uuid4()}",
            "description": "Test description"
        }
        create_resp = requests.post(
            f"{BASE_URL}/api/master/cylinders",
            json=create_payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert create_resp.status_code == 201 or create_resp.status_code == 200, \
            f"Unexpected status code on create: {create_resp.status_code}"
        create_data = create_resp.json()
        assert "id" in create_data and create_data["id"], "Created cylinder has no ID"
        created_cylinder_id = create_data["id"]

        # Verify the returned data matches what was sent (except id)
        for key in create_payload:
            assert create_data.get(key) == create_payload[key], \
                f"Mismatch in created cylinder field {key}"

        # Step 2: Update the created cylinder with new data
        update_payload = {
            "id": created_cylinder_id,
            "name": create_payload["name"] + " Updated",
            "description": "Updated description"
        }
        update_resp = requests.put(
            f"{BASE_URL}/api/master/cylinders",
            json=update_payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert update_resp.status_code == 200, \
            f"Unexpected status code on update: {update_resp.status_code}"
        update_data = update_resp.json()
        # Validate updated fields match
        for key in update_payload:
            if key != "id":
                assert update_data.get(key) == update_payload[key], \
                    f"Mismatch in updated cylinder field {key}"

        # Step 3: List cylinders and verify the updated cylinder is present and correct
        list_resp = requests.get(
            f"{BASE_URL}/api/master/cylinders",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert list_resp.status_code == 200, f"Unexpected status code on list: {list_resp.status_code}"
        cylinders_list = list_resp.json()
        # We expect list to be a list/array
        assert isinstance(cylinders_list, list), "List response is not a list"

        # Find the updated cylinder in the list
        found = None
        for cyl in cylinders_list:
            if cyl.get("id") == created_cylinder_id:
                found = cyl
                break
        assert found is not None, "Updated cylinder not found in list"

        # Validate the data in the list matches the updated data
        for key in update_payload:
            if key != "id":
                assert found.get(key) == update_payload[key], \
                    f"Mismatch in listed cylinder field {key}"

    finally:
        if created_cylinder_id is not None:
            # Cleanup: delete the created cylinder
            # The PRD doesn't define a DELETE method, so we skip if not supported.
            # If DELETE supported:
            try:
                requests.delete(
                    f"{BASE_URL}/api/master/cylinders/{created_cylinder_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT,
                )
            except Exception:
                pass


test_tc004_cylinder_creation_update_and_listing()
