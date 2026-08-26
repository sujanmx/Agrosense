# Phase 09B-8F — Leakage-Safe Stratified Manifest Repartitioning Audit Report

> **Document ID:** `AUDIT-PHASE09B8F-V2-SPLIT`  
> **Lead ML Dataset Architect & MLOps Auditor:** Senior Computer Vision Dataset Engineer  
> **Standard:** ISO/IEC 5259 Data Quality for ML / FAIR Data Principles / NIST AI RMF 1.0  
> **Execution Date:** 2026-08-26  
> **Versioned Output:** `data/manifests/v2/`  
> **Execution Status:** **PASS — ZERO LEAKAGE (ALL 9 PATHOLOGY CLASSES POPULATED)**

---

## 1. Executive Summary & Dataset Evolution

The 1,256 verified real-world **Tomato Powdery Mildew (*Oidium neolycopersici*)** leaf images from `SRC_06_TLID` were successfully integrated into the canonical dataset pool. A fresh, deterministic, leakage-safe stratified repartitioning was performed across all 9 canonical pathology classes into **`data/manifests/v2/`**.

### Verification Highlights:
1. **Dataset Pool Expansion:** Grew from **15,996 images (Phase 09B-7A)** to **17,252 images (Phase 09B-8F)** (+1,256 verified real leaf images).
2. **100% Pathology Class Support (9 of 9 Classes):** Canonical Class `03_powdery_mildew` now has full active representation across all partitions:
   - **Train:** **879 images** (70.0%)
   - **Validation:** **188 images** (15.0%)
   - **Test:** **189 images** (15.0%)
3. **Zero Cryptographic Leakage:** $\text{Train} \cap \text{Validation} = 0$, $\text{Train} \cap \text{Test} = 0$, $\text{Validation} \cap \text{Test} = 0$.
4. **Strict Task Separation:** `plant_detector` (2,601 full frames) and `pathology_classifier` (14,651 leaf ROIs) are strictly isolated.
5. **Audit Trail Preservation:** Previous V1 manifests in `data/manifests/` remain **100% immutable and untouched**.

---

## 2. Quantitative Split Breakdown (Overall)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                V2 DATASET PARTITIONING OVERVIEW                                  │
├──────────────────────────┬──────────────────┬──────────────────────┬─────────────────────────────┤
│ PARTITION                │ SAMPLE COUNT     │ PROPORTION           │ TARGET TASK BREAKDOWN       │
├──────────────────────────┼──────────────────┼──────────────────────┼─────────────────────────────┤
│ Training Set (Train)     │ 12,079 images   │ 70.02% (Target ~70%) │ 10,258 Pathology / 1,821 Detector│
│ Validation Set (Val)     │  2,589 images   │ 15.01% (Target ~15%) │  2,203 Pathology /   386 Detector│
│ Test Set (Independent)   │  2,584 images   │ 14.98% (Target ~15%) │  2,190 Pathology /   394 Detector│
├──────────────────────────┼──────────────────┼──────────────────────┼─────────────────────────────┤
│ TOTAL V2 DATASET POOL    │ 17,252 images   │ 100.00%              │ 14,651 Pathology / 2,601 Detector│
└──────────────────────────┴──────────────────┴──────────────────────┴─────────────────────────────┘
```

---

## 3. Per-Class Distribution Scorecard (All 9 Canonical Classes + Detector)

| Canonical Class Name | Target Task | Train (70%) | Val (15%) | Test (15%) | Total Count | Verification Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `00_healthy_target_crop` | `pathology_classifier` | **1,393** | **320** | **274** | **1,987** | 🟢 100% ACTIVE |
| `01_early_blight` | `pathology_classifier` | **833** | **188** | **193** | **1,214** | 🟢 100% ACTIVE |
| `02_late_blight` | `pathology_classifier` | **1,335** | **286** | **288** | **1,909** | 🟢 100% ACTIVE |
| `03_powdery_mildew` | `pathology_classifier` | **879** | **188** | **189** | **1,256** | 🟢 100% ACTIVE |
| `04_bacterial_spot` | `pathology_classifier` | **1,683** | **366** | **358** | **2,407** | 🟢 100% ACTIVE |
| `05_leaf_mold` | `pathology_classifier` | **885** | **178** | **181** | **1,244** | 🟢 100% ACTIVE |
| `06_septoria_leaf_spot` | `pathology_classifier` | **1,549** | **313** | **344** | **2,206** | 🟢 100% ACTIVE |
| `07_nutrient_deficiency` | `pathology_classifier` | **526** | **112** | **112** | **750** | 🟢 100% ACTIVE |
| `08_pest_infestation` | `pathology_classifier` | **1,175** | **252** | **251** | **1,678** | 🟢 100% ACTIVE |
| `DETECTOR_FULL_FRAME` | `plant_detector` | **1,821** | **386** | **394** | **2,601** | 🟢 100% ACTIVE |

---

## 4. Pipeline & Task Separation

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PIPELINE TASK SEPARATION MATRIX                                  │
├──────────────────────────┬──────────────────┬──────────────────┬──────────────────┬──────────────┤
│ TARGET PIPELINE TASK     │ TRAIN COUNT      │ VAL COUNT        │ TEST COUNT       │ TOTAL IMAGES │
├──────────────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────┤
│ `pathology_classifier`   │ 10,258 images   │  2,203 images   │  2,190 images   │ 14,651 images │
│ `plant_detector`         │  1,821 images   │    386 images   │    394 images   │  2,601 images │
├──────────────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────┤
│ COMBINED TOTAL           │ 17,252 images   │  2,589 images   │  2,584 images   │ 17,252 images │
└──────────────────────────┴──────────────────┴──────────────────────┴──────────────────┴──────────────┘
```

