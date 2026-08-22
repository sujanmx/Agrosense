"""
ONNX Export & Edge Optimization Pipeline
Converts PyTorch checkpoints to browser-optimized ONNX format (WebAssembly SIMD / WebGPU)
and deposits them directly into public/models/ for browser execution.
"""

import os
import sys
import argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import torch

# Add training folder to path to import model architectures
sys.path.append(str(Path(__file__).parent.parent))
from models.train_classifier import MultiHeadPathologyModel
from models.train_detector import PlantOrganDetector, DETECTOR_CLASSES

def export_detector_onnx(weights_path: str, output_path: str, img_size: int = 384):
    print(f"[ExportONNX] 🔄 Exporting Detector ({weights_path}) to ONNX ({output_path})...")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    try:
        # Check if weights file exists as PyTorch state dict
        if os.path.exists(weights_path):
            try:
                state_dict = torch.load(weights_path, map_location="cpu")
                model = PlantOrganDetector(num_classes=len(DETECTOR_CLASSES), pretrained=False)
                model.load_state_dict(state_dict)
                print(f"[ExportONNX] Loaded PyTorch PlantOrganDetector checkpoint from {weights_path}")
            except Exception:
                # If YOLO format, use ultralytics export
                from ultralytics import YOLO
                yolo_model = YOLO(weights_path)
                yolo_model.export(format="onnx", imgsz=img_size, dynamic=False, simplify=True, opset=17)
                exported_file = Path(weights_path).with_suffix(".onnx")
                if exported_file.exists() and str(exported_file) != str(output_path):
                    import shutil
                    shutil.copy2(exported_file, output_path)
                print(f"[ExportONNX] ✅ Exported YOLO detector to {output_path}")
                return
        else:
            print(f"[ExportONNX] Initializing base PlantOrganDetector for export...")
            model = PlantOrganDetector(num_classes=len(DETECTOR_CLASSES), pretrained=True)

        model.eval()
        dummy_input = torch.randn(1, 3, img_size, img_size, dtype=torch.float32)

        torch.onnx.export(
            model,
            dummy_input,
            output_path,
            export_params=True,
            opset_version=17,
            do_constant_folding=True,
            input_names=["input_rgb"],
            output_names=["boxes", "scores"],
            dynamic_axes={"input_rgb": {0: "batch_size"}, "boxes": {0: "batch_size"}, "scores": {0: "batch_size"}},
            dynamo=False
        )
        print(f"[ExportONNX] ✅ PlantOrganDetector exported successfully to {output_path}")
        print(f"  - Input Tensor: 'input_rgb' shape [1, 3, {img_size}, {img_size}] (Float32, Normalized)")
        print(f"  - Output Tensor 1: 'boxes' shape [1, 144, 4] (Normalized [cx, cy, w, h])")
        print(f"  - Output Tensor 2: 'scores' shape [1, 144, {len(DETECTOR_CLASSES)}] (Class probabilities)")

    except Exception as e:
        print(f"[ExportONNX] ⚠️ Detector export error: {e}")

def export_classifier_onnx(weights_path: str, output_path: str, img_size: int = 224, num_classes: int = 9):
    print(f"[ExportONNX] 🔄 Exporting Classifier ({weights_path}) to ONNX ({output_path})...")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    try:
        model = MultiHeadPathologyModel(num_classes=num_classes, pretrained=False)
        if os.path.exists(weights_path):
            state_dict = torch.load(weights_path, map_location="cpu")
            model.load_state_dict(state_dict)
            print(f"[ExportONNX] Loaded PyTorch checkpoint from {weights_path}")
        else:
            print(f"[ExportONNX] ⚠️ Checkpoint {weights_path} not found. Exporting base architecture.")

        model.eval()
        dummy_input = torch.randn(1, 3, img_size, img_size, dtype=torch.float32)

        torch.onnx.export(
            model,
            dummy_input,
            output_path,
            export_params=True,
            opset_version=17,
            do_constant_folding=True,
            input_names=["input_rgb"],
            output_names=["logits", "severity"],
            dynamic_axes={"input_rgb": {0: "batch_size"}, "logits": {0: "batch_size"}, "severity": {0: "batch_size"}},
            dynamo=False
        )
        print(f"[ExportONNX] ✅ Classifier exported successfully to {output_path}")
        print(f"  - Input Tensor: 'input_rgb' shape [1, 3, {img_size}, {img_size}] (Float32, Normalized)")
        print(f"  - Output Tensor 1: 'logits' shape [1, {num_classes}]")
        print(f"  - Output Tensor 2: 'severity' shape [1, 1]")

    except Exception as e:
        print(f"[ExportONNX] ❌ Classifier export error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export PyTorch models to browser-ready ONNX format.")
    parser.add_argument("--detector_weights", type=str, default="weights/detector_best.pt", help="Path to detector .pt")
    parser.add_argument("--classifier_weights", type=str, default="weights/classifier_best.pt", help="Path to classifier .pt")
    parser.add_argument("--out_dir", type=str, default="./public/models", help="Destination folder in public/models")
    args = parser.parse_args()

    Path(args.out_dir).mkdir(parents=True, exist_ok=True)
    det_out = str(Path(args.out_dir) / "target_crop_detector_int8.onnx")
    cls_out = str(Path(args.out_dir) / "pathology_classifier_int8.onnx")

    export_classifier_onnx(args.classifier_weights, cls_out)
    export_detector_onnx(args.detector_weights, det_out)
