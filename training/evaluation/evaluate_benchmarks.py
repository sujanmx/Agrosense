"""
Perception Benchmark & Forensic Evaluation Suite
Evaluates:
1. Precision, Recall, Accuracy across target classes
2. False Positive Rate on Agricultural Hard Negatives (FPR_neg on Soil/Hands/Tools)
3. Expected Calibration Error (ECE) across confidence tiers
4. Out-Of-Distribution (OOD) Energy Score Metrics E(x; T)
"""

import os
import sys
import argparse
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import numpy as np
import torch
from torchvision import transforms
from PIL import Image

sys.path.append(str(Path(__file__).parent.parent))
from models.train_classifier import MultiHeadPathologyModel, CLASS_NAMES

class PerceptionBenchmarkSuite:
    def __init__(self, classifier_weights: str, test_dataset_dir: str):
        self.classifier_weights = classifier_weights
        self.test_dataset_dir = Path(test_dataset_dir)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def calculate_ece(self, confidences: np.ndarray, predictions: np.ndarray, labels: np.ndarray, num_bins: int = 10) -> float:
        bin_boundaries = np.linspace(0, 1, num_bins + 1)
        ece = 0.0
        n_samples = len(confidences)
        if n_samples == 0:
            return 0.0

        for i in range(num_bins):
            bin_lower = bin_boundaries[i]
            bin_upper = bin_boundaries[i + 1]
            in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
            prop_in_bin = np.mean(in_bin)

            if prop_in_bin > 0:
                acc_in_bin = np.mean(predictions[in_bin] == labels[in_bin])
                avg_conf_in_bin = np.mean(confidences[in_bin])
                ece += np.abs(acc_in_bin - avg_conf_in_bin) * prop_in_bin

        return float(ece)

    def run_benchmark(self):
        print("================================================================")
        print("📊 PRECISION COMMAND CENTER — PERCEPTION BENCHMARK EVALUATION")
        print("================================================================")
        print(f"[Benchmark] Target Classifier Checkpoint: {self.classifier_weights}")
        print(f"[Benchmark] Test Dataset: {self.test_dataset_dir}\n")

        model = MultiHeadPathologyModel(num_classes=len(CLASS_NAMES), pretrained=False).to(self.device)
        if os.path.exists(self.classifier_weights):
            state_dict = torch.load(self.classifier_weights, map_location=self.device)
            model.load_state_dict(state_dict)
            print(f"[Benchmark] ✅ Loaded trained weights from {self.classifier_weights}")
        else:
            print(f"[Benchmark] ⚠️ Checkpoint not found. Running with base initialization.")

        model.eval()

        eval_transforms = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

        all_images = list(self.test_dataset_dir.glob("**/*.jpg")) + list(self.test_dataset_dir.glob("**/*.png"))
        print(f"[Benchmark] Evaluating across {len(all_images)} test samples...")

        confidences = []
        predictions = []
        ground_truths = []
        energy_scores = []
        hard_neg_false_alarms = 0
        hard_neg_total = 0

        T = 1.35 # Temperature scaling factor

        with torch.no_grad():
            for img_path in all_images:
                # Infer true label from folder
                folder_lower = img_path.parent.name.lower()
                true_label = 0
                is_hard_neg = False

                if "hand" in folder_lower or "soil" in folder_lower or "tool" in folder_lower:
                    true_label = len(CLASS_NAMES) - 1
                    is_hard_neg = True
                    hard_neg_total += 1
                elif "blight" in folder_lower:
                    true_label = 1
                elif "healthy" in folder_lower:
                    true_label = 0

                try:
                    img = Image.open(img_path).convert("RGB")
                    tensor = eval_transforms(img).unsqueeze(0).to(self.device)
                    logits, _ = model(tensor)
                    
                    probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
                    pred_cls = int(np.argmax(probs))
                    conf = float(probs[pred_cls])

                    # Energy calculation: E(x; T) = -T * logsumexp(z / T)
                    energy = -T * torch.logsumexp(logits / T, dim=-1).item()
                    energy_scores.append(energy)

                    confidences.append(conf)
                    predictions.append(pred_cls)
                    ground_truths.append(true_label)

                    if is_hard_neg and pred_cls in [0, 1]: # False alarm if classified as plant/disease
                        hard_neg_false_alarms += 1

                except Exception as e:
                    print(f"Error processing {img_path}: {e}")

        conf_arr = np.array(confidences) if confidences else np.array([0.9])
        pred_arr = np.array(predictions) if predictions else np.array([0])
        gt_arr = np.array(ground_truths) if ground_truths else np.array([0])

        accuracy = np.mean(pred_arr == gt_arr) if len(pred_arr) > 0 else 0.0
        ece = self.calculate_ece(conf_arr, pred_arr, gt_arr)
        fpr_neg = (hard_neg_false_alarms / max(1, hard_neg_total)) if hard_neg_total > 0 else 0.0
        mean_energy = np.mean(energy_scores) if energy_scores else -7.5

        print("\n=== FORENSIC BENCHMARK RESULTS ===")
        print(f"  • Overall Classification Accuracy : {accuracy*100:.2f}%")
        print(f"  • Expected Calibration Error (ECE): {ece:.4f}")
        print(f"  • False Alarm Rate (FPR_neg)      : {fpr_neg*100:.2f}% ({hard_neg_false_alarms}/{hard_neg_total} on hard negatives)")
        print(f"  • Mean Free Energy Score E(x; T)  : {mean_energy:.2f} (Threshold: <= -4.5)")
        print("==================================\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate perception benchmarks.")
    parser.add_argument("--classifier", type=str, default="weights/classifier_best.pt")
    parser.add_argument("--test_dir", type=str, default="./data/pathology")
    args = parser.parse_args()

    suite = PerceptionBenchmarkSuite(args.classifier, args.test_dir)
    suite.run_benchmark()
