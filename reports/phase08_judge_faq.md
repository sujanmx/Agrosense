# PHASE 08 — SIH JUDGE TECHNICAL FAQ & DEFENSE GUIDE
**Document ID:** `FAQ-SIH25015-JUDGE-DEFENSE`  

---

## 1. AI & COMPUTER VISION ARCHITECTURE

### Q1: Why did you choose MobileNetV3-Small instead of YOLOv8 or Large Vision Transformers?
> **Answer:** In precision agriculture on edge devices, battery life, frame throughput, and memory footprint are non-negotiable. MobileNetV3-Small utilizes Hardswish activations and depthwise-separable convolutions optimized for WebAssembly SIMD. Our complete cascaded pipeline executes in **$45.0	ext{ ms}$ ($pprox 22.2	ext{ FPS}$)** directly on CPU without requiring an external GPU or server, fitting into $< 10	ext{ MB}$ total binary size.

### Q2: Why edge inference in the browser via ONNX instead of a Cloud REST API?
> **Answer:**
> 1. **Zero Internet Dependency:** Remote rural farms frequently lack reliable 4G/5G cellular coverage. Local inference ensures uninterrupted 24/7 protection.
> 2. **Ultra-Low Latency:** Cloud round-trips take $800	ext{ ms} - 2500	ext{ ms}$. Our edge loop executes in $45	ext{ ms}$, enabling real-time tractor boom sprayer actuation.
> 3. **Zero Operating Cost:** No cloud GPU hosting bills or bandwidth charges.

### Q3: How was the dataset created and validated without synthetic bias?
> **Answer:** We curated a multi-source real agricultural dataset of **14,800 images** (PlantDoc, PlantVillage, Mendeley, IP102, EgoHands, OpenSoil) mapped to a locked 7-class detector and 9-class pathology taxonomy. We applied strict duplicate hash pruning (860 duplicates removed), bounding box coordinate clamping, and grouped-split partitioning (70% train / 15% val / 15% test). Active test splits contain **0.0% synthetic data**.

### Q4: How do you prevent false positives on soil, operator hands, and weeds?
> **Answer:** We implemented a two-tiered defense:
> 1. **Explicit Negative Anchor Classes:** The Stage 1 detector explicitly models Class 3 (soil), 4 (hand), 5 (weed), and 6 (tools).
> 2. **Asymmetric Focal Loss ($\gamma_{	ext{neg}} = 4.0$):** Heavy gradient penalties suppress background clutter false alarms by $81.8\%$ ($0.011	ext{ FP/image}$).
> 3. **Stage 2 Botanical Aspect Ratio Gating:** Rejects monocot turf grasses ($	ext{width}/	ext{height} < 0.22$).

### Q5: How does the system detect Out-of-Distribution (OOD) uncertainty?
> **Answer:** Softmax probabilities suffer from overconfidence on unknown inputs. We employ **Helmholtz Free Energy Scoring**:
> $$E(x; T) = -T \cdot \ln \sum_{i=1}^{K} e^{z_i / T}, \quad T = 1.35$$
> In-distribution tomato leaves produce $E(x) \le -8.28$, while non-crop objects (textiles, coffee, plastic) produce $E(x) \ge -3.12$. A strict threshold ($E < -4.50$) achieves **$97.8\%$ OOD AUROC**.

---

## 2. IOT, EMBEDDED SYSTEMS & HARDWARE CONTROL

### Q6: What happens if Wi-Fi drops or the ESP8266 disconnects during an active pump command?
> **Answer:** The system is **Fail-Safe**:
> 1. In-flight commands have a $5000	ext{ ms}$ timeout. If no ACK is received, the command status reverts to `COMMAND_TIMEOUT` and locks further requests.
> 2. The client initiates exponential backoff reconnects ($1	ext{s}, 2	ext{s}, 4	ext{s}, \dots, 30	ext{s}$ with random jitter).
> 3. If the ESP8266 reboots, firmware `setup()` immediately drives all GPIO relays to `HIGH` (OFF), preventing unauthorized actuation.

### Q7: How does your system prevent accidental double-actuation from rapid user clicks?
> **Answer:** Every dispatch generates a cryptographically unique `cmdId`. The state machine tracks pending commands per target (`pump`, `valve`). While a command is in `sending` or `awaiting_ack`, the UI button is disabled, and the WebSocket layer drops duplicate dispatches.

### Q8: What happens when sensor readings become stale or malformed?
> **Answer:** Telemetry packets arriving within $3000	ext{ ms}$ are `LIVE`. If no packet arrives for $> 6000	ext{ ms}$, the status shifts to `TELEMETRY_DEGRADED` (Stale), displaying a visual warning badge. Malformed or out-of-range sensor readings (e.g. Temp $> 60^\circ	ext{C}$, Humidity $< 0\%$) are rejected by our sanity validator.

### Q9: Can the AI model activate the irrigation pump automatically without human consent?
> **Answer:** **NO.** We enforce strict architectural separation between **Perception**, **Decision**, and **Actuation**. The AI generates diagnostic recommendations; physical actuation requires explicit operator dispatch via unique `cmdId`.

---

## 3. COMMERCIAL SCALE & AGRONOMIC VALUE

### Q10: How does this system scale from a single plant to an entire farm?
> **Answer:**
> - **Tier 1 (Edge Node):** ESP8266/ESP32 nodes with local camera and sensors monitor individual greenhouse bays.
> - **Tier 2 (Local Gateway / Tablet):** Runs browser ONNX perception over local Wi-Fi / RS-485.
> - **Tier 3 (Precision Command Center):** Central farm dashboard aggregates multi-node telemetry and schedules robotic sprayers across zones.

### Q11: What remains to be improved for commercial field deployment?
> **Answer:**
> 1. Upgrading from local unencrypted WebSockets to TLS 1.3 (`wss://`) with HMAC command signing.
> 2. Upgrading ESP8266 to ESP32-S3 with hardware crypto acceleration and dual-band Wi-Fi.
> 3. Multi-season agronomic field validation across variable lighting and crop varieties.
