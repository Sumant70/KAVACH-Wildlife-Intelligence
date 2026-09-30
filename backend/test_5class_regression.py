import requests
import json
import glob
import os

print("=" * 65)
print("     5-CLASS REGRESSION TEST & NON-TARGET REJECTION TEST")
print("=" * 65)

# Test images for 5 target classes
test_cases = [
    ("Elephant", "backend/sample_images/elephant.jpg"),
    ("Tiger", "backend/sample_images/tiger.jpg"),
    ("Leopard", "backend/sample_images/leopard.jpg"),
    ("Wild Boar", "backend/sample_images/wild_boar.jpg"),
    ("Dog", "backend/sample_images/dog.jpg")
]

for species_name, img_path in test_cases:
    if os.path.exists(img_path):
        with open(img_path, "rb") as f:
            r = requests.post(
                "http://127.0.0.1:8000/api/detect/image",
                files={"file": (os.path.basename(img_path), f, "image/jpeg")},
                data={"confidence_threshold": "0.35"}
            )
        d = r.json()
        print(f"[{species_name:<10}] Detected: {str(d.get('detected')):<5} | Species: {str(d.get('species')):<12} | Conf: {str(d.get('confidence'))}%")
    else:
        print(f"[{species_name:<10}] File not found: {img_path}")

# Test non-target object (dummy blank meadow / noise)
import numpy as np
import cv2
blank_img = np.full((480, 640, 3), (120, 150, 120), dtype=np.uint8) # Blank meadow green
cv2.imwrite("backend/sample_images/non_target_meadow.jpg", blank_img)

with open("backend/sample_images/non_target_meadow.jpg", "rb") as f:
    r_blank = requests.post(
        "http://127.0.0.1:8000/api/detect/image",
        files={"file": ("meadow.jpg", f, "image/jpeg")},
        data={"confidence_threshold": "0.35"}
    )
d_blank = r_blank.json()
print(f"\n[Non-Target Meadow] Detected: {d_blank.get('detected')} | Species: {d_blank.get('species')} | Message: {d_blank.get('message')}")
assert d_blank.get("detected") == False, "Non-target must not be detected as wildlife"

print("\n>>> REGRESSION & NON-TARGET VERIFICATION COMPLETE <<<")
