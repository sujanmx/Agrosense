# Phase 09B-8A — Class Coverage & Metric Integrity Audit Report

> **Document ID:** `AUDIT-PHASE09B8A-CLASS-COVERAGE`  
> **Lead ML Dataset Auditor & CV Quality Engineer:** Senior ML Forensic Dataset Auditor  
> **Standard:** ISO/IEC 5259 Data Quality for ML / NIST AI RMF 1.0  
> **Audit Scope:** Phase 09B-8 Training Manifests, Normalization Pool, and Validation Metrics Artifacts  
> **Target Class Investigated:** `03_powdery_mildew` (Canonical Class ID 3)  
> **Execution Status:** **AUDIT COMPLETE — VERDICT: PARTIAL (8/9 Active Class Support)**

---

## 1. Executive Forensic Findings

A forensic audit was conducted on the Phase 09B-8 training artifacts, manifests, and confusion matrices to investigate why `03_powdery_mildew` reported **0 validation samples** while the model output head contains 9 classes.

### Root Cause Discovery:
1. **Zero Raw Training Samples Ingested for Class 03:** In Phase 09B-3 and Phase 09B-4, raw images for `03_powdery_mildew` from `SRC_06_MENDELEY_TOMATO` were not downloaded into `data/raw/SRC_06_MENDELEY_TOMATO/` (which only contained reference manifests), and `SRC_02_PLANTVILLAGE` (which contains `Squash___Powdery_mildew`) had non-tomato folders quarantined. As a result, **`data/processed/pathology/03_powdery_mildew/` has exactly 0 images** across the entire project.
2. **Manifest Absence:** Exactly **0 samples** exist for class 03 in `train.jsonl`, `validation.jsonl`, and `test.jsonl`.
3. **Taxonomy & Architecture Retention:** The 9-class canonical schema and MobileNetV3-Small classifier output head ($[B, 9]$) intentionally retain `03: Powdery Mildew (Oidium neolycopersici)` to preserve full 9-class forward compatibility with the browser runtime `ModelAdapter.ts` and `DiseaseClassifier.ts`.
4. **Metric Integrity Verification:**
   - The reported **94.49% validation accuracy** is mathematically computed over the **2,015 actual validation samples** across the 8 populated classes (zero samples tested for class 3, so zero true positives/false negatives).
   - The reported **Macro F1 of 0.8405** strictly penalizes the model by averaging over **all 9 classes** (including $F_1 = 0.0000$ for `03_powdery_mildew`). Excluding class 3, the 8-class macro F1 is **0.9456**.

---

## 2. 14-Point Class Coverage & Metric Verification Scorecard

| # | Verification Item | Forensic Evidence & Findings | Status |
| :---: | :--- | :--- | :---: |
| **1** | Exact train count for Class 03 | **0 samples** in `data/manifests/train.jsonl` | ℹ️ 0 Samples |
| **2** | Exact validation count for Class 03 | **0 samples** in `data/manifests/validation.jsonl` | ℹ️ 0 Samples |
| **3** | Exact test count for Class 03 | **0 samples** in `data/manifests/test.jsonl` | ℹ️ 0 Samples |
| **4** | Exists in Canonical Taxonomy | **YES.** Defined in `reports/phase09b1_taxonomy_strategy.md` & `types/index.ts` | 🟢 VERIFIED |
| **5** | Exists in Classifier Output Mapping | **YES.** `class_mapping.json` index 3 is `"Powdery Mildew (Oidium neolycopersici)"` | 🟢 VERIFIED |
| **6** | Exists in `train.jsonl` | **NO.** 0 records have `canonical_class_id: 3` | ℹ️ 0 Records |
| **7** | Exists in `validation.jsonl` | **NO.** 0 records have `canonical_class_id: 3` | ℹ️ 0 Records |
| **8** | Exists in `test.jsonl` | **NO.** 0 records have `canonical_class_id: 3` | ℹ️ 0 Records |
| **9** | Why split excluded it from val | The normalized source pool `data/processed/pathology/03_powdery_mildew/` has 0 images | ℹ️ Expected |
| **10**| Any other class affected | **NO.** All other 8 pathology classes and detector frames have full 70/15/15 representation | 🟢 VERIFIED |
| **11**| 94.49% Validation Accuracy Calculation | Calculated over all 2,015 active validation predictions: $\frac{1,904 \text{ correct}}{2,015 \text{ total}} = 94.49\%$ | 🟢 VERIFIED |
| **12**| Macro F1 Calculation Scope | **Includes Class 03.** Macro F1 = $\frac{\sum_{i=0}^8 F1_i}{9} = 0.8405$ (Penalized for 0 sample support) | 🟢 VERIFIED |
| **13**| Confusion Matrix Inspection | Dimensions: **9 \times 9** ($9 \times 9$). Row 3 sum is 0, Column 3 sum is 0. Matches class order 0..8 | 🟢 VERIFIED |
| **14**| Metric Hardcoding Check | **Zero hardcoded metrics.** All values generated dynamically via `torch.max` and NumPy | 🟢 VERIFIED |

