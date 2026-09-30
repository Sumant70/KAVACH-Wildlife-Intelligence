import os
import sys
import shutil
import random
from pathlib import Path
from collections import defaultdict, Counter

BASE_DIR = Path(r"C:\Users\ASUS\Downloads\infinityHack-main\infinityHack-main\backend")
SRC_CLEANED_DIR = BASE_DIR / "kavach_cleaned_dataset"
DOG_V1_DIR = Path(r"C:\Users\ASUS\Downloads\Dog.v1i.yolov8")
KAVACH_RAW_DATASET_DIR = BASE_DIR / "kavach_dataset"
DEST_5CLASS_DIR = BASE_DIR / "kavach_5class_dataset"

CLASS_NAMES = ["Elephant", "Tiger", "Leopard", "Wild Boar", "Dog"]

def build_5class_dataset():
    print("=" * 70)
    print("      KAVACH 5-CLASS DATASET COMPILATION & LEAKAGE ISOLATION")
    print("=" * 70)
    print(f"Source 4-Class Dataset: {SRC_CLEANED_DIR}")
    print(f"Dog Dataset Source:     {DOG_V1_DIR}")
    print(f"Target 5-Class Dataset: {DEST_5CLASS_DIR}")
    print("=" * 70)

    # 1. Create target directories
    for split in ["train", "val", "test"]:
        (DEST_5CLASS_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (DEST_5CLASS_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)

    # 2. Copy existing 4-class images & labels from kavach_cleaned_dataset
    # BUT EXCLUDE any old 'neg_*dog*' files that previously had empty labels!
    split_counts = {"train": 0, "val": 0, "test": 0}
    box_counts = {"train": Counter(), "val": Counter(), "test": Counter()}
    excluded_old_dog_negs = 0

    print("\n[STEP 1] Transferring original 4 wildlife classes and non-dog hard negatives...")
    for split in ["train", "val", "test"]:
        src_img_dir = SRC_CLEANED_DIR / "images" / split
        src_lbl_dir = SRC_CLEANED_DIR / "labels" / split
        
        for img_p in src_img_dir.glob("*.*"):
            if not img_p.suffix.lower() in [".jpg", ".jpeg", ".png", ".webp"]:
                continue
            
            # Check if this was an old hard-negative dog with empty label
            if "neg_" in img_p.name and "dog" in img_p.name.lower():
                excluded_old_dog_negs += 1
                continue # We will re-add dog with proper class 4 labels

            dst_img = DEST_5CLASS_DIR / "images" / split / img_p.name
            dst_lbl = DEST_5CLASS_DIR / "labels" / split / f"{img_p.stem}.txt"

            # Copy image
            if not dst_img.exists():
                try:
                    os.link(str(img_p), str(dst_img))
                except Exception:
                    shutil.copy2(str(img_p), str(dst_img))

            # Copy label
            lbl_p = src_lbl_dir / f"{img_p.stem}.txt"
            if lbl_p.exists():
                lines = lbl_p.read_text(encoding="utf-8").strip().splitlines()
                with open(dst_lbl, "w", encoding="utf-8") as f:
                    for line in lines:
                        parts = line.strip().split()
                        if len(parts) == 5:
                            cid = int(parts[0])
                            if cid < 4:
                                f.write(line.strip() + "\n")
                                box_counts[split][cid] += 1
            else:
                with open(dst_lbl, "w", encoding="utf-8") as f:
                    pass

            split_counts[split] += 1

    print(f"Excluded {excluded_old_dog_negs} old unannotated negative dog images.")
    for split in ["train", "val", "test"]:
        print(f"  {split.upper()} base images transferred: {split_counts[split]}")

    # 3. Process Dog Dataset 1: Dog.v1i.yolov8 (177 images, 59 unique base scenes)
    print("\n[STEP 2] Ingesting Roboflow Dog dataset (cookieworkspace/dog-4cu23)...")
    dog1_imgs = list((DOG_V1_DIR / "train" / "images").glob("*.*"))
    dog1_lbl_dir = DOG_V1_DIR / "train" / "labels"

    # Group by base scene to prevent video/augmentation leakage
    dog1_groups = defaultdict(list)
    for p in dog1_imgs:
        base_prefix = p.stem.split(".rf.")[0]
        dog1_groups[base_prefix].append(p)

    sorted_groups = sorted(list(dog1_groups.keys()))
    random.seed(42)
    random.shuffle(sorted_groups)

    n_groups = len(sorted_groups)
    n_train_g = int(n_groups * 0.80) # 47 groups
    n_val_g = int(n_groups * 0.10)   # 6 groups
    # remainder = 6 groups for test

    train_dog_groups = set(sorted_groups[:n_train_g])
    val_dog_groups = set(sorted_groups[n_train_g:n_train_g + n_val_g])
    test_dog_groups = set(sorted_groups[n_train_g + n_val_g:])

    print(f"Roboflow Dog scene groups split: {len(train_dog_groups)} Train, {len(val_dog_groups)} Val, {len(test_dog_groups)} Test")

    dog1_added = {"train": 0, "val": 0, "test": 0}
    for base_prefix, img_list in dog1_groups.items():
        if base_prefix in train_dog_groups:
            target_split = "train"
        elif base_prefix in val_dog_groups:
            target_split = "val"
        else:
            target_split = "test"

        for img_p in img_list:
            dst_img = DEST_5CLASS_DIR / "images" / target_split / f"dog_{img_p.name}"
            dst_lbl = DEST_5CLASS_DIR / "labels" / target_split / f"dog_{img_p.stem}.txt"

            try:
                os.link(str(img_p), str(dst_img))
            except Exception:
                shutil.copy2(str(img_p), str(dst_img))

            # Convert label: class 0 -> class 4 (Dog)
            src_lbl = dog1_lbl_dir / f"{img_p.stem}.txt"
            if src_lbl.exists():
                lines = src_lbl.read_text(encoding="utf-8").strip().splitlines()
                with open(dst_lbl, "w", encoding="utf-8") as f:
                    for line in lines:
                        parts = line.strip().split()
                        if len(parts) == 5:
                            # Map to class 4
                            f.write(f"4 {parts[1]} {parts[2]} {parts[3]} {parts[4]}\n")
                            box_counts[target_split][4] += 1
            else:
                with open(dst_lbl, "w", encoding="utf-8") as f:
                    pass

            split_counts[target_split] += 1
            dog1_added[target_split] += 1

    print(f"Roboflow Dog images added: {dog1_added['train']} Train, {dog1_added['val']} Val, {dog1_added['test']} Test (Total: {sum(dog1_added.values())})")

    # 4. Ingest verified breed dogs from kavach_dataset (Beagle, Husky, Golden Retriever, German Shepherd, Labrador, Pug)
    print("\n[STEP 3] Ingesting verified multi-breed dog images from kavach_dataset...")
    kd_lbl_dir = KAVACH_RAW_DATASET_DIR / "labels"
    kd_img_dir = KAVACH_RAW_DATASET_DIR / "images"

    breed_dog_samples = []
    if kd_lbl_dir.exists():
        for sub in ["train", "val"]:
            sub_lbl = kd_lbl_dir / sub
            sub_img = kd_img_dir / sub
            if not sub_lbl.exists():
                continue
            for lbl_p in sub_lbl.glob("*.txt"):
                lines = [l.strip() for l in lbl_p.read_text(encoding="utf-8").splitlines() if l.strip()]
                # Check for class 5 in kavach_dataset (Dog)
                dog_boxes = []
                for line in lines:
                    parts = line.split()
                    if len(parts) == 5 and int(parts[0]) == 5:
                        dog_boxes.append((parts[1], parts[2], parts[3], parts[4]))
                if dog_boxes:
                    img_p = sub_img / f"{lbl_p.stem}.jpg"
                    if img_p.exists():
                        breed_dog_samples.append((img_p, dog_boxes))

    # Group by breed stem
    breed_groups = defaultdict(list)
    for img_p, boxes in breed_dog_samples:
        prefix = "_".join(img_p.stem.split("_")[:3]) # e.g. dog_beagle_hound
        breed_groups[prefix].append((img_p, boxes))

    sorted_breeds = sorted(list(breed_groups.keys()))
    random.seed(101)
    random.shuffle(sorted_breeds)

    breed_added = {"train": 0, "val": 0, "test": 0}
    for idx, bprefix in enumerate(sorted_breeds):
        # 4 breeds train, 1 breed val, 1 breed test
        if idx < 4:
            target_split = "train"
        elif idx == 4:
            target_split = "val"
        else:
            target_split = "test"

        for img_p, boxes in breed_groups[bprefix]:
            dst_img = DEST_5CLASS_DIR / "images" / target_split / f"breed_{img_p.name}"
            dst_lbl = DEST_5CLASS_DIR / "labels" / target_split / f"breed_{img_p.stem}.txt"

            try:
                os.link(str(img_p), str(dst_img))
            except Exception:
                shutil.copy2(str(img_p), str(dst_img))

            with open(dst_lbl, "w", encoding="utf-8") as f:
                for xc, yc, w, h in boxes:
                    f.write(f"4 {xc} {yc} {w} {h}\n")
                    box_counts[target_split][4] += 1

            split_counts[target_split] += 1
            breed_added[target_split] += 1

    print(f"Verified breed dogs added: {breed_added['train']} Train, {breed_added['val']} Val, {breed_added['test']} Test (Total: {sum(breed_added.values())})")

    # 5. Generate 5-class data.yaml
    data_yaml_path = DEST_5CLASS_DIR / "data.yaml"
    yaml_content = f"""path: {DEST_5CLASS_DIR.as_posix()}
train: images/train
val: images/val
test: images/test

nc: 5
names:
  0: Elephant
  1: Tiger
  2: Leopard
  3: Wild Boar
  4: Dog
"""
    with open(data_yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_content)

    print(f"\nSaved data.yaml at: {data_yaml_path}")

    # 6. Verification & Leakage Check
    print("\n" + "=" * 70)
    print("                    DATASET VERIFICATION SUMMARY")
    print("=" * 70)
    print(f"Total Dataset Images: {sum(split_counts.values())}")
    print(f"  Train:      {split_counts['train']} images")
    print(f"  Validation: {split_counts['val']} images")
    print(f"  Test:       {split_counts['test']} images (Isolated Unseen Test Set)")

    print("\nBounding Box Distribution Across 5 Classes:")
    for cid in range(5):
        cname = CLASS_NAMES[cid]
        tr = box_counts["train"][cid]
        va = box_counts["val"][cid]
        te = box_counts["test"][cid]
        tot = tr + va + te
        print(f"  [{cid}] {cname:<12}: Train={tr:5d}, Val={va:4d}, Test={te:4d} | TOTAL={tot:5d}")

    # Strict Leakage Verification
    train_stems = set(p.stem for p in (DEST_5CLASS_DIR / "images" / "train").glob("*.*"))
    val_stems = set(p.stem for p in (DEST_5CLASS_DIR / "images" / "val").glob("*.*"))
    test_stems = set(p.stem for p in (DEST_5CLASS_DIR / "images" / "test").glob("*.*"))

    leak_tr_val = train_stems.intersection(val_stems)
    leak_tr_test = train_stems.intersection(test_stems)
    leak_val_test = val_stems.intersection(test_stems)

    print("\nStrict Anti-Leakage Audit:")
    print(f"  Train & Val  overlap: {len(leak_tr_val)} (Expected: 0)")
    print(f"  Train & Test overlap: {len(leak_tr_test)} (Expected: 0)")
    print(f"  Val & Test   overlap: {len(leak_val_test)} (Expected: 0)")
    assert len(leak_tr_val) == 0 and len(leak_tr_test) == 0 and len(leak_val_test) == 0, "LEAKAGE DETECTED!"
    print("  >>> VERIFICATION PASSED: ZERO LEAKAGE CONFIRMED! <<<")
    print("=" * 70)

if __name__ == "__main__":
    build_5class_dataset()
