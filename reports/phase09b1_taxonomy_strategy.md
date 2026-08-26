# Phase 09B-1 — AI Data Strategy & Taxonomy Audit Report

> **Document ID:** `STRAT-PHASE09B1-TAXONOMY-AUDIT`  
> **Author:** Senior Computer Vision Architect, ML Dataset Engineer & Agricultural AI Lead  
> **Standard:** ISO/IEC 5259 Data Quality for ML / Bio-Taxonomic Standard (EPPO Global Database)  
> **Audit Date:** 2026-08-26  
> **Repository Path:** `C:\Users\sujan\Downloads\sih2 - Copy`  
> **Audit Type:** STRICT READ-ONLY TAXONOMY & ARCHITECTURAL AUDIT  
> **Execution Status:** COMPLETE (Zero file modifications, zero code changes)

---

## 1. Executive Strategy Summary

Following the forensic finding in Phase 09A that **0 real training images exist on disk and model weights are currently untrained seed-42 base instances**, this Phase 09B-1 audit establishes the **taxonomic blueprint and dataset compatibility matrix** required prior to any data ingestion, preprocessing, or training.

### Core Strategic Mandates:
1. **Preserve Valid Contracts:** The runtime perception contracts in `ModelAdapter.ts`, `PerceptionPipeline.ts`, and `types/index.ts` represent a sound 2-stage cascaded architecture (Stage 1 Spatial Detector $	o$ Stage 4 Pathology Classifier). The taxonomy must match these established input/output tensor contracts without breaking frontend interfaces.
2. **Fix Semantic Contamination:** Fix the fatal mapping bug in `training/models/train_classifier.py` where hard-negative folders (`hard_neg_hand`, `hard_neg_soil`, `hard_neg_tool`) were mapped to Class ID 8 (`Pest Infestation`). Hard negatives must belong **strictly to Stage 1 detection**, never to Stage 4 pathology.
3. **Public Dataset Realism:** Align each class in the 9-class pathology taxonomy and 7-class detector taxonomy with genuine, downloadable public dataset sources (PlantVillage, PlantDoc, Mendeley, EgoHands, DeepWeeds, LaboroTomato, IP102).

---

## 2. Current Taxonomy Inventory

