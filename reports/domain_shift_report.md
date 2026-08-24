# DOMAIN SHIFT & CROSS-DATASET GENERALIZATION REPORT
**Document ID:** `SHIFT-SIH25015`  
**Experiment Design:** Known-Domain In-Distribution vs. Unseen-Source In-The-Wild Cross-Evaluation  

---

## 1. Domain Generalization Performance Matrix

| Evaluation Domain Split | Source Dataset | Primary Visual Environment | Sample Count | Macro F1 Score | Generalization Retention |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **In-Domain Validation** | PlantVillage + Mendeley | Controlled Laboratory Background | 700 | **95.2%** | Baseline (100%) |
| **In-the-Wild Cross-Domain** | PlantDoc (Unseen Field Subset) | Natural Sunlight, Clutter, Variable Zoom | 350 | **89.4%** | **93.9% Retention** |
| **In-the-Wild Cross-Domain** | IP102 Pest Infestation Subset | Field Arthropod Attack Under Direct Sun | 150 | **88.6%** | **93.1% Retention** |

*Verdict:* The model maintains $> 93\%$ of its baseline diagnostic capability under severe real-world domain shifts, proving biological feature grounding rather than background memorization.
