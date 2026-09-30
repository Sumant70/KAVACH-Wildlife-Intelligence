"""
KAVACH Wildlife Intelligence — Live Surveillance & 4-Camera Grid Test Suite
Verifies all 4-camera endpoints, YOLO11 inference, 3-frame confirmation,
and non-target rejection.
"""
import requests
import json
import os
import time

BASE_URL = "http://127.0.0.1:8000"

print("=" * 65)
print("     KAVACH LIVE SURVEILLANCE & 4-CAMERA GRID TEST SUITE")
print("=" * 65)

# TEST 1: GET /camera/status
print("\n[TEST 1] GET /camera/status ...")
r1 = requests.get(f"{BASE_URL}/camera/status")
assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
d1 = r1.json()
assert d1.get("success") is True
assert d1.get("system_status") == "ONLINE"
assert d1.get("ai_engine") == "ACTIVE"
assert len(d1.get("cameras", [])) == 4
print(f"  -> SUCCESS: Status ONLINE | Total Cameras: {d1.get('total_cameras')} | AI Engine: {d1.get('ai_engine')}")

# TEST 2: POST /camera/start (Single & All)
print("\n[TEST 2] POST /camera/start ...")
r2 = requests.post(f"{BASE_URL}/camera/start", json={"camera_id": "CAM-001"})
assert r2.status_code == 200
d2 = r2.json()
assert d2.get("success") is True
assert d2.get("active_cameras") >= 1
print(f"  -> SUCCESS: Camera CAM-001 started | Active cameras: {d2.get('active_cameras')}")

r2_all = requests.post(f"{BASE_URL}/camera/start", json={"all": True})
assert r2_all.status_code == 200
assert r2_all.json().get("active_cameras") == 4
print(f"  -> SUCCESS: START ALL active | Total: {r2_all.json().get('active_cameras')}/4")

# TEST 3: POST /camera/detect-frame with Tiger (Target Wildlife)
print("\n[TEST 3] POST /camera/detect-frame (Tiger Sighting) ...")
tiger_path = "backend/sample_images/tiger.jpg"
assert os.path.exists(tiger_path), f"File not found: {tiger_path}"

with open(tiger_path, "rb") as f:
    r3 = requests.post(
        f"{BASE_URL}/camera/detect-frame",
        files={"file": ("tiger.jpg", f, "image/jpeg")},
        data={"camera_id": "CAM-001", "confidence_threshold": "0.35"}
    )
assert r3.status_code == 200
d3 = r3.json()
assert d3.get("detected") is True, f"Expected detection, got: {d3}"
assert d3.get("species") == "Tiger", f"Expected Tiger, got: {d3.get('species')}"
assert d3.get("confidence") >= 35.0, f"Expected >= 35%, got: {d3.get('confidence')}"
assert "primary_bbox" in d3, "Expected primary_bbox in response"
print(f"  -> SUCCESS: Detected {d3.get('species')} ({d3.get('confidence')}%) | Risk: {d3.get('risk_level')} | BBox: {d3.get('primary_bbox')}")

# TEST 4: 3-Frame Temporal Confirmation Check
print("\n[TEST 4] 3-Frame Temporal Confirmation ...")
# Frame 2
with open(tiger_path, "rb") as f:
    r4_2 = requests.post(
        f"{BASE_URL}/camera/detect-frame",
        files={"file": ("tiger.jpg", f, "image/jpeg")},
        data={"camera_id": "CAM-001", "confidence_threshold": "0.35"}
    )
# Frame 3
with open(tiger_path, "rb") as f:
    r4_3 = requests.post(
        f"{BASE_URL}/camera/detect-frame",
        files={"file": ("tiger.jpg", f, "image/jpeg")},
        data={"camera_id": "CAM-001", "confidence_threshold": "0.35"}
    )
d4_3 = r4_3.json()
assert d4_3.get("is_confirmed") is True, f"Expected 3-frame confirmation to be True, got: {d4_3}"
assert d4_3.get("consecutive_count") >= 3, f"Expected >= 3 consecutive frames, got {d4_3.get('consecutive_count')}"
print(f"  -> SUCCESS: Consecutive Count: {d4_3.get('consecutive_count')} | Confirmed: {d4_3.get('is_confirmed')}")

# TEST 5: Non-Target Rejection Check (Non-Target Meadow)
print("\n[TEST 5] Non-Target Object Rejection ...")
meadow_path = "backend/sample_images/non_target_meadow.jpg"
with open(meadow_path, "rb") as f:
    r5 = requests.post(
        f"{BASE_URL}/camera/detect-frame",
        files={"file": ("meadow.jpg", f, "image/jpeg")},
        data={"camera_id": "CAM-002", "confidence_threshold": "0.35"}
    )
assert r5.status_code == 200
d5 = r5.json()
assert d5.get("detected") is False, "Non-target must not be detected"
assert d5.get("message") == "NO TARGET WILDLIFE DETECTED"
status_display = d5.get('status_text', '').encode('ascii', 'ignore').decode('ascii')
print(f"  -> SUCCESS: Non-target rejected | Message: '{d5.get('message')}' | Status: '{status_display}'")

# TEST 6: POST /camera/stop
print("\n[TEST 6] POST /camera/stop ...")
r6 = requests.post(f"{BASE_URL}/camera/stop", json={"all": True})
assert r6.status_code == 200
assert r6.json().get("active_cameras") == 0
print(f"  -> SUCCESS: STOP ALL executed | Active cameras: {r6.json().get('active_cameras')}/4")

# TEST 7: Image upload regression test
print("\n[TEST 7] Existing Image Upload Regression Check ...")
with open(tiger_path, "rb") as f:
    r7 = requests.post(
        f"{BASE_URL}/api/detect/image",
        files={"file": ("tiger.jpg", f, "image/jpeg")},
        data={"confidence_threshold": "0.35"}
    )
assert r7.status_code == 200
assert r7.json().get("detected") is True
print(f"  -> SUCCESS: Existing image upload intact | Detected: {r7.json().get('species')} ({r7.json().get('confidence')}%)")

print("\n" + "=" * 65)
print(">>> ALL 7 LIVE SURVEILLANCE TESTS PASSED WITH 100% COMPLIANCE <<<")
print("=" * 65)
