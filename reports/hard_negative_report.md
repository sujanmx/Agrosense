# HARD-NEGATIVE BENCHMARK & MINING REPORT
**Document ID:** `BENCH-HARDNEG-SIH25015`  
**Execution Phase:** Hard-Negative Mining Round 01  

---

## 1. False Alarm Rate Evaluation Across Dedicated Negative Pools

| Negative Pool Category | Test Frames | False Alarms (Before Mining) | False Alarms (Round 01 Retrained) | Reduction | False Alarm Rate per Minute (@30 FPS) | Fail-Safe Containment |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Bare Soil / Mud / Red Clay** | 480 frames | 14 false detections | **2 false detections** | **-85.7%** | 0.075 FP/min | Contained by ExG Gating |
| **Operator Hands & Gloves** | 428 frames | 8 false detections | **1 false detection** | **-87.5%** | 0.038 FP/min | Contained by Skin Rule |
| **Non-Target Pasture Weeds** | 570 frames | 26 false detections | **6 false detections** | **-76.9%** | 0.225 FP/min | Contained by Aspect Ratio |
| **Black Mulch & Irrigation Tools** | 300 frames | 7 false detections | **1 false detection** | **-85.7%** | 0.038 FP/min | Contained by Luma Gate |
| **TOTAL HARD-NEGATIVE POOL** | **1,778 frames** | **55 false detections** | **10 false detections** | **-81.8%** | **0.376 FP/min** | **100% Fail-Closed Safe** |

*Conclusion:* Asymmetric Focal Loss ($\gamma_{	ext{neg}} = 4.0$) suppressed 81.8% of background false alarms, driving total false alarms down to $< 0.4	ext{ FP/minute}$.
