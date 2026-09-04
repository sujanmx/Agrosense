# AgroSense SIH25015 — ESP8266 Master Firmware Audit Report

**Phase 11 — Complete Firmware Audit & Upgrade Report**

| Field | Value |
|-------|-------|
| **Date** | 2026-08-30 |
| **Firmware Version** | AgroSense-ESP-v2.0 |
| **Board** | NodeMCU 1.0 (ESP-12E) |
| **Previous Version** | Original (no version identifier) |
| **Auditor** | Antigravity Embedded Systems Engineer |

---

## 1. ORIGINAL FIRMWARE ANALYSIS

### 1.1 Architecture Summary

The original firmware (`esp8266_gateway.ino`, 459 lines) was a well-structured single-file Arduino sketch with 11 clearly labeled sections. It successfully implemented:

- Wi-Fi station mode connection
- WebSocket server on port 81
- Soil moisture ADC reading on A0
- Simulated temperature/humidity with random drift
- Two relay outputs (pump on D1, valve on D2)
- Three-phase command trust pipeline (awaiting_ack → actuation → confirmed)
- LED status indication on D4

### 1.2 Detailed Section Audit

#### Wi-Fi
| Aspect | Finding |
|--------|---------|
| Mode | `WIFI_STA` (Station) ✅ |
| Credentials | Hardcoded SSID/password ✅ |
| Connection | Blocking loop with 40 × 400ms = 16s timeout ⚠️ |
| IP Reporting | Dynamic via `WiFi.localIP()` ✅ |
| Reconnection | Relied on ESP8266WiFi auto-reconnect ⚠️ |
| RSSI | Not reported ❌ |

#### WebSocket
| Aspect | Finding |
|--------|---------|
| Library | `WebSocketsServer` (Links2004) ✅ |
| Port | 81 ✅ |
| Events | CONNECTED, DISCONNECTED, TEXT handled ✅ |
| ERROR | Not explicitly handled ⚠️ |
| Client Tracking | Manual counter `connectedClients` ✅ |
| Initial Snapshot | Sent on connection ✅ |

#### Telemetry
| Aspect | Finding |
|--------|---------|
| Interval | 2000ms ✅ |
| Fields | type, temperature, humidity, soilMoisture, pumpActive, valveOpen ✅ |
| Format | JSON via ArduinoJson ✅ |
| Numbers | Serialized as strings with 1 decimal place ✅ |
| Simulated vs Physical | Not distinguished in code or docs ❌ |

#### Soil Sensor (A0)
| Aspect | Finding |
|--------|---------|
| ADC Range | 0–1023 (10-bit) ✅ |
| Mapping | 1023→0%, 350→100% ✅ |
| Clamping | constrain(0, 100) ✅ |
| Float Detection | ADC < 50 → simulate ✅ |
| Calibration | Values hardcoded in `map()` call ⚠️ |

#### Pump Relay (D1/GPIO5)
| Aspect | Finding |
|--------|---------|
| Pin | D1 (GPIO5) ✅ |
| Logic | Active-LOW ✅ |
| Init State | RELAY_OFF at boot ✅ |
| Control | Direct `digitalWrite()` in command handler ⚠️ |

#### Valve Relay (D2/GPIO4)
| Aspect | Finding |
|--------|---------|
| Pin | D2 (GPIO4) ✅ |
| Logic | Active-LOW ✅ |
| Init State | RELAY_OFF at boot ✅ |
| Control | Direct `digitalWrite()` in command handler ⚠️ |

#### LED (D4/GPIO2)
| Aspect | Finding |
|--------|---------|
| Pin | D4 (GPIO2) — built-in NodeMCU LED ✅ |
| Logic | Active-LOW ✅ |
| Behavior | ON when client connected, OFF when no clients ✅ |
| Wi-Fi Blink | Blinks during connection attempt ✅ |

#### Command Protocol
| Aspect | Finding |
|--------|---------|
| Format | JSON: `{type, cmdId, target, action}` ✅ |
| Targets | "pump", "valve" ✅ |
| Actions | pump: start/stop, valve: open/close ✅ |
| Validation | Checks for empty target/action ✅ |
| Unknown Target | Logged and skipped ✅ |
| Unknown Action | Logged but relay state not changed ✅ |

#### Acknowledgement Protocol
| Aspect | Finding |
|--------|---------|
| Phase 1 | `awaiting_ack` sent to issuing client ✅ |
| Phase 2 | GPIO actuation ✅ |
| Settle | 40ms delay for relay contacts ✅ |
| Phase 3 | `confirmed` broadcast to all clients ✅ |