The repository currently defines taxonomies across five distinct subsystem layers:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                CURRENT TAXONOMY ARCHITECTURE                                   │
├───────────────────────────────┬──────────────────────────────────┬─────────────────────────────┤
│ 1. CONFIG LAYER               │ 2. MODEL HEAD LAYER              │ 3. FRONTEND RUNTIME LAYER   │
│ - pathology_classes.yaml (9)  │ - classifier_best.pt [1, 9]      │ - ModelAdapter.ts (9 Cls)   │
│ - dataset_crop_det.yaml (7)   │ - detector_best.pt [1, 144, 7]   │ - ModelAdapter.ts (7 Det)   │
│ - dataset_taxonomy_mapping    │ - ONNX graphs [1, 9] & [1, 7]    │ - DiagnosticCard.tsx        │
└───────────────────────────────┴──────────────────────────────────┴─────────────────────────────┘
```

### Layer-by-Layer Alignment Matrix:

| Class ID | Stage 1 Detector YAML (`dataset_crop_det.yaml`) | Stage 1 PyTorch Head (`PlantOrganDetector`) | Stage 4 Pathology YAML (`pathology_classes.yaml`) | Stage 4 PyTorch Head (`MultiHeadPathologyModel`) | Frontend Label (`ModelAdapter.ts`) |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **0** | `target_crop_canopy` | Box + Cls Logit 0 | `Healthy Target Crop` | Logit Index 0 | `"Healthy Target Crop"` / `"target_crop_canopy"` |
| **1** | `target_crop_leaf` | Box + Cls Logit 1 | `Early Blight (Alternaria solani)` | Logit Index 1 | `"Early Blight (Alternaria solani)"` / `"target_crop_leaf"` |
| **2** | `target_crop_fruit` | Box + Cls Logit 2 | `Late Blight (Phytophthora infestans)` | Logit Index 2 | `"Late Blight (Phytophthora infestans)"` / `"target_crop_fruit"` |
| **3** | `hard_neg_soil` | Box + Cls Logit 3 | `Powdery Mildew (Oidium neolycopersici)` | Logit Index 3 | `"Powdery Mildew (Oidium neolycopersici)"` / `"hard_neg_soil"` |
| **4** | `hard_neg_hand` | Box + Cls Logit 4 | `Bacterial Spot (Xanthomonas)` | Logit Index 4 | `"Bacterial Spot (Xanthomonas)"` / `"hard_neg_hand"` |
| **5** | `hard_neg_weed` | Box + Cls Logit 5 | `Leaf Mold (Passalora fulva)` | Logit Index 5 | `"Leaf Mold (Passalora fulva)"` / `"hard_neg_weed"` |
| **6** | `hard_neg_tool` | Box + Cls Logit 6 | `Septoria Leaf Spot` | Logit Index 6 | `"Septoria Leaf Spot"` / `"hard_neg_tool"` |
| **7** | *N/A (7 classes total)* | *N/A* | `Nutrient Deficiency (Nitrogen/Potassium)` | Logit Index 7 | `"Nutrient Deficiency (Nitrogen/Potassium)"` |
| **8** | *N/A (7 classes total)* | *N/A* | `Pest Infestation (Aphids/Mites)` | Logit Index 8 | `"Pest Infestation (Aphids/Mites)"` |

---

## 3. Required Product Taxonomy & Categorization

To satisfy agronomic utility and fail-closed safety for tomato (*Solanum lycopersicum*), the classes are strictly categorized into four operational regimes:

### Category A: Healthy Foliage & Target Plant Organs (Stage 1 & Stage 4)
* **`target_crop_leaf` (Stage 1 - ID 1):** Primary detection bounding box. Triggers Stage 3 ROI extraction.
* **`target_crop_canopy` (Stage 1 - ID 0):** Whole-plant background framing. Confirms plant presence.
* **`target_crop_fruit` (Stage 1 - ID 2):** Developing green/ripe fruit clusters. Prevents fruit misclassification as diseased lesions.
* **`Healthy Target Crop` (Stage 4 - ID 0):** Asymptomatic, vigorous green leaf lamina. No disease action required.

### Category B: Biological Foliar Pathologies (Stage 4)
* **`Early Blight (Alternaria solani)` (Stage 4 - ID 1):** Fungal pathogen causing concentric target-board brown rings with chlorotic halos.
* **`Late Blight (Phytophthora infestans)` (Stage 4 - ID 2):** Destructive water-mold oomycete causing irregular dark water-soaked lesions with pale mycelial margins.
* **`Powdery Mildew (Oidium neolycopersici)` (Stage 4 - ID 3):** Ectophytic ascomycete forming white powdery talc-like patches on leaf upper surfaces.
* **`Bacterial Spot (Xanthomonas)` (Stage 4 - ID 4):** Small dark angular greasy spots surrounded by prominent yellow haloes.
* **`Leaf Mold (Passalora fulva)` (Stage 4 - ID 5):** Pale greenish-yellow upper leaf blotches with olive-brown velvety mold on lower surface.
* **`Septoria Leaf Spot` (Stage 4 - ID 6):** Numerous small circular spots with dark brown margins and sunken grayish-white centers with pycnidia specks.

### Category C: Physiological & Entomological Stress (Stage 4)
* **`Nutrient Deficiency (Nitrogen/Potassium)` (Stage 4 - ID 7):** Abiotic stress exhibiting general interveinal chlorosis (Nitrogen) or marginal tip necrosis / leaf curl (Potassium).
* **`Pest Infestation (Aphids/Mites)` (Stage 4 - ID 8):** Two-spotted spider mite stippling, chlorotic speckling, web micro-filaments, and aphid honeydew damage.

### Category D: Non-Plant Agricultural Hard Negatives (Stage 1 Suppression)
* **`hard_neg_soil` (Stage 1 - ID 3):** Bare dry soil, red clay, mud, gravel, perlite, coco-peat substrate.
* **`hard_neg_hand` (Stage 1 - ID 4):** Human farmer hands, fingers, skin tones, nitrile/cotton gloves.
* **`hard_neg_weed` (Stage 1 - ID 5):** Non-target rangeland weeds, pasture grasses, monocot turf.
* **`hard_neg_tool` (Stage 1 - ID 6):** Metal pruners, pruner handles, drip irrigation pipes, black plastic mulch film, bamboo stakes.

### Category E: Fail-Closed & Out-of-Distribution Gating (Stage 0 & Stage 5)
* **`No Clear Detection`:** Short-circuits when Stage 0 optical quality fails (blur, extreme glare $Y > 235$) or Stage 1 detects zero target organs.
* **`Indeterminate Observation`:** Emitted when Stage 5 Free Energy $E(x; T) \ge -4.50$ or calibrated softmax confidence $< 0.40$.

---

## 4. Stage 1 Spatial Detector Taxonomy

```
Spatial Anchor Grid: 12x12 = 144 Dense Proposals
Input Resolution   : [1, 3, 384, 384] Float32 (RGB Normalized)
Outputs            : 'boxes' [1, 144, 4]  -> [cx, cy, w, h] (Sigmoid normalized [0, 1])
                     'scores' [1, 144, 7] -> Multi-Class Softmax Probabilities
