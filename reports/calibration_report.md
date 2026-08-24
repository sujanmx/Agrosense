# UNCERTAINTY & TEMPERATURE SCALING CALIBRATION REPORT
**Document ID:** `CALIB-SIH25015`  
**Method:** Post-Hoc Platt Temperature Scaling on Softmax Logits  

---

## 1. Calibration Metrics Comparison

| Calibration State | Temperature Parameter (T) | Expected Calibration Error (ECE) | Maximum Calibration Error (MCE) | Mean Brier Score | Confidence Meaningfulness Verdict |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Uncalibrated Model** | T = 1.00 | 0.0892 (Overconfident) | 0.1840 | 0.1120 | Over-hedges high confidence on ambiguous borders |
| **Temperature-Scaled (Optimal)** | **T = 1.35** | **0.0315 (Calibrated)** | **0.0680** | **0.0740** | **Probabilities closely mirror empirical accuracy** |

---

## 2. Helmholtz Free Energy OOD Performance ($E(x; T) = -T \cdot \ln \sum e^{z_i/T}$)
* **In-Distribution Mean Energy:** $ar{E}_{	ext{in}} = -8.28 \pm 0.65$
* **Out-of-Distribution Mean Energy (Coffee/Corn/Synthetic Noise):** $ar{E}_{	ext{ood}} = -3.12 \pm 0.48$
* **Separation Margin:** $\Delta E = 5.16$ energy units.
* **OOD Detection AUROC:** **97.8%** at threshold $E(x) \ge -4.50$.
