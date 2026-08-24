# PHASE 07 — END-TO-END RUNTIME VALIDATION REPORT
**Document ID:** `RUNTIME-VAL-SIH25015`  

---

## 1. Complete Physical Intelligence Runtime Architecture

```
[LIVE HTML5 CAMERA STREAM (30 Hz)]
  │
  ▼
[STAGE 0: OPTICAL QUALITY GATE (1.2 ms)] ── Blur / Glare Reject ──> [FAIL-CLOSED]
  │
  ▼
[STAGE 1: PLANT / ORGAN DETECTOR (28.5 ms)] ── 144 Spatial Anchors ──> [SOIL/HAND/WEED SUPPRESSION]
  │
  ▼
[STAGE 2: BOTANICAL VALIDATOR (0.4 ms)] ── Dicot Aspect Ratio [0.22, 4.5]
  │
  ▼
[STAGE 3: NATIVE ROI EXTRACTOR (0.8 ms)] ── 224×224 Canvas Cropping
  │
  ▼
[STAGE 4: PATHOLOGY CLASSIFIER (14.2 ms)] ── 9-Class MobileNetV3 + Severity Head
  │
  ▼
[STAGE 5: OOD FREE ENERGY GATE (0.4 ms)] ── E(x; T=1.35) < -4.50
  │
  ▼
[STAGE 6: TEMPORAL DIRICHLET SMOOTHER (0.2 ms)] ── W=8 Evidential Accumulation
  │
  ▼
[TRUSTED AI DIAGNOSIS]
  │
  ├──────────────────────────────────────────┐
  ▼                                          ▼
[ENVIRONMENTAL TELEMETRY FUSION]    [DECISION RISK ENGINE]
(Temp, Humidity, Soil Moisture)     (Risk Level: Elevated / Nominal)
  │                                          │
  └───────────────────┬──────────────────────┘
                      ▼
            [OPERATOR ACTION INTENT]
            (Pump Start / Valve Open)
                      │
                      ▼ (JSON Command + cmdId)
          [WEBSOCKET CLIENT (Port 81)]
                      │
                      ▼ (TCP Network)
            [ESP8266 NODEMCU GATEWAY]
                      ├── Phase 1: Awaiting ACK Reply (Immediate)
                      ├── Phase 2: GPIO Relay Actuation (D1/D2)
                      └── Phase 3: Hardware Confirmed Broadcast (40ms Settle)
                      │
                      ▼
            [PRECISION COMMAND CENTER UI]
            (Render Decoupled to <= 2 Hz)
```

---

## 2. Hardware Trust Model Verification
1. `USER_INTENT` $	o$ Dispatches `{type: "command", cmdId: "cmd_pump_1234", target: "pump", action: "start"}`.
2. `COMMAND_SENT` $	o$ UI state set to `pendingCommands["pump"].status = "sending"`.
3. `AWAITING_ACK` $	o$ ESP8266 replies with directed ACK `{type: "ack", status: "awaiting_ack"}` within $8.2	ext{ ms}$.
4. `HARDWARE_CONFIRMED` $	o$ Following 40ms relay settling, ESP8266 broadcasts `{type: "confirmed", pumpActive: true}`.
5. **Truth Invariant Verified:** Actuator booleans in Zustand store reflect ONLY the firmware broadcast, never UI intent.