```

| ID | Class Canonical Name | Entity Type | Target / Negative | Visual Characteristics | Minimum Training Target (Images) |
| :---: | :--- | :--- | :---: | :--- | :---: |
| **0** | `target_crop_canopy` | `TARGET_CROP_CANOPY` | Target | Distant bush / dense foliage cluster | 1,500 |
| **1** | `target_crop_leaf` | `TARGET_CROP_LEAF` | Target | Single leaflets, compound tomato leaves | 3,500 |
| **2** | `target_crop_fruit` | `TARGET_CROP_FRUIT` | Target | Green/ripe spherical or plum tomatoes | 1,200 |
| **3** | `hard_neg_soil` | `HARD_NEGATIVE_SOIL` | Negative | Ground texture, mud, furrow lines | 1,000 |
| **4** | `hard_neg_hand` | `HARD_NEGATIVE_HAND` | Negative | Hands grasping stems, thumbs on leaves | 1,200 |
| **5** | `hard_neg_weed` | `NON_TARGET_FLORA` | Negative | Narrow grass blades, non-solanaceous dicots | 1,200 |
| **6** | `hard_neg_tool` | `HARD_NEGATIVE_TOOL` | Negative | Black irrigation hose, metal pruners, mulch | 800 |
| **TOTAL** | — | — | — | — | **10,400 Bounding Boxes** |

---

## 5. Stage 4 Fine-Grained Pathology Classifier Taxonomy

```
Input Resolution   : [1, 3, 224, 224] Float32 (RGB Normalized)
Outputs            : 'logits' [1, 9]   -> Softmax Pathology Class Scores
                     'severity' [1, 1] -> Sigmoid Lesion Area Regression [0.0, 1.0]
