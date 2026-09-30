import os
import sys
import time
import shutil
from pathlib import Path
from ultralytics import YOLO

BASE_DIR = Path(r"C:\Users\ASUS\Downloads\infinityHack-main\infinityHack-main\backend")
DATA_YAML = BASE_DIR / "kavach_5class_balanced" / "data.yaml"
CHECKPOINT = Path(r"D:\kavach_runs\kavach_wildlife_5class\weights\last.pt")
if not CHECKPOINT.exists():
    CHECKPOINT = Path(r"D:\kavach_runs\kavach_wildlife_5class\weights\best.pt")

RUNS_DIR = Path(r"D:\kavach_runs")
MODEL_EXPORT_DIR = BASE_DIR / "models"
MODEL_EXPORT_DIR.mkdir(parents=True, exist_ok=True)

TARGET_MODEL_NAME = "best_kavach_5class.pt"

def resume_or_finetune():
    print("=" * 70)
    print("        FINE-TUNING KAVACH 5-CLASS YOLO11 MODEL (EPOCHS 2-3)")
    print("=" * 70)
    print(f"Checkpoint:       {CHECKPOINT}")
    print(f"Data:             {DATA_YAML}")
    print(f"Batch size:       12 (safe for ~3GB RAM)")
    print(f"Workers:          0 (in-process, zero OOM risk)")
    print("=" * 70)

    model = YOLO(str(CHECKPOINT))
    
    t0 = time.time()
    results = model.train(
        data=str(DATA_YAML),
        epochs=3,
        imgsz=384,
        batch=12,
        device="cpu",
        workers=0,
        project=str(RUNS_DIR),
        name="kavach_wildlife_5class_ft",
        exist_ok=True,
        save=True,
        val=True,
        verbose=True,
        lr0=0.003, # Good fine-tuning rate
        lrf=0.01,
        # Realistic CCTV/wildlife augmentations
        fliplr=0.5,
        scale=0.2,
        translate=0.08,
        degrees=4.0,
        hsv_h=0.015,
        hsv_s=0.4,
        hsv_v=0.3
    )

    elapsed = time.time() - t0
    print(f"\n[FINE-TUNING] Completed in {elapsed / 60:.2f} minutes!")

    save_dir = Path(results.save_dir) if hasattr(results, "save_dir") else (RUNS_DIR / "kavach_wildlife_5class_ft")
    best_w = save_dir / "weights" / "best.pt"
    if not best_w.exists():
        best_w = save_dir / "weights" / "last.pt"

    if best_w.exists():
        dest1 = BASE_DIR / TARGET_MODEL_NAME
        dest2 = MODEL_EXPORT_DIR / TARGET_MODEL_NAME
        shutil.copy2(str(best_w), str(dest1))
        shutil.copy2(str(best_w), str(dest2))
        print(f"Updated 5-class model:")
        print(f"  -> {dest1}")
        print(f"  -> {dest2}")
        return dest1
    else:
        print("Warning: best_w not found, keeping previous best.pt")

if __name__ == "__main__":
    resume_or_finetune()
