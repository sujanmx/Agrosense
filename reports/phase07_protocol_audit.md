# PHASE 07 — WEBSOCKET PROTOCOL & SECURITY AUDIT
**Document ID:** `PROTOCOL-SIH25015`  

---

## 1. Protocol Specification & Message Schemas

### A. Telemetry Broadcast (ESP8266 -> Clients @ 2000ms Interval)
```json
{
  "type": "telemetry",
  "temperature": 28.4,
  "humidity": 58.6,
  "soilMoisture": 44.0,
  "pumpActive": false,
  "valveOpen": false
}
```

### B. Command Payload (Client -> ESP8266)
```json
{
  "type": "command",
  "cmdId": "cmd_pump_8841",
  "target": "pump",
  "action": "start"
}
```

### C. Phase 1 ACK (ESP8266 -> Issuing Client)
```json
{
  "type": "ack",
  "cmdId": "cmd_pump_8841",
  "target": "pump",
  "action": "start",
  "status": "awaiting_ack"
}
```

### D. Phase 3 Confirmation (ESP8266 -> All Clients)
```json
{
  "type": "confirmed",
  "cmdId": "cmd_pump_8841",
  "target": "pump",
  "action": "start",
  "status": "confirmed",
  "pumpActive": true,
  "valveOpen": false
}
```

---

## 2. Security Classification
* **Current Security Tier:** **DEMO / LOCAL SUBNET SECURITY (SIH Environment)**.
* **Authentication:** Local Wi-Fi WPA2 PSK on subnet. WebSockets operate without TLS (`ws://`).
* **Production Security Roadmap:** Upgrade to WSS (`wss://`), TLS 1.3, and HMAC-SHA256 command signing before commercial outdoor cellular gateway deployment.
