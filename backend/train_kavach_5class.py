import os
import sys
import time
import shutil
from pathlib import Path
from ultralytics import YOLO

BASE_DIR = Path(r"C:\Users\ASUS\Downloads\infinityHack-main\infinityHack-main\backend")
DATA_YAML = BASE_DIR / "kavach_5class_balanced" / "data.yaml"
BASE_MODEL = BASE_DIR / "best.pt"
RUNS_DIR = Path(r"D:\kavach_runs")
MODEL_EXPORT_DIR = BASE_DIR / "models"
MODEL_EXPORT_DIR.mkdir(parents=True, exist_ok=True)

TARGET_MODEL_NAME = "best_kavach_5class.pt"

def train_5class_model():
    print("=" * 70)
    print("        KAVACH 5-CLASS YOLO11 MODEL TRAINING & FINE-TUNING")
    print("=" * 70)
    print(f"Base Weights:            {BASE_MODEL}")
    print(f"Balanced Dataset:        {DATA_YAML}")
    print(f"Target Checkpoint:       {TARGET_MODEL_NAME}")
    print(f"5 Classes:               0: Elephant, 1: Tiger, 2: Leopard, 3: Wild Boar, 4: Dog")
    print("=" * 70)

    if not DATA_YAML.exists():
        raise FileNotFoundError(f"data.yaml not found at {DATA_YAML}")

    # Load YOLO model (will transfer backbone, neck, and adapt head from 4 to 5 classes)
    model = YOLO(str(BASE_MODEL))

    train_start = time.time()

    # Train for 5 epochs on balanced dataset with realistic wildlife/CCTV augmentations
    results = model.train(
        data=str(DATA_YAML),
        epochs=5,
        imgsz=384,
        batch=32,
        device="cpu",
        workers=6,
        project=str(RUNS_DIR),
        name="kavach_wildlife_5class",
        exist_ok=True,
        pretrained=True,
        patience=3,
        save=True,
        plots=True,
        val=True,
        verbose=True,
        # Realistic CCTV/wildlife augmentations
        fliplr=0.5,
        scale=0.25,
        translate=0.1,
        degrees=5.0,
        mosaic=0.4,
        hsv_h=0.015,
        hsv_s=0.5,
        hsv_v=0.4
    )

    total_time = time.time() - train_start
    print(f"\n[TRAINING] Completed in {total_time / 60:.2f} minutes!")

    # Locate best checkpoint
    save_dir = Path(results.save_dir) if hasattr(results, "save_dir") else (RUNS_DIR / "kavach_wildlife_5class")
    best_weights = save_dir / "weights" / "best.pt"
    if not best_weights.exists():
        best_weights = save_dir / "weights" / "last.pt"

    if best_weights.exists():
        print(f"Found trained weights at: {best_weights}")
        # Save separately as required: best_kavach_5class.pt
        dest1 = BASE_DIR / TARGET_MODEL_NAME
        dest2 = MODEL_EXPORT_DIR / TARGET_MODEL_NAME
        shutil.copy2(str(best_weights), str(dest1))
        shutil.copy2(str(best_weights), str(dest2))
        print(f"Saved separate 5-class model to:")
        print(f"  -> {dest1}")
        print(f"  -> {dest2}")

        # Verify class names in model
        m_eval = YOLO(str(dest1))
        print(f"Verified Model Native Classes: {m_eval.names}")
        assert len(m_eval.names) == 5, f"Expected 5 classes, got {len(m_eval.names)}"
        print("  >>> 5-CLASS MODEL VERIFICATION PASSED! <<<")
        return dest1
    else:
        raise FileNotFoundError(f"Could not find best.pt in {save_dir}")

if __name__ == "__main__":
    train_5class_model()