---

## 3. Class Support Breakdown Table

| Class ID | Canonical Pathology Class Name | Normalized Pool | Train Count (70%) | Val Count (15%) | Test Count (15%) | Precision | Recall | F1 Score |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0** | `Healthy Target Crop` | 1,987 | 1,393 | 320 | 274 | **0.9594** | **0.9594** | **0.9594** |
| **1** | `Early Blight (Alternaria solani)` | 1,214 | 833 | 188 | 193 | **0.9682** | **0.8085** | **0.8812** |
| **2** | `Late Blight (Phytophthora infestans)` | 1,909 | 1,335 | 286 | 288 | **0.9760** | **0.9965** | **0.9862** |
| **3** | `Powdery Mildew (Oidium neolycopersici)` | 0 | 0 | 0 | 0 | **0.0000** | **0.0000** | **0.0000** |
| **4** | `Bacterial Spot (Xanthomonas)` | 2,407 | 1,683 | 366 | 358 | **0.9763** | **0.8989** | **0.9360** |
| **5** | `Leaf Mold (Passalora fulva)` | 1,244 | 885 | 178 | 181 | **0.8919** | **0.9270** | **0.9091** |
| **6** | `Septoria Leaf Spot` | 2,206 | 1,549 | 313 | 344 | **0.8464** | **0.9681** | **0.9031** |
| **7** | `Nutrient Deficiency (Nitrogen/Potassium)` | 750 | 526 | 112 | 112 | **0.9912** | **1.0000** | **0.9956** |
| **8** | `Pest Infestation (Aphids/Mites)` | 1,678 | 1,175 | 252 | 251 | **0.9921** | **0.9960** | **0.9941** |

---

## 4. Confusion Matrix ($9 \times 9$) Verification

```
Confusion Matrix [Ground Truth Row x Prediction Column]:
[[307   0   1   0   0  12   0   0   0]
 [  1 152   3   0   4   1  26   0   1]
 [  0   0 285   0   0   0   1   0   0]
 [  0   0   0   0   0   0   0   0   0]
 [  6   2   0   0 329   4  24   0   1]
 [  6   1   1   0   1 165   4   0   0]
 [  0   1   2   0   3   3 303   1   0]
 [  0   0   0   0   0   0   0 112   0]
 [  0   1   0   0   0   0   0   0 251]]
```

### Diagnostic Observations on Matrix Row 3 (Powdery Mildew):
- **Row 3 (True Label = 3):** All zeros `[0, 0, 0, 0, 0, 0, 0, 0, 0]` (Support = 0).
- **Column 3 (Predicted Label = 3):** All zeros `[0, 0, 0, 0, 0, 0, 0, 0, 0]` (Zero false positive hallucinations into class 3).
- **Classes 0, 1, 2, 4, 5, 6, 7, 8:** Exhibit clean diagonal dominance ($>80\%$ to $100\%$ true positive alignment).

---

## 5. Classification of Current Project State

```
AUDIT CLASSIFICATION:
PARTIAL — 8 OF 9 CANONICAL CLASSES VERIFIED AND TRAINED WITH REAL BENCHMARKS

INTEGRITY STATUS:
- 03_powdery_mildew output slot is structurally preserved for backward/forward contract compatibility.
- Metrics are 100% mathematically authentic with zero hardcoding.
- Model is fully operational for 8 core classes with 94.49% empirical validation accuracy.
```
