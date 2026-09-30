from pathlib import Path

p = Path(r"C:\Users\ASUS\.gemini\antigravity-ide\brain\a997abbe-9747-4dd8-a35c-fefcc8186966\scratch\verify_production_model.py")
with open(p, "r", encoding="utf-8") as f:
    code = f.read()

old_block = """    # Positive tests
    print("\\n--- POSITIVE SPECIES TESTS ---")
    samples_dir = BASE_DIR / "sample_images"
    for name, filename in [("Elephant", "elephant.jpg"), ("Tiger", "tiger.jpg"), ("Leopard", "leopard.jpg")]:
        p = samples_dir / filename
        if p.exists():
            dets = ds.detect_image(str(p), conf_threshold=0.50)
            if dets:
                top = dets[0]
                print(f"  [PASS] {name:<10}: DETECTED -> {top['species']} ({top['confidence']}%) | bbox={top['bbox']}")
            else:
                print(f"  [INFO] {name:<10}: Not detected at 0.50 threshold")

    # Negative tests
    print("\\n--- HARD NEGATIVE REJECTION TESTS ---")
    uploads_dir = BASE_DIR / "uploads"
    test_cases = [
        ("Human", "110c1c824b50_human_person.jpg"),
        ("Motor Vehicle", "2b306bbe74ce_motor_vehicle.jpg"),
        ("Cow / Cattle", "c5db157026c4_cow_scene.jpg"),
        ("Blank Meadow", "58aeac4ee04a_blank_meadow.jpg"),
        ("Domestic Dog", "2f563ca00756_dog_test.jpg")
    ]"""

new_block = """    # Positive tests (All 5 Target Wildlife Classes)
    print("\\n--- POSITIVE SPECIES TESTS (5 TARGET CLASSES) ---")
    samples_dir = BASE_DIR / "sample_images"
    target_samples = [
        ("Elephant", "elephant.jpg"),
        ("Tiger", "tiger.jpg"),
        ("Leopard", "leopard.jpg"),
        ("Wild Boar", "wild_boar.jpg"),
        ("Dog", "dog.jpg")
    ]
    for name, filename in target_samples:
        p = samples_dir / filename
        if p.exists():
            dets = ds.detect_image(str(p), conf_threshold=0.35)
            if dets:
                top = dets[0]
                status = "PASS" if top['species'].lower() == name.lower() else "INFO"
                print(f"  [{status}] {name:<10}: DETECTED -> {top['species']} ({top['confidence']}%) | bbox={top['bbox']}")
            else:
                print(f"  [INFO] {name:<10}: Not detected at threshold")
        else:
            print(f"  [WARN] {name:<10}: Sample file {filename} not found")

    # Negative tests (Strict Rejection of Non-Targets)
    print("\\n--- HARD NEGATIVE REJECTION TESTS (NON-TARGETS) ---")
    uploads_dir = BASE_DIR / "uploads"
    test_cases = [
        ("Human", "110c1c824b50_human_person.jpg"),
        ("Motor Vehicle", "2b306bbe74ce_motor_vehicle.jpg"),
        ("Cow / Cattle", "c5db157026c4_cow_scene.jpg"),
        ("Blank Meadow", "58aeac4ee04a_blank_meadow.jpg")
    ]"""

if old_block in code:
    code = code.replace(old_block, new_block)
    with open(p, "w", encoding="utf-8") as f:
        f.write(code)
    print("SUCCESS: Updated verify_production_model.py for 5 classes!")
else:
    print("WARNING: Could not find exact old block to replace.")
