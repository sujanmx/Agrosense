# QUALITATIVE ERROR ANALYSIS & FAILURE MODE TAXONOMY
**Document ID:** `ERR-ANALYSIS-SIH25015`  

---

## 1. Quantified Failure Mode Breakdown (1,200 Validation Samples)

| Failure Mode Category | Occurrences | Percentage of Total Val | Underlying Morphological Root Cause | Severity | Engineering Mitigation |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **Early Blight vs Septoria Spot Confusion** | 18 cases | 1.50% | Small juvenile Early Blight concentric lesions mimic Septoria circular halos before target rings fully form. | Low | Multi-frame temporal smoothing aggregates evidential certainty over 8 frames. |
| **Nutrient Chlorosis vs Yellow Curl** | 14 cases | 1.17% | Interveinal yellowing patterns share similar diffuse reflectance signatures. | Low | Diagnostic card provides hedged guidance ("Likely Nutrient Deficiency"). |
| **Powdery Mildew on Dried Bird Droppings** | 6 cases | 0.50% | White mineral deposit mimics superficial fungal mycelium. | Medium | Helmholtz Free Energy flags irregular morphology as Indeterminate ($E \ge -4.5$). |
| **Leaf Edge Sunscald vs Late Blight** | 12 cases | 1.00% | Severe solar tissue necrosis mimics water-soaked oomycete collapse. | Medium | Stage 0 Optical Luma Gate rejects frames with extreme solar glare ($Y > 235$). |
| **Weed Dicot vs Tomato Leaf Confusion** | 15 cases | 1.25% | Solanaceae weeds (e.g., Black Nightshade) share leaflet morphology. | Low | Bounding box aspect ratio filter ($0.22 \le 	ext{AR} \le 4.5$) suppresses irregular weeds. |
| **Total Failure Instances** | **65 cases** | **5.42%** | **94.58% Clean Operational Accuracy** | — | — |
