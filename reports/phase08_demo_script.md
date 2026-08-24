# PHASE 08 — SIH JUDGE DEMONSTRATION SCRIPT
**Title:** Precision Command Center (SIH25015) — 3 to 5 Minute Live Judge Demonstration  
**Target Audience:** Smart India Hackathon (SIH) Evaluation Jury, Technical Evaluators, Agronomy Experts  
**Demonstration Mode:** Live Edge Hardware-in-the-Loop  

---

## 1. Timing & Narrative Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               3–5 MINUTE DEMO RUNWAY                                   │
├─────────────┬──────────────────────────────────────────────────────────────────────────┤
│ 00:00–00:30 │ 1. The Core Problem: Fragmented AgTech & Blind Actuation                │
│ 00:30–01:00 │ 2. System Overview: The 3-Column Command Architecture                    │
│ 01:00–02:00 │ 3. Live AI Perception: 8-Stage Cascaded Edge Inference                   │
│ 02:00–02:30 │ 4. Environmental Context: Sensor Telemetry Fusion (No False Causality)   │
│ 02:30–03:15 │ 5. Hardware Action: 3-Phase Trust Cycle & Idempotent Commands            │
│ 03:15–03:45 │ 6. Hardware Confirmation: Physical Relay Actuation & Status Sync         │
│ 03:45–04:15 │ 7. Failure-Safe Demonstration: Fail-Closed Gating & Hard Negatives       │
│ 04:15–04:45 │ 8. Verified Performance: Independent Phase 06A Metrics                   │
│ 04:45–05:00 │ 9. Commercial Scaling & Agronomic Impact                                 │
└─────────────┴──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Minute-by-Minute Script & Action Guide

### [00:00–00:30] — 1. THE PROBLEM
* **Speaker Action:** Stand facing the judge. Screen displays the Precision Command Center in `STANDBY` state.
* **Verbal Script:**  
  > *"Good morning, respected judges. In commercial agriculture, over ₹50,000 Crore of crops are lost annually to foliar diseases, while indiscriminate pesticide spraying degrades soil and costs farmers millions.  
  > Existing solutions are fatally fragmented: farmers use smartphone apps that upload photos to cloud servers taking seconds to guess diseases, while dumb timers spray chemicals blindly without verifying whether a plant is even present.  
  > We built **AgroSense Precision Command Center (SIH25015)**: a real-time, edge-native AI perception and IoT control system that executes locally on commodity browser hardware, fuses live environmental telemetry, and actuates physical relays through a verified 3-phase hardware trust cycle."*

---

### [00:30–01:00] — 2. SYSTEM OVERVIEW
* **Speaker Action:** Point to the 3 main columns on the dashboard.
* **Verbal Script:**  
  > *"Our dashboard is organized around a strict industrial information hierarchy:  
  > 1. **Left Panel — Environmental Context:** Real-time temperature, humidity, and analog soil moisture streamed from our ESP8266 node at 2 Hz.  
  > 2. **Center Panel — AI Perception:** Live 30 FPS camera feed backed by an 8-stage cascaded neural pipeline running entirely inside the browser via ONNX WebAssembly SIMD.  
  > 3. **Right Panel — Hardware Trust Control:** Direct control of irrigation pumps and solenoid valves backed by physical confirmation, never UI assumptions."*

---

### [01:00–02:00] — 3. LIVE AI PERCEPTION DEMONSTRATION
* **Speaker Action:** Click **`Start Analysis`**. Present a real tomato leaf in front of the camera.
* **Visual Observation:** Camera feed shows a glowing green bounding box around the leaf. The **Diagnostic Card** renders:
  - Diagnosis: `Early Blight (Alternaria solani)` / `Healthy Target Crop`
  - Calibrated Confidence: `92.4% (HIGH)`
  - Severity Score: `0.42` | Affected Leaf Area: `10.5%`
  - Backend Mode: `NEURAL ONNX (WASM SIMD)`
