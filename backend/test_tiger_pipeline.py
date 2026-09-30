import requests
import json
import glob
import os

print("=" * 60)
print("     KAVACH TIGER DETECTION PIPELINE VERIFICATION")
print("=" * 60)

# 1. Model status check
r_status = requests.get("http://127.0.0.1:8000/api/model/status")
mod = r_status.json()["model"]
print(f"MODEL: {mod['status']}")
print(f"MODEL CLASSES: {mod['native_classes']}")
print(f"SUPPORTED COUNT: {mod['supported_count']}")

# 2. Control Tiger Image
print("\n--- TEST CONTROL IMAGE (sample_images/tiger.jpg) ---")
with open("backend/sample_images/tiger.jpg", "rb") as f:
    r = requests.post(
        "http://127.0.0.1:8000/api/detect/image",
        files={"file": ("tiger.jpg", f, "image/jpeg")},
        data={"confidence_threshold": "0.35"}
    )
res = r.json()
print("HTTP Status:        ", r.status_code)
print("Detected:           ", res.get("detected"))
print("Species:            ", res.get("species"))
print("Confidence:         ", res.get("confidence"))
print("BBox:               ", res.get("bbox"))
print("Risk Level:         ", res.get("risk", {}).get("risk_level"))
print("Risk Score:         ", res.get("risk", {}).get("risk_score"))

# 3. Tiger Crop Image at Thresholds
print("\n--- TEST USER UPLOADED BENGAL TIGER AT MULTIPLE THRESHOLDS ---")
crop_files = glob.glob("backend/uploads/*Bengal_tiger*.jpg*")
if crop_files:
    target = crop_files[0]
    for th in [0.20, 0.25, 0.30, 0.35, 0.40, 0.50]:
        with open(target, "rb") as f:
            r = requests.post(
                "http://127.0.0.1:8000/api/detect/image",
                files={"file": ("crop.jpg", f, "image/jpeg")},
                data={"confidence_threshold": str(th)}
            )
        d = r.json()
        det = d.get("detected")
        sp = d.get("species")
        cf = d.get("confidence")
        status_str = "ACCEPTED" if det else "REJECTED"
        print(f"Threshold: {th:.2f} -> {status_str} | Detected: {det} | Species: {sp} | Conf: {cf}")

# 4. Live Camera Frame Endpoint
print("\n--- TEST LIVE-FRAME ENDPOINT (sample_images/tiger.jpg) ---")
with open("backend/sample_images/tiger.jpg", "rb") as f:
    r = requests.post(
        "http://127.0.0.1:8000/api/detect/live-frame",
        files={"file": ("live.jpg", f, "image/jpeg")},
        data={"confidence_threshold": "0.35"}
    )
d = r.json()
print("Live-Frame Detected:", d.get("detected"))
print("Live-Frame Species: ", d.get("species"))
print("Live-Frame Conf:    ", d.get("confidence"))

# 5. Temporal Multi-Frame Confirmation Tracker Test
print("\n--- TEST TEMPORAL CONFIRMATION TRACKER ---")
from temporal_safety import get_stream_tracker
tracker = get_stream_tracker("test-tiger-cam", required_consecutive=3, conf_floor=0.30)
tracker.reset()

f1 = tracker.update("Tiger", confidence=0.38)
print(f"Frame 1: Tiger 0.38 -> Status: {f1['status']}, Confirmed: {f1['is_confirmed']}")

f2 = tracker.update("Tiger", confidence=0.42)
print(f"Frame 2: Tiger 0.42 -> Status: {f2['status']}, Confirmed: {f2['is_confirmed']}")

f3 = tracker.update("Tiger", confidence=0.45)
print(f"Frame 3: Tiger 0.45 -> Status: {f3['status']}, Confirmed: {f3['is_confirmed']}")
assert f3["is_confirmed"] == True, "Expected Tiger to be CONFIRMED after 3 consecutive frames"
print(">>> TIGER MULTI-FRAME CONFIRMATION PASSED! <<<")

print("\n" + "=" * 60)