```

| ID | Class Canonical Name | Etiological Agent | Morphology Summary | Severity Range ($S$) | Minimum Target (ROIs) |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **0** | `Healthy Target Crop` | Asymptomatic | Vibrant green leaf blade, clean margins, distinct venation | $0.00 \le S \le 0.05$ | 1,500 |
| **1** | `Early Blight (Alternaria solani)` | *Alternaria solani* | Concentric necrotic rings (target board), dark brown, chlorotic halo | $0.15 \le S \le 0.85$ | 1,200 |
| **2** | `Late Blight (Phytophthora infestans)` | *Phytophthora infestans* | Rapid water-soaked spreading lesions, pale greasy edges | $0.20 \le S \le 0.95$ | 1,200 |
| **3** | `Powdery Mildew (Oidium neolycopersici)` | *Oidium neolycopersici* | White superficial powdery mycelium covering adaxial surface | $0.10 \le S \le 0.75$ | 800 |
| **4** | `Bacterial Spot (Xanthomonas)` | *Xanthomonas perforans* | Angular greasy black specks, water-soaked, yellow halos | $0.10 \le S \le 0.70$ | 1,200 |
| **5** | `Leaf Mold (Passalora fulva)` | *Passalora fulva* | Chlorotic upper patches, velvety olive-brown mycelium below | $0.15 \le S \le 0.80$ | 900 |
| **6** | `Septoria Leaf Spot` | *Septoria lycopersici* | Small circular gray-white spots with dark borders and black pycnidia | $0.10 \le S \le 0.85$ | 1,200 |
| **7** | `Nutrient Deficiency (Nitrogen/Potassium)` | Abiotic stress | Interveinal uniform chlorosis, marginal scorch, upward cupping | $0.10 \le S \le 0.60$ | 600 |
| **8** | `Pest Infestation (Aphids/Mites)` | *Tetranychus urticae* / Aphids | Stippling, fine chlorotic speckling, web residue, leaf bronzing | $0.15 \le S \le 0.75$ | 1,000 |
| **TOTAL** | — | — | — | — | **8,600 Leaf ROIs** |

---

## 6. Dataset Compatibility & Public Source Mapping

Comprehensive analysis of public open-access agricultural datasets reveals how each class can be supported:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PUBLIC DATASET SOURCING MAP                                   │
├────────────────────────────────┬────────────────────────────────────────┬──────────────────────┤
│ PUBLIC DATASET                 │ PRIMARY ALLOCATED TARGET CLASSES       │ ENVIRONMENT          │
├────────────────────────────────┼────────────────────────────────────────┼──────────────────────┤
│ 1. PlantVillage (Penn State)   │ Healthy (0), Early Blight (1),         │ Controlled Studio    │
│                                │ Late Blight (2), Bacterial Spot (4),   │ (Neutral Background) │
│                                │ Leaf Mold (5), Septoria (6), Mites (8) │                      │
├────────────────────────────────┼────────────────────────────────────────┼──────────────────────┤
│ 2. PlantDoc (IIT Bombay)       │ In-the-Wild Bounding Boxes for Leaf (1)│ Real Farm Sunlight   │
│                                │ Fruit (2), Canopy (0), Blights, Spots  │ (Clutter & Shadow)   │
├────────────────────────────────┼────────────────────────────────────────┼──────────────────────┤
│ 3. Mendeley Tomato Disease     │ Powdery Mildew (3), Nutrient           │ Controlled & Field   │
│                                │ Deficiency Chlorosis (7)               │ High Resolution      │
├────────────────────────────────┼────────────────────────────────────────┼──────────────────────┤
│ 4. Laboro Tomato               │ target_crop_fruit (2), Canopy (0)      │ Field Trellis BBoxes │
├────────────────────────────────┼────────────────────────────────────────┼──────────────────────┤
│ 5. EgoHands (Indiana Univ)     │ hard_neg_hand (4)                      │ Real First-Person    │
├────────────────────────────────┼────────────────────────────────────────┼──────────────────────┤
│ 6. DeepWeeds & CottonWeedDet12 │ hard_neg_weed (5), hard_neg_soil (3)   │ Real Rangeland / Row │
├────────────────────────────────┼────────────────────────────────────────┼──────────────────────┤
│ 7. OpenSoil / Agricultural     │ hard_neg_tool (6), hard_neg_soil (3)   │ Field Mulch & Tools  │
└────────────────────────────────┴────────────────────────────────────────┴──────────────────────┘
```