---

## 5. Source Dataset Distribution

| Source Dataset ID | Train Count | Val Count | Test Count | Total Ingested | Primary Contribution |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `SRC_01_PLANTDOC` | 2,937 | 628 | 632 | **4,197** | In-the-wild crops & full frame bounding boxes |
| `SRC_02_PLANTVILLAGE` | 8,245 | 1,770 | 1,761 | **11,776** | Single leaf foliar pathology ROIs |
| `SRC_03_LABORO_TOMATO` | 18 | 3 | 2 | **23** | Agricultural benchmark imagery |
| `SRC_06_TLID` | 879 | 188 | 189 | **1,256** | Greenhouse tomato powdery mildew leaf images |

---

## 6. Cryptographic Leakage & Group Overlap Audit

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               CRYPTOGRAPHIC DATA LEAKAGE AUDIT TABLE                             │
├─────────────────────────────────────────┬──────────────────────┬─────────────────────────────────┤
│ AUDIT CHECK                             │ VALUE DETECTED       │ COMPLIANCE STATUS               │
├─────────────────────────────────────────┼──────────────────────┼─────────────────────────────────┤
│ Exact SHA-256 Overlap (Train ∩ Val)     │ 0 collisions         │ 🟢 ZERO LEAKAGE (PASS)          │
│ Exact SHA-256 Overlap (Train ∩ Test)    │ 0 collisions         │ 🟢 ZERO LEAKAGE (PASS)          │
│ Exact SHA-256 Overlap (Val ∩ Test)      │ 0 collisions         │ 🟢 ZERO LEAKAGE (PASS)          │
│ Specimen Group Overlap (Train ∩ Val)    │ 0 collisions         │ 🟢 ZERO GROUP LEAKAGE (PASS)    │
│ Specimen Group Overlap (Train ∩ Test)   │ 0 collisions         │ 🟢 ZERO GROUP LEAKAGE (PASS)    │
│ Specimen Group Overlap (Val ∩ Test)     │ 0 collisions         │ 🟢 ZERO GROUP LEAKAGE (PASS)    │
└─────────────────────────────────────────┴──────────────────────┴─────────────────────────────────┘
```

---

## 7. Versioned Manifest Manifest Hashes

- **`data/manifests/v2/train.jsonl`:** `SHA-256: f4271f58e26f9eb2b36050ef47e6722923bcea81521cbad1c7eff3685e804c4e` (12,079 lines)
- **`data/manifests/v2/validation.jsonl`:** `SHA-256: 2e93e61419cbd30551ee366739c473f8a87defeaa7295f657b5bf7d8a5cd41e5` (2,589 lines)
- **`data/manifests/v2/test.jsonl`:** `SHA-256: 37573a203465cdb0e29d1f9bdcf14f63aa8d387aefe9c825e3721a9a8c743e6c` (2,584 lines)

### Preserved Immutable V1 Manifest Hashes:
- `data/manifests/train.jsonl`: `SHA-256: beab482292d5a417ce0e884ca275a2d1f0ed76c0801de79bc5ad56d764068344`
- `data/manifests/validation.jsonl`: `SHA-256: 453374d54e653bb99e5718b98b36e028573d42c186a7616baf2dc77dbdcf5811`
- `data/manifests/test.jsonl`: `SHA-256: 05e0839ea61ed73cfd944cf714358d99c7db1200ba774049777cfbde7bcca49b`

---

## Final Partitioning Sign-off

```
FINAL STATUS:
PASS — ZERO LEAKAGE

CLASS SUPPORT:
9 OF 9 PATHOLOGY CLASSES FULLY POPULATED IN TRAIN, VALIDATION, AND TEST

NEXT PHASE:
READY FOR FULL 9-CLASS VERIFIED MODEL RETRAINING (PHASE 09B-8G)
```
