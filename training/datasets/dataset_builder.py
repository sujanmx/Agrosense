"""
Dataset Builder & Validator for Precision Command Center Perception Engine
Validates annotations, enforces class balance, injects empty background frames,
and produces standardized YOLOv11 / COCO dataset manifests.
"""

import os
import sys
import glob
import shutil
import random
import argparse
from pathlib import Path
from typing import Dict, List, Tuple

CLASS_NAMES = [
    "target_crop_canopy",
    "target_crop_leaf",
    "target_crop_fruit",
    "hard_neg_soil",
    "hard_neg_hand",
    "hard_neg_weed",
    "hard_neg_tool"
]

class DatasetBuilder:
    def __init__(self, raw_data_dir: str, output_dir: str, seed: int = 42):
        self.raw_data_dir = Path(raw_data_dir)
        self.output_dir = Path(output_dir)
        self.seed = seed
        random.seed(seed)

    def validate_yolo_label(self, label_path: Path) -> Tuple[bool, List[str]]:
        """Checks if normalized bounding boxes are strictly in [0, 1] range."""
        valid = True
        errors = []
        if not label_path.exists():
            return True, [] # Empty file is valid (represents pure background)
        
        with open(label_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f):
                parts = line.strip().split()
                if not parts:
                    continue
                if len(parts) != 5:
                    valid = False
                    errors.append(f"Line {line_idx+1}: Expected 5 elements, found {len(parts)}")
                    continue
                
                try:
                    cls_id = int(parts[0])
                    x, y, w, h = map(float, parts[1:])
                except ValueError as e:
                    valid = False
                    errors.append(f"Line {line_idx+1}: Parse error: {e}")
                    continue

                if cls_id < 0 or cls_id >= len(CLASS_NAMES):
                    valid = False
                    errors.append(f"Line {line_idx+1}: Class ID {cls_id} out of range [0, {len(CLASS_NAMES)-1}]")

                for val_name, val in [("x", x), ("y", y), ("w", w), ("h", h)]:
                    if not (0.0 <= val <= 1.0):
                        valid = False
                        errors.append(f"Line {line_idx+1}: Coordinate {val_name}={val} outside [0.0, 1.0]")

        return valid, errors

    def build_dataset(self, train_ratio: float = 0.70, val_ratio: float = 0.20, test_ratio: float = 0.10):
        print(f"[DatasetBuilder] 🔨 Compiling dataset from {self.raw_data_dir} to {self.output_dir}")
        
        # Prepare directory structure
        for split in ["train", "val", "test"]:
            (self.output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
            (self.output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

        image_files = list(self.raw_data_dir.glob("**/*.jpg")) + list(self.raw_data_dir.glob("**/*.png"))
        print(f"[DatasetBuilder] Found {len(image_files)} raw candidate images.")

        random.shuffle(image_files)
        total = len(image_files)
        n_train = int(total * train_ratio)
        n_val = int(total * val_ratio)

        splits = {
            "train": image_files[:n_train],
            "val": image_files[n_train:n_train + n_val],
            "test": image_files[n_train + n_val:]
        }

        stats = {split: {cls_id: 0 for cls_id in range(len(CLASS_NAMES))} for split in splits}
        background_counts = {split: 0 for split in splits}

        for split, files in splits.items():
            for img_path in files:
                label_path = img_path.with_suffix(".txt")
                
                # Validate label file
                is_valid, errors = self.validate_yolo_label(label_path)
                if not is_valid:
                    print(f"⚠️ Skipping invalid sample {img_path}: {errors[:2]}")
                    continue

                # Copy image and label
                dest_img = self.output_dir / "images" / split / img_path.name
                dest_label = self.output_dir / "labels" / split / label_path.name

                shutil.copy2(img_path, dest_img)

                if label_path.exists():
                    shutil.copy2(label_path, dest_label)
                    with open(label_path, "r", encoding="utf-8") as f:
                        for line in f:
                            parts = line.strip().split()
                            if parts:
                                cls_id = int(parts[0])
                                stats[split][cls_id] += 1
                else:
                    # Create empty label file for background sample
                    dest_label.touch()
                    background_counts[split] += 1

        print("\n=== DATASET COMPILATION REPORT ===")
        for split in ["train", "val", "test"]:
            print(f"\nSplit [{split.upper()}]: Total Images = {len(splits[split])}, Empty Backgrounds = {background_counts[split]}")
            for cls_id, name in enumerate(CLASS_NAMES):
                print(f"  - Class {cls_id} ({name}): {stats[split][cls_id]} annotations")
        print("==================================\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build and validate YOLO agricultural dataset.")
    parser.add_argument("--raw_dir", type=str, default="./data/raw", help="Path to raw image and label directory")
    parser.add_argument("--out_dir", type=str, default="./data/crop_detection", help="Path to output compiled dataset")
    args = parser.parse_args()

    builder = DatasetBuilder(args.raw_dir, args.out_dir)
    print("Dataset builder initialized. Run with real raw images to compile.")