#### Safety Behavior
| Aspect | Finding |
|--------|---------|
| Boot State | All relays OFF ✅ |
| GPIO Init Order | Before Wi-Fi ✅ |
| Runtime Timeout | None ⚠️ |
| Error Recovery | Minimal ⚠️ |

---

## 2. ISSUES IDENTIFIED IN ORIGINAL FIRMWARE

### 2.1 Critical Issues
| # | Issue | Severity |
|---|-------|----------|
| 1 | No firmware version identifier | Medium |
| 2 | No RSSI reporting | Low |
| 3 | Temperature/humidity presented as real sensor data without disclosure | **High** |
| 4 | Soil calibration values hardcoded in `map()` call — not configurable | Medium |
| 5 | Relay control via direct `digitalWrite()` — no centralized safe function | Medium |
| 6 | No `WStype_ERROR` handling | Low |
| 7 | No error response sent to client on malformed commands | Medium |
| 8 | No periodic diagnostics (heap, uptime, etc.) | Low |
| 9 | WiFi.persistent() not disabled — writes flash on every boot | Low |
| 10 | No auto-reconnect configuration | Low |

### 2.2 Positive Findings (Preserved)
| # | Finding |
|---|---------|
| 1 | Clean three-phase command pipeline |
| 2 | Active-LOW relay logic correctly implemented |
| 3 | Safe boot state (all OFF) |
| 4 | GPIO init before network init |
| 5 | Client count tracking |
| 6 | LED status indication |
| 7 | millis()-based telemetry scheduling (no blocking in loop) |
| 8 | Immediate snapshot on client connection |
| 9 | Float detection for disconnected soil probe |
| 10 | F() macro usage for string constants (PROGMEM) |

---

## 3. CHANGES MADE IN v2.0

### 3.1 Architecture Improvements

| Section | Change | Rationale |
|---------|--------|-----------|
| Firmware Identity | Added `AGROSENSE_FIRMWARE_VERSION` define and boot banner | Phase 4 requirement |
| Wi-Fi Manager | Extracted `initWiFi()`, `checkWiFi()`, `printWiFiStatus()` | Modular, testable |
| Sensor Manager | Extracted `readSoilMoisture()`, `readAllSensors()`, `applyDrift()` | Separation of concerns |
| Actuator Manager | Created `setPump()`, `setValve()`, `allActuatorsSafe()` | Centralized safety |
| Command Validation | Added target/action validation, error responses to client | Robust protocol |
| Diagnostics | Added `printBootBanner()`, `printHardwareConfig()`, `printDiagnostics()` | Observability |
| Safety | Added configurable runtime timeouts (disabled by default) | Future safety |
| Scheduling | All timing uses millis() — no blocking except 40ms relay settle | Responsive loop |

### 3.2 Protocol Compatibility

> [!IMPORTANT]
> **ALL existing protocol compatibility is preserved.**

| Protocol Element | v1 (Original) | v2 (Refactored) | Compatible? |
|-----------------|---------------|-----------------|-------------|
| Telemetry JSON schema | `{type,temperature,humidity,soilMoisture,pumpActive,valveOpen}` | Identical | ✅ |
| Command JSON schema | `{type,cmdId,target,action}` | Identical | ✅ |
| ACK response | `{type:"ack",cmdId,target,action,status:"awaiting_ack"}` | Identical | ✅ |
| Confirmed response | `{type:"confirmed",cmdId,target,action,status,pumpActive,valveOpen}` | Identical | ✅ |
| WebSocket port | 81 | 81 | ✅ |
| Telemetry interval | 2000ms | 2000ms | ✅ |
| Number format | String with 1 decimal | String with 1 decimal | ✅ |
| Initial snapshot on connect | Yes | Yes | ✅ |

### 3.3 New Features (Non-Breaking)

| Feature | Purpose |
|---------|---------|
| Error JSON responses | Client gets structured error when command is malformed |
| `WStype_ERROR` handling | Logs WebSocket errors |
| RSSI reporting | Shows signal strength in Serial Monitor |
| Periodic diagnostics | Heap, uptime, state every 60s |
| Wi-Fi reconnect detection | Logs reconnect events |
| `WiFi.persistent(false)` | Reduces flash wear |
| `WiFi.setAutoReconnect(true)` | Explicit auto-reconnect |
| Configurable soil calibration constants | `SOIL_DRY_ADC`, `SOIL_WET_ADC` defines |
| Configurable safety timeouts | `PUMP_MAX_RUNTIME_MS`, `VALVE_MAX_RUNTIME_MS` (disabled by default) |
| Data source transparency | Comments clearly label PHYSICAL vs SIMULATED data |

---

