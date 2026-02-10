import os
os.environ["DB_FILENAME"] = "db.test.json"

import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def create_cylinder():
    url = f"{BASE_URL}/api/master/cylinders"
    cylinder_data = {
        "serialNumber": f"SN-{uuid.uuid4()}",
        "status": "AVAILABLE",
        "type": "TYPE_A",
        "location": "Warehouse 1"
    }
    resp = requests.post(url, json=cylinder_data, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def delete_cylinder(cylinder_id):
    url = f"{BASE_URL}/api/master/cylinders"
    update_data = {
        "id": cylinder_id,
        "status": "REMOVED"
    }
    resp = requests.put(url, json=update_data, timeout=TIMEOUT)
    resp.raise_for_status()

def create_customer():
    return f"test-customer-{uuid.uuid4()}"

def test_delivery_and_collection_processing():
    cylinder_ids = []
    customer_id = create_customer()
    try:
        for _ in range(2):
            cylinder = create_cylinder()
            cylinder_ids.append(cylinder["id"])

        delivery_url = f"{BASE_URL}/api/work/delivery"
        headers = {
            "Content-Type": "application/json"
        }

        delivery_payload = {
            "action": "DELIVERY",
            "cylinders": cylinder_ids,
            "customerId": customer_id
        }
        delivery_resp = requests.post(delivery_url, json=delivery_payload, headers=headers, timeout=TIMEOUT)
        assert delivery_resp.status_code == 200
        delivery_data = delivery_resp.json()
        assert isinstance(delivery_data, dict)
        assert "processed" in delivery_data and delivery_data["processed"] is True
        assert set(delivery_data.get("cylinders", [])) == set(cylinder_ids)
        assert delivery_data.get("customerId") == customer_id

        cylinders_url = f"{BASE_URL}/api/master/cylinders"
        list_resp = requests.get(cylinders_url, timeout=TIMEOUT)
        list_resp.raise_for_status()
        cylinders_list = list_resp.json()
        for c in cylinders_list:
            if c["id"] in cylinder_ids:
                assert c.get("status") in ["DELIVERED", "OUT_FOR_DELIVERY"]

        collection_payload = {
            "action": "COLLECTION",
            "cylinders": cylinder_ids,
            "customerId": customer_id
        }
        collection_resp = requests.post(delivery_url, json=collection_payload, headers=headers, timeout=TIMEOUT)
        assert collection_resp.status_code == 200
        collection_data = collection_resp.json()
        assert isinstance(collection_data, dict)
        assert "processed" in collection_data and collection_data["processed"] is True
        assert set(collection_data.get("cylinders", [])) == set(cylinder_ids)
        assert collection_data.get("customerId") == customer_id

        list_resp_after = requests.get(cylinders_url, timeout=TIMEOUT)
        list_resp_after.raise_for_status()
        cylinders_list_after = list_resp_after.json()
        for c in cylinders_list_after:
            if c["id"] in cylinder_ids:
                assert c.get("status") in ["AVAILABLE", "COLLECTED"]

    finally:
        for cid in cylinder_ids:
            try:
                delete_cylinder(cid)
            except Exception:
                pass

test_delivery_and_collection_processing()
