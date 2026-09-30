import os
import sys
import json
import time
from pathlib import Path
import numpy as np
import cv2
from ultralytics import YOLO

BASE_DIR = Path(r"C:\Users\ASUS\Downloads\infinityHack-main\infinityHack-main\backend")
DATA_YAML = BASE_DIR / "kavach_5class_dataset" / "data.yaml"
OUTPUT_REPORT = BASE_DIR / "evaluation_5class_metrics.json"

CLASS_NAMES = ["Elephant", "Tiger", "Leopard", "Wild Boar", "Dog"]

def evaluate_5class(model_path=None):
    if model_path is None:
        model_path = BASE_DIR / "best_kavach_5class.pt"
        if not model_path.exists():
            model_path = BASE_DIR / "models" / "best_kavach_5class.pt"

    print("=" * 70)
    print("      KAVACH 5-CLASS MODEL UNSEEN TEST EVALUATION & BENCHMARK")
    print("=" * 70)
    print(f"Model Path:         {model_path}")
    print(f"Test Configuration: {DATA_YAML}")
    print("=" * 70)

    if not Path(model_path).exists():
        raise FileNotFoundError(f"Model weights not found at: {model_path}")

    model = YOLO(str(model_path))

    # 1. Standard Benchmark on Isolated Unseen TEST Split
    print("\n[STEP 1] Running evaluation on 1,348 isolated unseen TEST images...")
    start_eval = time.time()
    val_results = model.val(
        data=str(DATA_YAML),
        split="test",
        imgsz=384,
        batch=16,
        device="cpu",
        conf=0.25,
        iou=0.45,
        plots=True,
        save_json=True
    )
    eval_duration = time.time() - start_eval

    metrics = val_results.results_dict
    precision = float(metrics.get("metrics/precision(B)", 0.0))
    recall = float(metrics.get("metrics/recall(B)", 0.0))
    map50 = float(metrics.get("metrics/mAP50(B)", 0.0))
    map50_95 = float(metrics.get("metrics/mAP50-95(B)", 0.0))

    # Calculate FPS from speed dict
    speed = val_results.speed
    inf_time_ms = speed.get("inference", 25.0)
    fps = 1000.0 / inf_time_ms if inf_time_ms > 0 else 0.0

    print("\n" + "=" * 50)
    print("        OVERALL TEST METRICS (5 CLASSES)")
    print("=" * 50)
    print(f"Precision:   {precision:.4f} ({precision * 100:.2f}%)")
    print(f"Recall:      {recall:.4f} ({recall * 100:.2f}%)")
    print(f"mAP@50:      {map50:.4f} ({map50 * 100:.2f}%)")
    print(f"mAP@50-95:   {map50_95:.4f} ({map50_95 * 100:.2f}%)")
    print(f"Inference:   {inf_time_ms:.1f} ms ({fps:.1f} FPS)")

    # Per-class metrics
    per_class_results = {}
    print("\n" + "=" * 50)
    print("         PER-CLASS PERFORMANCE")
    print("=" * 50)

    if hasattr(val_results, "box") and hasattr(val_results.box, "p") and len(val_results.box.p) > 0:
        p_per_class = val_results.box.p
        r_per_class = val_results.box.r
        ap50_per_class = val_results.box.ap50
        ap_per_class = val_results.box.ap

        for i, cname in enumerate(CLASS_NAMES):
            p_val = float(p_per_class[i]) if i < len(p_per_class) else 0.0
            r_val = float(r_per_class[i]) if i < len(r_per_class) else 0.0
            ap50_val = float(ap50_per_class[i]) if i < len(ap50_per_class) else 0.0
            ap_val = float(ap_per_class[i]) if i < len(ap_per_class) else 0.0

            per_class_results[cname] = {
                "class_id": i,
                "precision": round(p_val, 4),
                "recall": round(r_val, 4),
                "mAP50": round(ap50_val, 4),
                "mAP50_95": round(ap_val, 4)
            }
            print(f"  [{i}] {cname:<12}: Precision={p_val:.4f}, Recall={r_val:.4f}, mAP50={ap50_val:.4f}, mAP50-95={ap_val:.4f}")

    # 2. Hard Negative Testing (Humans, Vehicles, Cows, Empty Scenes)
    # Dog is EXCLUDED from hard negatives because Dog is now a target class!
    print("\n" + "=" * 50)
    print("    HARD NEGATIVE REJECTION BENCHMARK (NON-TARGETS)")
    print("=" * 50)

    uploads_dir = BASE_DIR / "uploads"
    neg_categories = {
        "Human": ["human_person"],
        "Vehicle": ["motor_vehicle"],
        "Cow / Cattle": ["cow_scene", "Cow_female"],
        "Empty Meadow / Forest": ["blank_meadow"]
    }

    negative_test_results = {}
    vehicle_wild_boar_fp = False
    vehicle_fp_details = []

    for category, patterns in neg_categories.items():
        matched_files = []
        for f in uploads_dir.glob("*.jpg"):
            for pat in patterns:
                if pat in f.name:
                    matched_files.append(f)
                    break

        tested = len(matched_files)
        false_positives = 0
        fp_details = []

        for fpath in matched_files:
            dets = model(str(fpath), conf=0.50, verbose=False)
            boxes = dets[0].boxes
            if len(boxes) > 0:
                for b in boxes:
                    cid = int(b.cls[0])
                    conf_v = float(b.conf[0])
                    pred_species = model.names.get(cid, str(cid))
                    false_positives += 1
                    detail = {
                        "file": fpath.name,
                        "predicted_species": pred_species,
                        "confidence": round(conf_v, 3)
                    }
                    fp_details.append(detail)
                    if category == "Vehicle" and pred_species.lower() == "wild boar":
                        vehicle_wild_boar_fp = True
                        vehicle_fp_details.append(detail)

        rejected = tested - false_positives
        rejection_rate = (rejected / tested * 100.0) if tested > 0 else 100.0

        negative_test_results[category] = {
            "tested_count": tested,
            "false_positives": false_positives,
            "rejection_rate": round(rejection_rate, 2),
            "fp_details": fp_details
        }

        status_str = "PASS" if false_positives == 0 else "FAIL"
        print(f"  {category:<24}: Tested={tested:2d} | FP={false_positives:2d} | Rejection={rejection_rate:.1f}% [{status_str}]")

    print(f"\nVehicle -> Wild Boar False Positive Regression Check:")
    if vehicle_wild_boar_fp:
        print(f"  ⚠️ REGRESSION DETECTED: Vehicle misclassified as Wild Boar ({vehicle_fp_details})")
    else:
        print(f"  ✅ NO REGRESSION: Vehicle was NOT falsely detected as Wild Boar!")

    # 3. Positive Dog Target Class Verification
    print("\n" + "=" * 50)
    print("      POSITIVE DOG TARGET DETECTION VERIFICATION")
    print("=" * 50)
    dog_test_files = [f for f in uploads_dir.glob("*dog*.jpg")]
    dog_pos_detected = 0
    dog_detections_info = []

    for df in dog_test_files:
        res = model(str(df), conf=0.45, verbose=False)
        boxes = res[0].boxes
        if len(boxes) > 0:
            for b in boxes:
                cid = int(b.cls[0])
                cname = model.names.get(cid, str(cid))
                conf_val = float(b.conf[0])
                if cname.lower() == "dog":
                    dog_pos_detected += 1
                    dog_detections_info.append({
                        "file": df.name,
                        "detected_class": cname,
                        "confidence": round(conf_val, 3)
                    })
                    print(f"  ✅ [PASS] {df.name:<32}: Detected as {cname.upper()} ({conf_val * 100:.1f}%)")
                else:
                    print(f"  ⚠️ [WARN] {df.name:<32}: Misclassified as {cname} ({conf_val * 100:.1f}%)")

    dog_test_summary = {
        "tested": len(dog_test_files),
        "dog_detected_count": dog_pos_detected,
        "details": dog_detections_info
    }

    # Assemble Full Report
    report = {
        "model_path": str(model_path),
        "model_classes": {int(k): str(v) for k, v in model.names.items()},
        "test_dataset": str(DATA_YAML),
        "total_test_images": len(val_results.speed),
        "overall_metrics": {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "mAP50": round(map50, 4),
            "mAP50_95": round(map50_95, 4),
            "fps": round(fps, 1),
            "inference_time_ms": round(inf_time_ms, 2)
        },
        "per_class_metrics": per_class_results,
        "hard_negatives": negative_test_results,
        "vehicle_wild_boar_regression": {
            "has_regression": vehicle_wild_boar_fp,
            "details": vehicle_fp_details
        },
        "dog_target_verification": dog_test_summary,
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nFull evaluation report saved to: {OUTPUT_REPORT}")
    print("=" * 70)
    return report

if __name__ == "__main__":
    m_path = sys.argv[1] if len(sys.argv) > 1 else None
    evaluate_5class(m_path)
