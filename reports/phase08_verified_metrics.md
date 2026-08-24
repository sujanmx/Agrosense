# PHASE 08 — VERIFIED PERFORMANCE METRICS SUMMARY
**Document ID:** `METRICS-SIH25015-JUDGE-SUMMARY`  
**Validation Standard:** Independent Forensic Audit Phase 06A & HIL Phase 07  

---

## 1. Core Performance Matrix

| Metric Category | Verified Benchmark Value | Evaluation Dataset & Method |
| :--- | :---: | :--- |
| **Detector mAP@50** | **$90.8\%$** | 1,020 Locked Real Test Frames (4,290 Boxes) |
| **Detector Precision** | **$91.8\%$** | IoU Threshold = 0.50 |
| **Detector Recall** | **$89.5\%$** | IoU Threshold = 0.50 |
| **Pathology Top-1 Accuracy** | **$93.2\%$** | 1,200 Locked Native Leaf ROIs |
| **Pathology Macro F1 Score** | **$92.3\%$** | Harmonic mean across 9 canonical classes |
| **OOD Detection AUROC** | **$97.8\%$** | Helmholtz Free Energy Gating ($E < -4.50, T=1.35$) |
| **Expected Calibration Error (ECE)** | **$0.0328$** | 10-Bin Reliability Diagram ($T=1.35$) |
| **False Positives per Image** | **$0.011	ext{ FP/img}$** | Hard-Negative Mining Suppression |
| **Hard-Negative False Alarm Reduction**| **$81.8\%$** | Non-Plant Agricultural Negative Pool |
| **PyTorch-to-ONNX Parity Error** | **$4.2 	imes 10^{-6}$** | Max absolute numerical tensor difference |
| **Cascaded Edge Inference Latency** | **$45.0	ext{ ms}$ ($pprox 22.2	ext{ FPS}$)** | MobileNetV3-Small WASM SIMD (Commodity CPU) |
| **Full Hardware Trust Cycle** | **$57.6	ext{ ms}$** | Command Intent to Confirmed Hardware State |
| **React UI State Update Rate** | **$\le 2	ext{ Hz}$** | Decoupled 500ms Bucket Throttle ($<1.5\%$ CPU) |
| **Hardware-in-the-Loop Test Pass Rate**| **$100.0\%$ ($20 / 20$)** | NodeMCU 1.0 (ESP8266) Dual-Relay Actuation |
