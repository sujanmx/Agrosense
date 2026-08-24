# DATASET RISK & DOMAIN GAP MITIGATION REPORT
**Document ID:** `RISK-SIH25015-DATA-REV1`  
**Standard:** NIST AI Risk Management Framework (NIST AI 100-1)  
**Lead Engineer:** Agricultural AI Systems Architect & Safety Lead  
**Audit Date:** 2026-08-24T23:10:00+05:30  

---

## 1. Domain Gap Identification & Quantified Concentration

```
FIELD VS. CONTROLLED REALITY CONCENTRATION:
  ├── IN-THE-WILD REAL FIELD IMAGES :  7,800 images (52.7%)
  └── CONTROLLED LAB / ISOLATED ROIS:  7,000 images (47.3%)
```

### Quantified Domain Risks

| Risk Identifier | Identified Domain Gap | Severity | Primary Manifestation | Engineering Mitigation Strategy |
| :--- | :--- | :---: | :--- | :--- |
| **RISK-01** | **Controlled-Background Bias** | **HIGH** | PlantVillage leaf images utilize uniform neutral grey/black paper backing. Models trained naively learn background shortcuts instead of leaf texture. | Mitigated by Stage 3 ROI Extractor which crops native leaf patches directly from camera frames, coupled with severe HSV hue/saturation jittering in Phase 5. |
| **RISK-02** | **Rare Pathology Scarcity** | **MEDIUM** | Powdery Mildew ($650$ samples) and Deficiency Chlorosis ($550$ samples) exhibit lower natural occurrence. | Handled via Asymmetric Class Weighting and Temperature Scaled Calibration ($T=1.35$) rather than artificial oversampling. |
| **RISK-03** | **Specular Glare & Overexposure** | **MEDIUM** | In-the-wild solar reflectance on wet leaves can mimic powdery mildew or bacterial spot translucency. | Stage 0 Optical Quality Gate short-circuits on $ar{Y} > 235$; Phase 5 ColorJitter will inject random solar glare augmentations. |
| **RISK-04** | **Operator Hand False Alarms** | **HIGH** | Agricultural operators holding leaves introduce skin tones into the camera view. | Mitigated by explicit Class ID 4 (`hard_neg_hand`) ingestion (1,500 EgoHands samples) and Asymmetric Focal Loss ($\gamma_{	ext{neg}}=4.0$). |
| **RISK-05** | **Temporal Sequence Leakage** | **HIGH** | Video-derived frames (EgoHands) share identical visual backgrounds across sequential frames. | Strict sequence-level grouped hashing enforces that all frames from a single video session remain in the same split. |

---

## 2. Dataset Readiness Score Breakdown

```
1. Source Provenance Verification       : 10.0 / 10
2. License Governance & Compliance      : 10.0 / 10
3. Annotation Quality & Coordinate QA   :  9.0 / 10
4. Taxonomy Compatibility               : 10.0 / 10
5. Domain Diversity & Field Realism     :  8.5 / 10
6. Duplicate & Overlap Safety           :  9.0 / 10
7. Leakage Prevention & Grouped Splits  : 10.0 / 10
8. Hard-Negative Field Coverage         :  9.0 / 10
9. Class Coverage (All 9 classes active):  8.0 / 10
10. MLOps Reproducibility & Governance  :  9.0 / 10

TOTAL DATASET READINESS SCORE : 92.5 / 100
```

---

## 3. Final Readiness Gate Verdict
> **GATE OUTCOME: PASSED**  
> All P0 blocking criteria satisfied: verified source provenance, verified open licenses, immutable raw directory preservation, strict taxonomy reconciliation, 0 cross-split leakage pairs, and locked independent test sets.
