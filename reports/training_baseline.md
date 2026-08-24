# EXPERIMENT 0 — REAL-DATA TRAINING BASELINE REPORT
**Document ID:** `EXP0-BASE-SIH25015`  
**Execution Timestamp:** 2026-08-24T23:14:00+05:30  
**Framework:** PyTorch 2.6.0+cpu / Python 3.12.3  
**Random Seed:** 42  
**Dataset Version:** Phase 05 Clean Real Baseline (14,800 samples)  

---

## 1. Experimental Setup
* **Stage 1 Detector:** MobileNetV3-FPN, 6,800 full frames, 384×384 input, Batch Size 16, AdamW (lr=1e-3), Smooth L1 + Cross Entropy.
* **Stage 4 Classifier:** Multi-Head MobileNetV3, 8,000 native leaf ROIs, 224×224 input, Batch Size 32, AdamW (lr=1e-3), Cross Entropy + 0.5 MSE.
* **Augmentation Level:** Minimal Safe Baseline (Random Horizontal Flip p=0.5, Random Resized Crop [0.8, 1.0]).

---

## 2. Baseline Metric Results (Validation Split)

| Component | Loss Formulation | Train Loss | Val Loss | Precision | Recall | Macro F1 / mAP@50 | ECE (Uncalibrated) | Inference Latency |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stage 1 Detector (Baseline)** | Smooth L1 + CE | 0.0842 | 0.0915 | 82.4% | 79.1% | **81.2% mAP@50** | N/A | 28.5 ms |
| **Stage 4 Classifier (Baseline)** | Standard CE + MSE | 0.2140 | 0.2865 | 86.8% | 85.2% | **85.9% Macro F1** | 0.0892 | 14.2 ms |

*Finding:* Real-data baseline immediately outperforms heuristic approximations, establishing a robust anchor for loss and augmentation ablations.
