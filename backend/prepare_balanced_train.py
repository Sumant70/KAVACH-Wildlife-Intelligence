import os
import random
import shutil
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(r"C:\Users\ASUS\Downloads\infinityHack-main\infinityHack-main\backend")
FULL_DATASET = BASE_DIR / "kavach_5class_dataset"
BALANCED_DIR = BASE_DIR / "kavach_5class_balanced"

def create_balanced_dataset():
    print("=" * 70)
    print("      CREATING BALANCED 5-CLASS SUBSET FOR RAPID OPTIMAL CPU CONVERGENCE")
    print("=" * 70)

    # 1. Structure
    for split in ["train", "val", "test"]:
        (BALANCED_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (BALANCED_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)

    # Val and Test are kept 100% identical to FULL_DATASET to preserve untouched test integrity!
    for split in ["val", "test"]:
        src_imgs = list((FULL_DATASET / "images" / split).glob("*.*"))
        for img_p in src_imgs:
            dst_img = BALANCED_DIR / "images" / split / img_p.name
            dst_lbl = BALANCED_DIR / "labels" / split / f"{img_p.stem}.txt"
            src_lbl = FULL_DATASET / "labels" / split / f"{img_p.stem}.txt"

            if not dst_img.exists():
                try:
                    os.link(str(img_p), str(dst_img))
                except Exception:
                    shutil.copy2(str(img_p), str(dst_img))

            if not dst_lbl.exists() and src_lbl.exists():
                shutil.copy2(str(src_lbl), str(dst_lbl))

        print(f"Preserved 100% identical {split.upper()} set: {len(src_imgs)} images")

    # 2. Curate Balanced Train Set: ~500 images per class
    print("\nCategorizing Train images by primary class...")
    train_imgs = list((FULL_DATASET / "images" / "train").glob("*.*"))
    train_lbl_dir = FULL_DATASET / "labels" / "train"

    class_to_imgs = defaultdict(list)
    hard_negs = []

    for img_p in train_imgs:
        lbl_p = train_lbl_dir / f"{img_p.stem}.txt"
        if not lbl_p.exists():
            hard_negs.append(img_p)
            continue
        content = lbl_p.read_text(encoding="utf-8").strip()
        if not content:
            hard_negs.append(img_p)
            continue
        cids = [int(line.split()[0]) for line in content.splitlines() if line.strip() and len(line.split()) == 5]
        if not cids:
            hard_negs.append(img_p)
            continue
        # Primary class
        primary_cid = max(set(cids), key=cids.count)
        class_to_imgs[primary_cid].append(img_p)

    names = ["Elephant", "Tiger", "Leopard", "Wild Boar", "Dog"]
    for cid in range(5):
        print(f"  [{cid}] {names[cid]}: {len(class_to_imgs[cid])} available images")
    print(f"  Hard Negatives: {len(hard_negs)} available images")

    # Sample ~550 per class (or all if fewer)
    random.seed(42)
    selected_train = []
    for cid in range(5):
        pool = class_to_imgs[cid]
        n_sample = min(len(pool), 550)
        chosen = random.sample(pool, n_sample)
        selected_train.extend(chosen)
        print(f"  Sampled {len(chosen)} images for {names[cid]}")

    # Include all hard negatives (vehicles, cows, humans, meadow)
    selected_train.extend(hard_negs)
    print(f"  Included {len(hard_negs)} hard negative images")

    print(f"\nTotal Balanced Train Set: {len(selected_train)} images")

    for img_p in selected_train:
        dst_img = BALANCED_DIR / "images" / "train" / img_p.name
        dst_lbl = BALANCED_DIR / "labels" / "train" / f"{img_p.stem}.txt"
        src_lbl = train_lbl_dir / f"{img_p.stem}.txt"

        if not dst_img.exists():
            try:
                os.link(str(img_p), str(dst_img))
            except Exception:
                shutil.copy2(str(img_p), str(dst_img))

        if not dst_lbl.exists():
            if src_lbl.exists():
                shutil.copy2(str(src_lbl), str(dst_lbl))
            else:
                with open(dst_lbl, "w") as f:
                    pass

    # Generate data.yaml
    data_yaml = BALANCED_DIR / "data.yaml"
    yaml_text = f"""path: {BALANCED_DIR.as_posix()}
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
    with open(data_yaml, "w") as f:
        f.write(yaml_text)

    print(f"Saved balanced data.yaml at: {data_yaml}")
    print("=" * 70)

if __name__ == "__main__":
    create_balanced_dataset()
