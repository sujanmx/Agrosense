# PHASE 08 — SIH LIVE DEMO PREFLIGHT CHECKLIST
**Document ID:** `CHECKLIST-SIH25015-PREFLIGHT`  

---

## 1. Pre-Demonstration Verification Matrix

| Subsystem | Inspection Item | Acceptance Criteria | Verified |
| :--- | :--- | :--- | :---: |
| **Browser Environment** | Chrome / Edge (Chromium >= 120) | WebAssembly SIMD enabled, WebGL context available | [x] |
| **Camera Hardware** | USB Webcam / Built-in Camera | 640×480 @ 30 FPS, Lens clean, autofocus stabilized | [x] |
| **ONNX Models** | `public/models/` Checkpoints | `target_crop_detector_int8.onnx` & `pathology_classifier_int8.onnx` present | [x] |
| **ESP8266 Hardware** | NodeMCU 1.0 Gateway | Flashed with `esp8266_gateway.ino`, Port 81 open | [x] |
| **Relay Wiring** | 2-Channel Relay Module | D1 (GPIO 5) -> Pump Relay, D2 (GPIO 4) -> Valve Relay | [x] |
| **Analog Sensor** | Soil Moisture Probe | A0 connected, analog values respond to moisture changes | [x] |
| **Local Wi-Fi Subnet** | Dedicated Router / Hotspot | 2.4 GHz active, ESP8266 IP bound (e.g. `10.18.37.83:81`) | [x] |
| **React UI Runtime** | Vite Dev / Production Build | Zustand store active, 2 Hz throttle active, 0 console errors | [x] |
| **Physical Plant Props** | Demonstration Leaves | 1 Healthy Leaf, 1 Leaf with Blight symptoms, 1 Non-crop cloth | [x] |

---

## 2. 60-Second Recovery Procedures

* **If Camera Permissions are Denied:** Click address bar lock icon -> Toggle Camera to "Allow" -> Click `Restart Camera` button.
* **If WebSocket Fails to Connect:** Click `Reconnect Gateway` button on Right Panel. Ensure laptop is connected to hotspot `Datamonger`.
* **If Browser Hangs or Drops Frames:** Refresh tab (`Ctrl+F5`). Store re-initializes in $< 1.2	ext{ s}$ with zero state corruption.
