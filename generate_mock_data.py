"""
Synthetic Dataset Generator for Precision Command Center Pipeline Verification
Generates 15 images (224x224) for each target category:
1. Healthy Target Crop (Solid green textured patches)
2. Early Blight (Green with concentric necrotic brown lesions)
3. hard_neg_hand (Skin-tone simulated texture)
4. hard_neg_soil (Soil brown simulated texture)
5. hard_neg_tool (Metallic simulated texture)
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def create_synthetic_data(base_dir: str = "./data/pathology"):
    classes = {
        "Healthy Target Crop": (34, 139, 34),       # Forest Green
        "Early Blight": (46, 125, 50),             # Green base with brown lesions
        "hard_neg_hand": (210, 160, 130),          # Human skin tone
        "hard_neg_soil": (101, 67, 33),            # Soil brown
        "hard_neg_tool": (160, 160, 165)           # Metallic tool grey
    }

    base_path = Path(base_dir)
    print(f"[MockData] Generating synthetic dataset in {base_path.resolve()}...")

    for class_name, color in classes.items():
        folder_path = base_path / class_name
        folder_path.mkdir(parents=True, exist_ok=True)
        print(f"[MockData] Creating images in {folder_path}...")

        for i in range(15):
            img = Image.new("RGB", (224, 224), color=color)
            draw = ImageDraw.Draw(img)

            if class_name == "Early Blight":
                # Add concentric brown lesions (early blight pathology)
                lesion_color = (110, 60, 20)
                lesion_halo = (160, 130, 40)
                # Outer yellow halo
                draw.ellipse([(60, 60), (160, 160)], fill=lesion_halo)
                # Inner necrotic center
                draw.ellipse([(75, 75), (145, 145)], fill=lesion_color)
                draw.ellipse([(90, 90), (130, 130)], fill=(60, 30, 10))

            elif class_name == "Healthy Target Crop":
                # Add vein structure
                vein_color = (60, 179, 113)
                draw.line([(112, 20), (112, 204)], fill=vein_color, width=3)
                draw.line([(112, 60), (170, 90)], fill=vein_color, width=2)
                draw.line([(112, 120), (50, 150)], fill=vein_color, width=2)

            elif "hard_neg_hand" in class_name:
                # Add crease lines
                crease_color = (180, 130, 105)
                draw.line([(40, 112), (184, 112)], fill=crease_color, width=2)
                draw.line([(50, 140), (174, 140)], fill=crease_color, width=2)

            elif "hard_neg_soil" in class_name:
                # Add gravel/specks
                speck_color = (60, 40, 20)
                for s in range(5):
                    draw.rectangle([(20*s + 30, 30*s + 20), (20*s + 40, 30*s + 30)], fill=speck_color)

            elif "hard_neg_tool" in class_name:
                # Add metallic edge
                draw.rectangle([(80, 10), (144, 214)], fill=(200, 200, 210), outline=(100, 100, 110), width=2)

            img_file = folder_path / f"synthetic_{i+1:03d}.jpg"
            img.save(img_file, "JPEG", quality=95)

    print(f"[MockData] Successfully generated synthetic datasets across {len(classes)} folders.")

if __name__ == "__main__":
    create_synthetic_data()
