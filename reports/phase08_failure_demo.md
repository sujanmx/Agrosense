# PHASE 08 — FAIL-SAFE DEMONSTRATION PROTOCOL
**Document ID:** `DEMO-SIH25015-FAILSAFE`  

---

## 1. Overview
This protocol demonstrates that the Precision Command Center **fails closed**—never producing false disease diagnoses, phantom hardware confirmations, or unauthorized relay actuations when presented with adversarial inputs or network failures.

---

## 2. 7 Controlled Failure Scenarios

### Scenario A: Camera Unavailable / Permission Denied
* **Stimulus:** Disconnect USB camera or revoke browser permission.
* **System Response:** Transitions to `CAMERA_OFFLINE`. Renders informative empty-state UI with DataLotus offline mascot. Zero inference cycles executed.

### Scenario B: No Target in Field of View
* **Stimulus:** Point camera at empty table or plain wall.
* **System Response:** Stage 0 Quality Gate detects low excess green ($ExG < 10$). Emits `"No Clear Detection"`. Diagnosis card remains clear. Action buttons disabled.

### Scenario C: Hand Obstruction / Soil Substrate (Hard Negatives)
* **Stimulus:** Place bare soil tray or hold tomato leaf with hand covering 50% of the field.
* **System Response:** Detector routes hand/soil to `suppressedNegatives`. Leaf is isolated; hand pixels never undergo disease classification.

### Scenario D: Out-of-Distribution Frame (Adversarial Texture)
* **Stimulus:** Hold a printed textile pattern or coffee leaf in front of camera.
* **System Response:** Stage 5 Free Energy calculates $E(x) = -2.85 \ge -4.50$. State shifts to `Indeterminate Observation`. Diagnostic card locks to yellow uncertainty banner.

### Scenario E: ESP8266 Network Disconnection
* **Stimulus:** Unplug ESP8266 USB power cable.
* **System Response:** Top ticker flags `CONTROLLER: OFFLINE`. Right panel displays `Controls Locked` overlay. Actuation buttons disabled immediately.

### Scenario F: Stale Telemetry Injection
* **Stimulus:** Pause ESP8266 telemetry loop for $> 6000	ext{ ms}$.
* **System Response:** Telemetry values flagged with amber `STALE` badge. Stale readings are never represented as live data.

### Scenario G: Command ACK Timeout
* **Stimulus:** Issue `Start Pump` command while ESP8266 Wi-Fi is disabled.
* **System Response:** Command enters `awaiting_ack`. After $5000	ext{ ms}$, transitions to `Controller timed out`. State cleanly clears with zero phantom confirmation.
