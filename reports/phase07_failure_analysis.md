# PHASE 07 — FAILURE INJECTION & RESILIENCE REPORT
**Document ID:** `FAILURE-ANALYSIS-SIH25015`  

---

## 1. Injected Fault Scenarios & Autonomous System Response

| Fault Injection Scenario | Injection Mechanism | System Failure Containment Behavior | Severity | Recovery Mode |
| :--- | :--- | :--- | :---: | :--- |
| **Wi-Fi Link Drop During Actuation** | Simulated packet loss on command packet | Command times out after 5000ms; UI reverts sending badge; pump stays in verified safe state. | P1 | Autonomous Exponential Backoff Reconnection |
| **Corrupted Sensor Ingestion** | Injected raw payload `{temperature: "NaN"}` | JSON parser error caught in `WebSocketProvider.tsx`; malformed packet discarded; previous trusted values retained. | P2 | Next valid 2000ms telemetry cycle |
| **Direct Sunlight Solar Glare** | Saturated white pixel patch ($Y = 245$) | Optical Quality Gate flags overexposure; short-circuits pipeline before false disease detection. | P2 | Dynamic recovery when camera pans away |
| **Relay Actuation State Conflict** | Simulated hardware reporting pumpActive=false when commanded true | UI transitions to `HARDWARE_ERROR`; alert banner informs operator of coil disconnect. | P1 | Manual override & alert telemetry |
| **Simultaneous Multi-Tab Dispatch** | Two browser tabs issuing commands simultaneously | ESP8266 serializes commands in queue; broadcasts confirmation to all connected sockets. | P2 | Full cross-client state synchronization |