## 4. HARDWARE PIN MAPPING (VERIFIED FROM FIRMWARE)

| ESP8266 Pin | GPIO | Direction | Connected To | Active State | Init State |
|-------------|------|-----------|--------------|-------------|------------|
| D1 | GPIO5 | OUTPUT | Pump Relay IN | Active-LOW | OFF (HIGH) |
| D2 | GPIO4 | OUTPUT | Valve Relay IN | Active-LOW | OFF (HIGH) |
| D4 | GPIO2 | OUTPUT | Built-in LED | Active-LOW | OFF (HIGH) |
| A0 | ADC0 | INPUT | Soil Moisture Sensor | N/A | Analog read |

### Power Pins

| Pin | Purpose | Notes |
|-----|---------|-------|
| 3V3 | 3.3V output | ESP8266 logic level — DO NOT use for motor/solenoid |
| GND | Ground | Common ground for all components |
| VIN | 5V input | From USB or external 5V supply |

---

## 5. TELEMETRY FIELD DOCUMENTATION

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `type` | String | Constant | Always `"telemetry"` |
| `temperature` | Number (String) | **SIMULATED** | Software-generated temperature in °C (20–42 range) |
| `humidity` | Number (String) | **SIMULATED** | Software-generated humidity in %RH (28–92 range) |
| `soilMoisture` | Number (String) | **PHYSICAL** | ADC reading from A0, mapped to 0–100% |
| `pumpActive` | Boolean | **ACTUATOR STATE** | `true` if pump relay is currently energized |
| `valveOpen` | Boolean | **ACTUATOR STATE** | `true` if valve relay is currently energized |

> [!WARNING]
> **Temperature and humidity values are SOFTWARE SIMULATED.** There is no physical DHT sensor connected. These values use a random-walk algorithm to produce realistic-looking fluctuations. The React dashboard currently displays these without distinction from real sensor data. To add a physical DHT sensor, see the Optional Hardware Upgrade section in the hardware setup guide.

---

## 6. COMMAND PROTOCOL REFERENCE

### Inbound Commands (React → ESP)

```json
{
  "type": "command",
  "cmdId": "cmd_pump_1719933421",
  "target": "pump",
  "action": "start"
}
```

| Target | Valid Actions |
|--------|-------------|
| `pump` | `start`, `stop` |
| `valve` | `open`, `close` |

### Response Pipeline

```
Phase 1: → Client only
{"type":"ack","cmdId":"...","target":"...","action":"...","status":"awaiting_ack"}

Phase 2: GPIO actuation (40ms settle delay)

Phase 3: → All clients (broadcast)
{"type":"confirmed","cmdId":"...","target":"...","action":"...","status":"confirmed","pumpActive":true,"valveOpen":false}
```

### Error Responses (NEW in v2.0)

```json
{"type":"error","reason":"JSON parse error"}
{"type":"error","reason":"Missing 'target' or 'action' field"}
{"type":"error","reason":"Unknown target","target":"xyz"}
{"type":"error","reason":"Invalid action for target","target":"pump","action":"xyz"}
```

---

## 7. LIBRARIES REQUIRED

| Library | Author | Version | Purpose |
|---------|--------|---------|---------|
| ESP8266WiFi | ESP8266 Arduino Core | Built-in | Wi-Fi stack |
| WebSockets | Markus Sattler (Links2004) | v2.4.x+ | WebSocket server |
| ArduinoJson | Benoît Blanchon | v6.x or v7.x | JSON serialization |

### Arduino IDE Board Configuration

| Setting | Value |
|---------|-------|
| Board | NodeMCU 1.0 (ESP-12E Module) |
| Flash Size | 4MB (FS:2MB OTA:~1019KB) or default |
| Upload Speed | 115200 |
| CPU Frequency | 80MHz (default) |
| Serial Monitor Baud | 115200 |

---

## 8. SAFETY REVIEW

### 8.1 Boot Safety ✅

```
GPIO initialized → ALL actuators OFF → THEN Wi-Fi → THEN WebSocket
```

The firmware sets all relay outputs to RELAY_OFF (HIGH) and LED to OFF **before** any network initialization. This prevents accidental actuation during power-on.

### 8.2 Relay Safety ✅

- `allActuatorsSafe()` drives all outputs to safe state
- `setPump()` and `setValve()` are the only functions that control relays
- Active-LOW logic is clearly documented with `RELAY_ON`/`RELAY_OFF` constants

### 8.3 Command Safety ✅

- JSON parsing errors are caught and logged
- Missing fields are rejected
- Unknown targets are rejected
- Invalid actions for valid targets are rejected
- All rejections now send error responses to the client

### 8.4 Network Safety ✅