* **Verbal Script:**  
  > *"Watch as I present this tomato leaf. Within 45 milliseconds, the system executes an 8-stage cascaded perception pipeline:  
  > First, Stage 0 checks optical quality to reject blur. Stage 1's MobileNetV3-FPN localizes the crop leaf among 144 spatial anchors. Stage 2 validates biological morphology. Stage 3 crops a native, uncompressed 224×224 patch. Stage 4 classifies the exact pathology across 9 agricultural classes and regresses lesion severity. Stage 5 computes post-hoc Helmholtz Free Energy to reject out-of-distribution textures, and Stage 6 applies multi-frame Bayesian smoothing.  
  > Notice the throttle ratio: while the neural network processes 30 frames every second, React UI state mutations are capped at 2 Hz, consuming less than 1.5% CPU overhead."*

---

### [02:00–02:30] — 4. ENVIRONMENTAL CONTEXT FUSION
* **Speaker Action:** Point to the sensor values on the Left Panel.
* **Verbal Script:**  
  > *"Crucially, our system does not pretend that sensor data proves disease. The AI observes the physical leaf; the telemetry provides environmental context.  
  > Here, the humidity is 88% and temperature is 28.4°C. The system identifies: 'Environmental conditions are compatible with elevated fungal spore propagation.' It assists the agronomist without inventing false causal links."*

---

### [02:30–03:45] — 5 & 6. HARDWARE ACTION & 3-PHASE TRUST CYCLE
* **Speaker Action:** Click **`Start Pump`** on the Right Panel. Point to the physical relay on the table.
* **Visual & Physical Observation:**
  1. Button transitions to `Command in progress…` (Amber dot: `Command sent…`).
  2. Transitions to Blue dot: `Waiting for controller…`.
  3. **Audible Click:** Physical Relay LED on the ESP8266 lights up; relay contacts snap shut.
  4. Status turns Emerald: `Hardware confirmed` (`PUMP ACTIVE`).
* **Verbal Script:**  
  > *"Now watch our physical actuation safety loop. When I click 'Start Pump', the system does NOT immediately assume the pump is running.  
  > It generates an idempotent JSON command with a unique cryptographic ID (`cmdId`). The ESP8266 receives the packet and replies immediately with Phase 1 ACK. The microcontroller energizes GPIO 5, waits 40 milliseconds for mechanical contact settling, and broadcasts Phase 3 CONFIRMED.  
  > Only when the physical microcontroller confirms relay contact closure does the UI reflect active state. If the wire were cut, the command would time out after 5 seconds—preventing phantom actuation."*

---

### [03:45–04:15] — 7. FAILURE-SAFE & HARD-NEGATIVE DEMONSTRATION
* **Speaker Action:**
  1. Hold an operator hand directly over the leaf.
  2. Present a textured cloth / magazine cover.
* **Visual Observation:**
  1. Hand is identified as `hard_neg_hand` and suppressed; leaf remains isolated.
  2. Cloth triggers Helmholtz Free Energy $E(x) = -2.85 \ge -4.50$; UI displays `Indeterminate Observation` (Confidence capped, action buttons safely locked).
* **Verbal Script:**  
  > *"A critical differentiator of our system is its **Fail-Closed Architecture**:  
  > When a farmer's hand holds the leaf, our detector uses hard-negative suppression to isolate the foliage while ignoring the hand.  
  > When I present an unknown non-crop object, our Helmholtz Free Energy OOD gate detects high epistemic uncertainty and flags 'Indeterminate Observation'. The system never guesses, never outputs false disease alerts on unknown objects, and never triggers unauthorized spraying."*

---

### [04:15–05:00] — 8 & 9. VERIFIED EVIDENCE & CONCLUSION
* **Speaker Action:** Point to the **Verified Performance** panel.
* **Verbal Script:**  
  > *"Every claim we make is supported by physical artifacts in our repository:  
  > - **90.8% Detector mAP@50** and **92.3% Pathology Macro F1** evaluated on 2,220 locked real test images.  
  > - **0.011 False Positives per Image** with an 81.8% hard-negative false alarm reduction.  
  > - **4.2 × 10⁻⁶ PyTorch-to-ONNX Parity** running at 22 FPS edge throughput.  
  > - **20 out of 20 Hardware-in-the-Loop integration tests passed.**  
  > AgroSense proves that intelligent edge perception and fail-closed hardware control can transform precision agriculture. Thank you, and we welcome your questions."*
