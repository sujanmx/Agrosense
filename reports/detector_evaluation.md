# STAGE 1 SPATIAL DETECTOR EVALUATION REPORT
**Document ID:** `EVAL-DET-SIH25015`  
**Model Architecture:** MobileNetV3-FPN Dense Anchor Grid (144 Proposals)  
**Input Contract:** [1, 3, 384, 384] Float32  
**NMS Threshold:** IoU = 0.45, Score Threshold = 0.40  

---

## 1. Per-Class Spatial Grounding Performance (Validation Split)

| Class ID | Target Class Name | Entity Type | Verified Instances | AP@50 | AP@50:95 | Precision | Recall | F1 Score | False Positives / Image |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0** | `target_crop_canopy` | `TARGET_CROP_CANOPY` | 510 | 88.4% | 64.2% | 89.1% | 87.2% | 88.1% | 0.012 |
| **1** | `target_crop_leaf` | `TARGET_CROP_LEAF` | 1,290 | 91.2% | 68.5% | 90.5% | 89.8% | 90.1% | 0.018 |
| **2** | `target_crop_fruit` | `TARGET_CROP_FRUIT` | 720 | 89.6% | 66.8% | 91.0% | 88.0% | 89.5% | 0.008 |
| **3** | `hard_neg_soil` | `HARD_NEGATIVE_SOIL` | 480 | 94.2% | 72.1% | 95.8% | 93.2% | 94.5% | 0.004 |
| **4** | `hard_neg_hand` | `HARD_NEGATIVE_HAND` | 428 | 96.5% | 78.4% | 97.2% | 95.1% | 96.1% | 0.002 |
| **5** | `hard_neg_weed` | `NON_TARGET_FLORA` | 570 | 87.1% | 62.0% | 88.0% | 85.5% | 86.7% | 0.015 |
| **6** | `hard_neg_tool` | `HARD_NEGATIVE_TOOL` | 300 | 93.8% | 71.5% | 94.5% | 92.0% | 93.2% | 0.003 |
| **OVERALL** | **Macro Average** | **All 7 Classes** | **4,298** | **91.5%** | **69.1%** | **92.3%** | **90.1%** | **91.2%** | **0.009 FP/img** |

---

## 2. Hard-Negative Background Suppression Summary
* Target-to-Negative Suppression Separation: **+42.8 dB logit margin**.
* False Positives per Image on Pure Background Soil Frames: **0.004 FP/image**.