- ESP is Cloudflare-independent — no tunnel credentials in firmware
- IP is DHCP-assigned — never hardcoded
- `WiFi.persistent(false)` reduces flash wear
- Auto-reconnect handles network drops

### 8.5 Watchdog Safety ✅

- ESP8266 software watchdog is enabled by default (~3.2s)
- Hardware watchdog backup (~8s)
- `webSocket.loop()` and `delay(400)` in Wi-Fi loop feed the watchdog
- Main loop is non-blocking — watchdog will not trigger

---

## 9. POTENTIAL RISKS

| Risk | Mitigation |
|------|------------|
| Wi-Fi credentials in source code | Standard for ESP development; use WiFiManager library for production |
| No OTA update capability | Can be added as future upgrade |
| Single-point-of-failure (single ESP) | Acceptable for demo/SIH system |
| 40ms blocking delay in command handler | Required for relay settle; acceptable duration |
| No HTTPS/WSS on ESP itself | By design — Cloudflare provides TLS externally |
| Simulated temp/humidity presented as real | Now clearly documented; frontend should eventually distinguish |

---

## 10. UPLOAD PROCEDURE

> [!CAUTION]
> Do NOT flash the firmware without reviewing this checklist.

### Pre-Upload Checklist

- [ ] Arduino IDE installed with ESP8266 board package
- [ ] Correct board selected: **NodeMCU 1.0 (ESP-12E Module)**
- [ ] Correct port selected (COM port for USB-Serial adapter)
- [ ] Libraries installed: **WebSockets** (Links2004), **ArduinoJson** (Benoît Blanchon)
- [ ] Wi-Fi SSID and password updated in firmware
- [ ] ESP8266 connected via USB
- [ ] Pump and solenoid loads DISCONNECTED from relays

### Upload Steps

1. Open `hardware_firmware/esp8266_gateway.ino` in Arduino IDE
2. Select **Tools → Board → NodeMCU 1.0 (ESP-12E Module)**
3. Select **Tools → Port → (your COM port)**
4. Click **Verify** (compile only) — confirm zero errors
5. Click **Upload**
6. Wait for upload to complete
7. Open **Serial Monitor** at 115200 baud
8. Press **RST** button on NodeMCU
9. Confirm boot banner: `AgroSense SIH25015 / AgroSense-ESP-v2.0`
10. Confirm Wi-Fi connected with IP
11. Confirm WebSocket server started on port 81
12. Test from React dashboard

---

## 11. FILES GENERATED / UPDATED

| # | File | Status | Purpose |
|---|------|--------|---------|
| 1 | `hardware_firmware/esp8266_gateway.ino` | **UPDATED** | Refactored firmware v2.0 |
| 2 | `docs/AGROSENSE_HARDWARE_SETUP_GUIDE.md` | **NEW** | Beginner wiring guide |
| 3 | `docs/AGROSENSE_PINOUT_REFERENCE.md` | **NEW** | Pin reference card |
| 4 | `docs/AGROSENSE_FIRST_POWER_ON.md` | **NEW** | First power-on & testing |
| 5 | `docs/AGROSENSE_TROUBLESHOOTING.md` | **NEW** | Troubleshooting guide |
| 6 | `docs/AGROSENSE_CLOUDFLARE_SETUP.md` | **NEW** | Cloudflare tunnel setup |
| 7 | `reports/phase11_esp8266_master_firmware_audit.md` | **NEW** | This audit report |

---

## 12. SYSTEMS NOT MODIFIED

The following systems were explicitly **NOT modified** as per Phase 30 requirements:

- ❌ Gemini AI integration
- ❌ Gemini API key / model configuration
- ❌ Vercel API routes
- ❌ ONNX models / runtime
- ❌ AI disease classifier
- ❌ React frontend source code
- ❌ Any API routes or server configuration

The ESP8266 firmware is an **independent hardware subsystem** that communicates with the React frontend exclusively through the WebSocket protocol on port 81.

---

## FINAL STATUS

```
╔══════════════════════════════════════════════════════════╗
║  AGROSENSE ESP8266 MASTER FIRMWARE AUDIT — COMPLETE     ║
║                                                          ║
║  Firmware:     AgroSense-ESP-v2.0                       ║
║  Protocol:     100% backward compatible                  ║
║  Safety:       All checks passed                         ║
║  Documentation: Complete (7 files)                       ║
║                                                          ║
║  STATUS: READY FOR USER REVIEW AND APPROVAL              ║
║                                                          ║
║  ⚠️  DO NOT FLASH WITHOUT EXPLICIT USER APPROVAL         ║
╚══════════════════════════════════════════════════════════╝
```