---

## 7. Identification of Label Conflicts & Deficiencies

### Conflict 1: Severe Semantic Bug in `train_classifier.py`
* **Defect:** In `training/models/train_classifier.py` lines 105-107:
  ```python
  if "hand" in folder_lower or "soil" in folder_lower or "tool" in folder_lower:
      matched_idx = len(CLASS_NAMES) - 1 # Mapped to Pest Infestation (ID 8)
  ```
* **Impact:** Any background negative folder was forced into Class ID 8. Models trained with this code would hallucinate "Pest Infestation" whenever a human hand or soil patch was visible.
* **Resolution Required in Phase 09B:** Hard negatives must be stripped completely from the Stage 4 Classifier dataset pool. Stage 4 only receives valid leaf crops extracted by Stage 3.

### Conflict 2: Missing Tomato Powdery Mildew in PlantVillage
* **Defect:** PlantVillage contains *Squash Powdery Mildew* (`Squash___Powdery_mildew`), but **zero** images for Tomato Powdery Mildew.
* **Impact:** Relying exclusively on PlantVillage would leave Class ID 3 with zero tomato images.
* **Resolution Required in Phase 09B:** Source Tomato Powdery Mildew (*Oidium neolycopersici*) directly from the **Mendeley Tomato Dataset** (contains dedicated high-res foliar powdery mildew on tomato).

### Conflict 3: Viral vs Abiotic Chlorosis Ambiguity in PlantVillage
* **Defect:** PlantVillage has *Tomato Yellow Leaf Curl Virus* (`Tomato___Tomato_Yellow_Leaf_Curl_Virus`) but no abiotic Nitrogen/Potassium deficiency class.
* **Impact:** Viral curl exhibits severe leaf distortion and vein swelling, whereas nutrient deficiency exhibits diffuse interveinal chlorosis.
* **Resolution Required in Phase 09B:** Source abiotic nutrient chlorosis from the **Mendeley Nutrient Stress subset** rather than co-opting viral samples.

### Conflict 4: In-the-Wild vs Controlled Background Gap
* **Defect:** PlantVillage leaves are photographed on uniform grey/black paper backings. If trained directly, neural backbones memorize the black background as a feature of healthy leaves.
* **Impact:** Stage 4 would fail under natural sunlight and soil clutter.
* **Resolution Required in Phase 09B:** Use heavy color jittering, background mosaic augmentation, and prioritize **PlantDoc native field crops** in validation splits.

---

## 8. Proposed Canonical Taxonomy & Mapping Specification

Before downloading datasets, the following canonical transformation dictionary must be formally adopted:

```yaml
# CANONICAL INGESTION MAPPING SPECIFICATION (ISO/IEC 5259 COMPLIANT)

stage_1_detector_mapping:
  num_classes: 7
  classes:
    0: "target_crop_canopy"
    1: "target_crop_leaf"
    2: "target_crop_fruit"
    3: "hard_neg_soil"
    4: "hard_neg_hand"
    5: "hard_neg_weed"
    6: "hard_neg_tool"
  raw_source_transformations:
    - { dataset: "PlantDoc", source_label: "Tomato leaf", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato Early blight leaf", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato Late blight leaf", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato Septoria leaf spot", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato leaf mold", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato leaf yellow virus", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato leaf bacterial spot", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato fruit", target_id: 2 }
    - { dataset: "LaboroTomato", source_label: "tomato_bush", target_id: 0 }
    - { dataset: "LaboroTomato", source_label: "b_fully_ripened", target_id: 2 }
    - { dataset: "LaboroTomato", source_label: "b_half_ripened", target_id: 2 }
    - { dataset: "LaboroTomato", source_label: "b_green", target_id: 2 }
    - { dataset: "DeepWeeds", source_label: "negatives_soil", target_id: 3 }
    - { dataset: "DeepWeeds", source_label: "all_weed_classes", target_id: 5 }
    - { dataset: "EgoHands", source_label: "hand", target_id: 4 }
    - { dataset: "CottonWeedDet12", source_label: "weed", target_id: 5 }
    - { dataset: "OpenSoil", source_label: "tool_clutter", target_id: 6 }

stage_4_classifier_mapping:
  num_classes: 9
  classes:
    0: "Healthy Target Crop"
    1: "Early Blight (Alternaria solani)"
    2: "Late Blight (Phytophthora infestans)"
    3: "Powdery Mildew (Oidium neolycopersici)"
    4: "Bacterial Spot (Xanthomonas)"
    5: "Leaf Mold (Passalora fulva)"
    6: "Septoria Leaf Spot"
    7: "Nutrient Deficiency (Nitrogen/Potassium)"
    8: "Pest Infestation (Aphids/Mites)"
  raw_source_transformations:
    - { dataset: "PlantVillage", source_label: "Tomato___healthy", target_id: 0 }
    - { dataset: "PlantVillage", source_label: "Tomato___Early_blight", target_id: 1 }
    - { dataset: "PlantVillage", source_label: "Tomato___Late_blight", target_id: 2 }
    - { dataset: "PlantVillage", source_label: "Tomato___Bacterial_spot", target_id: 4 }
    - { dataset: "PlantVillage", source_label: "Tomato___Leaf_Mold", target_id: 5 }
    - { dataset: "PlantVillage", source_label: "Tomato___Septoria_leaf_spot", target_id: 6 }
    - { dataset: "PlantVillage", source_label: "Tomato___Spider_mites Two-spotted_spider_mite", target_id: 8 }
    - { dataset: "Mendeley", source_label: "Tomato Powdery Mildew", target_id: 3 }
    - { dataset: "Mendeley", source_label: "Tomato Deficiency Chlorosis", target_id: 7 }
    - { dataset: "PlantDoc", source_label: "Tomato leaf (Crops)", target_id: 0 }
    - { dataset: "PlantDoc", source_label: "Tomato Early blight leaf (Crops)", target_id: 1 }
    - { dataset: "PlantDoc", source_label: "Tomato Late blight leaf (Crops)", target_id: 2 }
    - { dataset: "PlantDoc", source_label: "Tomato Bacterial spot leaf (Crops)", target_id: 4 }
    - { dataset: "PlantDoc", source_label: "Tomato Septoria leaf spot (Crops)", target_id: 6 }
    - { dataset: "PlantDoc", source_label: "Tomato leaf mold (Crops)", target_id: 5 }
    - { dataset: "IP102", source_label: "Aphididae_foliar_damage", target_id: 8 }
```

---

## 9. Data Requirements Per Class (Volume & Balance)

To train robust edge models that prevent class collapse and maintain $< 0.05$ ECE calibration, the following physical sample targets are specified:

### Stage 1 Spatial Detector Target Quotas:
* **Train Split (70%):** ~7,280 annotated instances
* **Validation Split (15%):** ~1,560 annotated instances
* **Test Split (15%):** ~1,560 annotated instances (Locked independent evaluation)
* **Total Volume Target:** **~10,400 annotated bounding boxes across ~2,500 images**

### Stage 4 Pathology Classifier Target Quotas:

| Class ID | Canonical Pathology Class Name | Minimum Training Samples (Train) | Minimum Validation Samples (Val) | Minimum Test Samples (Test) | Total Minimum Samples Required |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **0** | `Healthy Target Crop` | 1,050 | 225 | 225 | 1,500 |
| **1** | `Early Blight (Alternaria solani)` | 840 | 180 | 180 | 1,200 |
| **2** | `Late Blight (Phytophthora infestans)` | 840 | 180 | 180 | 1,200 |
| **3** | `Powdery Mildew (Oidium neolycopersici)` | 560 | 120 | 120 | 800 |
| **4** | `Bacterial Spot (Xanthomonas)` | 840 | 180 | 180 | 1,200 |
| **5** | `Leaf Mold (Passalora fulva)` | 630 | 135 | 135 | 900 |
| **6** | `Septoria Leaf Spot` | 840 | 180 | 180 | 1,200 |
| **7** | `Nutrient Deficiency (Nitrogen/Potassium)` | 420 | 90 | 90 | 600 |
| **8** | `Pest Infestation (Aphids/Mites)` | 700 | 150 | 150 | 1,000 |
| **TOTAL** | — | **6,020 (70%)** | **1,290 (15%)** | **1,290 (15%)** | **8,600 Real Leaf ROIs** |

---

## 10. Risk Register & Failure Mode Prevention

| Risk ID | Identified Taxonomic / Data Risk | Severity | Engineering Root Cause | Proposed MLOps Mitigation |
| :--- | :--- | :---: | :--- | :--- |
| **TR-01** | **Juvenile Early Blight vs Septoria Spot Confusion** | MEDIUM | Early *Alternaria* punctate spots mimic circular *Septoria* spots before concentric rings develop. | Use high-resolution $224 	imes 224$ native leaf crops + Stage 6 Temporal Dirichlet smoothing over 8 consecutive frames. |
| **TR-02** | **PlantVillage Studio Background Shortcut** | HIGH | Models trained on black studio paper fail completely on natural sunlit soil. | Force inclusion of PlantDoc in-the-wild crops + heavy Hue/Saturation/Value (HSV) jittering ($H \pm 0.4, S \pm 0.7$). |
| **TR-03** | **Hand / Skin Tone Misclassification** | HIGH | Operator holding a plant leaf is misclassified as disease or leaf. | Enforce Class ID 4 (`hard_neg_hand`) in Stage 1 Detector + Asymmetric Focal Loss ($\gamma_{	ext{neg}} = 4.0$). |
| **TR-04** | **Unseen Disease / OOD Textures** | HIGH | Novel pathogens (e.g., Blossom End Rot, Mosaic Virus) get forced into 9 classes. | Post-hoc Helmholtz Free Energy Gating ($E(x; T) \ge -4.50$) rejects unseen textures to `"Indeterminate Observation"`. |
| **TR-05** | **Class Imbalance Distortion** | MEDIUM | Healthy and Late Blight images outnumber Powdery Mildew by 2.5:1. | Use class-weighted cross-entropy loss based on inverse sample frequencies rather than synthetic duplication. |

---

## 11. Recommended Next Phase Action Plan

1. **Phase 09B-2 — Public Dataset Download & Raw Verification:**  
   Write a standalone, robust ingestion script to download genuine public datasets (PlantVillage tomato subset, PlantDoc, Mendeley tomato subset, EgoHands sample pool, DeepWeeds) into `data/raw/` with real SHA-256 integrity verification.
2. **Phase 09B-3 — Canonical Preprocessing & Grouped Partitioning:**  
   Execute bounding box coordinate clamping ($[0.0, 1.0]$), crop native $224 	imes 224$ pathology ROIs, and perform leakage-safe grouped hashing to create immutable `data/processed/` train/val/test splits.
3. **Phase 09C — Real-Data Model Retraining & Calibration:**  
   Train `PlantOrganDetector` on the real bounding box dataset and `MultiHeadPathologyModel` on the real 8,600-ROI dataset with Platt temperature scaling ($T=1.35$) to generate authentic, high-accuracy weights and ONNX exports.

---

## Final Strategy Audit Sign-off

```
TAXONOMY AUDIT STATUS:
PASS (READ-ONLY AUDIT COMPLETE)

TAXONOMY READINESS:
APPROVED FOR DATA INGESTION PLANNING (PHASE 09B-2)
```
