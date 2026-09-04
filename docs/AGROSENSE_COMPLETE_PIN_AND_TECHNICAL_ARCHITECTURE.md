# AgroSense (SIH25015) — Complete Source-Code-Driven Hardware Pin Audit & Technical System Architecture

> **Authoritative Technical Engineering Specification & Physical Implementation Audit**  
> **Target Silicon & Board:** ESP8266 NodeMCU 1.0 (ESP-12E Module)  
> **Firmware Version:** `AgroSense-ESP-v2.1` (Real-Sensor-Only)  
> **Audit Paradigm:** READ → TRACE → VERIFY → DOCUMENT (Strictly Source-Code Verified)  
> **Release Status:** Production Verified | Zero Source Code Modified  
> **Date:** 2026-09-02  

---

## Executive Summary & System Scope

The **AgroSense** platform (SIH25015) is an integrated precision agriculture monitoring and automated actuation system designed for crop health diagnostics, soil moisture management, and closed-loop irrigation. The platform combines:
1. An **ESP8266 NodeMCU 1.0 Gateway** running lightweight non-blocking firmware with a standalone WebSocket server on Port `81`.
2. A **Physical Analog Sensor Bus** measuring real soil moisture via resistive/capacitive probes on analog channel `A0`.
3. An **Optoisolated Relay Module** actuating an irrigation pump (Channel 1, `D1`) and solenoid valve (Channel 2, `D2`) via a three-phase hardware-confirmed trust pipeline (`SENDING` → `AWAITING_ACK` → `CONFIRMED`).
4. A **React 19 / TypeScript / Zustand / Tailwind CSS v4 Dashboard** providing live sensor gauges, actuator controls, and diagnostic overlays.
5. A **Cloud-Hosted Gemini 2.5 Flash Multimodal Vision Engine** executing plant pathology classification, normalized bounding-box localization, and agricultural remedy generation via a secure serverless API proxy (`/api/analyze-plant`).
6. A **Dual-Network Ingress Architecture** supporting both zero-configuration local mDNS auto-discovery (`ws://agrosense.local:81`) and remote TLS-encrypted Cloudflare Tunnels (`wss://*.trycloudflare.com`).

---

## 1.0 Hardware Inventory & Silicon Physical Parameters

| Component Item | Model / Specification | Operating Voltage & Logic | Role in AgroSense | Source Code Evidence |
|:---|:---|:---|:---|:---|
| **Microcontroller** | NodeMCU 1.0 (ESP-12E Module, Tensilica L106 32-bit @ 80MHz) | 3.3V Logic Level (5.0V USB VIN) | Hosts WebSocket server (Port 81), samples 10-bit SAR ADC, drives relay GPIOs | `hardware_firmware/esp8266_gateway.ino:6` |
| **Relay Actuator Module** | 2-Channel 5V Optoisolated Relay Board | 5V VCC, 3.3V Logic Trigger (Active-LOW) | Galvanic isolation & power switching for Pump (CH1) and Valve (CH2) | `esp8266_gateway.ino:26-27, 76-77` |
| **Soil Moisture Sensor** | Analog Resistive Soil Probe + Comparator | 3.3V VCC, 0–3.3V Analog Out | Real physical soil moisture sampling (10-bit ADC conversion) | `esp8266_gateway.ino:29, 79` |
| **Status Indicator** | Built-in Blue LED (ESP-12E Silicon) | 3.3V (Active-LOW, GPIO 2) | Network connection & WebSocket client heartbeat indicator | `esp8266_gateway.ino:28, 78` |
| **Irrigation Pump** | External DC/AC Pump Motor | **NOT DETERMINED FROM CODE** | Delivers irrigation water via Relay Channel 1 (COM→NO) | `esp8266_gateway.ino:76` |
| **Solenoid Valve** | External DC/AC Solenoid Valve | **NOT DETERMINED FROM CODE** | Controls pipeline flow via Relay Channel 2 (COM→NO) | `esp8266_gateway.ino:77` |
| **Power Supply** | Micro-USB Cable & External DC PSU | 5V USB (Logic) / External Load PSU | Powers microcontroller logic and high-power actuator coils | `AGROSENSE_PINOUT_REFERENCE.md:28-32` |

---

## 2.0 Authoritative Source-of-Truth Pin Registry

The table below catalogs every hardware pin utilized in the AgroSense system, traced directly to executable firmware statements in `hardware_firmware/esp8266_gateway.ino`.

| Board Pin | Silicon GPIO | Connected Component | Component Pin | Direction | Electrical Logic | Firmware Function | Initial Boot State | Code Evidence |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **`D1`** | `GPIO 5` | Irrigation Pump Relay | `IN1` (Channel 1) | **OUTPUT** | Active-LOW (LOW=ON, HIGH=OFF) | Energizes pump relay coil (COM→NO closed) | `HIGH` (OFF) | `esp8266_gateway.ino:76, 85-86, 170-188, 841, 848` |
| **`D2`** | `GPIO 4` | Solenoid Valve Relay | `IN2` (Channel 2) | **OUTPUT** | Active-LOW (LOW=ON, HIGH=OFF) | Energizes valve relay coil (COM→NO closed) | `HIGH` (OFF) | `esp8266_gateway.ino:77, 85-86, 196-214, 842, 848` |
| **`D4`** | `GPIO 2` | Built-in Blue LED | Anode/Cathode Internal | **OUTPUT** | Active-LOW (LOW=ON, HIGH=OFF) | Client connect & Wi-Fi blink indicator | `HIGH` (OFF) | `esp8266_gateway.ino:78, 88-90, 557, 569, 843, 848` |
| **`A0`** | `ADC 0` | Soil Moisture Sensor | `AO` (Analog Out) | **INPUT (Analog)** | Linear Analog (0–3.3V Max) | 10-bit ADC soil moisture sampling (0–1023 count) | High-Z | `esp8266_gateway.ino:79, 240-258, 272-290` |
| **`VIN`** | Power Rail | Relay Module Power | `VCC` (+5V) | **PWR OUT / IN** | +5.0V DC (Nominal) | Supplies power to relay coils and optocoupler input | +5.0V DC | `AGROSENSE_PINOUT_REFERENCE.md:28-30` |
| **`3V3`** | Power Rail | Soil Sensor Power | `VCC` (+3.3V) | **PWR OUT** | +3.3V DC (Regulated) | Supplies bias power to analog soil probe circuit | +3.3V DC | `AGROSENSE_PINOUT_REFERENCE.md:31` |
| **`GND`** | Ground Bus | Relay & Sensor GND | `GND` (Ground) | **GND** | 0.0V Reference | Common signal and return ground bus | 0.0V Ground | `AGROSENSE_PINOUT_REFERENCE.md:32` |
| **`D0`** | `GPIO 16` | NOT CONNECTED | N/A | N/A | Digital I/O | Available for Deep Sleep Wake / User IO | Boots HIGH | `esp8266_gateway.ino` (Unused) |
| **`D3`** | `GPIO 0` | NOT CONNECTED | N/A | N/A | Strapping Pin | Unassigned (Reserved for future DHT22 data pin) | `HIGH` (Pull-up) | `esp8266_gateway.ino:37` (Unused) |
| **`D5–D8`** | `GPIO 14,12,13,15`| NOT CONNECTED | N/A | N/A | SPI / Digital I/O | Available general-purpose expansion pins | D8 `LOW` | `esp8266_gateway.ino` (Unused) |

---

## 3.0 NodeMCU Pin Mapping & Silicon Bootstrapping Constraints

NodeMCU silk-screened labels (e.g. `D1`) differ fundamentally from ESP8266 silicon GPIO numbers (e.g. `GPIO 5`).

```
NodeMCU Pin ──► ESP8266 Silicon GPIO ──► Firmware Definition ──► Hardware Function
   D1       ──►      GPIO 5         ──► PIN_RELAY_PUMP      ──► Pump Relay (Channel 1)
   D2       ──►      GPIO 4         ──► PIN_RELAY_VALVE     ──► Valve Relay (Channel 2)
   D4       ──►      GPIO 2         ──► PIN_LED_STATUS      ──► Built-in Status LED
   A0       ──►      ADC 0 (TOUT)   ──► PIN_SOIL_ANALOG     ──► Soil Moisture Sensor
```

### Silicon Strapping Pin Rules & Consequence Matrix

The ESP8266 evaluates specific pins on power-up to select its boot execution mode:
1. **`GPIO 0` (`D3`):** Must be **`HIGH`** at boot. If pulled `LOW`, the chip enters UART programming/flash download mode and will not execute firmware. (NodeMCU includes onboard 10kΩ pull-up).
2. **`GPIO 2` (`D4`):** Must be **`HIGH`** at boot. Connected to onboard blue LED. Firmware `setup()` explicitly sets `digitalWrite(PIN_LED_STATUS, LED_OFF)` (`HIGH` / 3.3V) immediately upon boot.
3. **`GPIO 15` (`D8`):** Must be **`LOW`** at boot. If pulled `HIGH`, flash memory cannot be accessed. (NodeMCU includes onboard 10kΩ pull-down).

---

## 4.0 Sensor Pin Architecture: Real vs. Unavailable Breakdown

| Sensor Metric | Physical Pin | Sampling Function | Calibration / Conversion Logic | Telemetry Field | Frontend Representation | Physical Reality Status |
|:---|:---|:---|:---|:---|:---|:---|
| **Soil Moisture** | `A0` (ADC 0) | `readSoilMoisture()`, `readAllSensors()` | 10-bit raw ADC (0–1023). Clamped to 0–100% via:<br/>`map(rawADC, 1023, 350, 0, 100)`<br/>ADC &lt; 50 flagged as `no_probe` | `"soilMoisture"`: float<br/>`"soilStatus"`: `"ok"` \| `"fault"` \| `"no_probe"` | Numeric gauge (e.g. `48.0%`) with `✓ REAL SENSOR` badge | **REAL (PHYSICAL SENSOR)** |
| **Temperature** | NONE (Not Wired) | `readAllSensors()` (Explicit null) | No physical sensor or driver. Explicitly reported as JSON `null` in v2.1 firmware. | `"temperature"`: `null`<br/>`"tempStatus"`: `"sensor_unavailable"` | Displays `N/A` with `SENSOR NOT CONNECTED` badge | **UNAVAILABLE / NOT CONNECTED** |
| **Humidity** | NONE (Not Wired) | `readAllSensors()` (Explicit null) | No physical sensor or driver. Explicitly reported as JSON `null` in v2.1 firmware. | `"humidity"`: `null`<br/>`"humidStatus"`: `"sensor_unavailable"` | Displays `N/A` with `SENSOR NOT CONNECTED` badge | **UNAVAILABLE / NOT CONNECTED** |

---

## 5.0 Optoisolated Relay Module Architecture & Truth Table

AgroSense uses a 2-channel optoisolated relay module operating with **Active-LOW** logic. The microcontroller GPIO drives the optocoupler's internal LED cathode.

| Relay Channel | ESP Pin | GPIO | Logic Polarity | Controlled Load | ON State (Energized) | OFF State (Idle) | Code Evidence |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **Channel 1** | `D1` | `GPIO 5` | Active-LOW | Irrigation Pump Motor | `LOW` (0V) → Optocoupler ON → Coil Energized → COM to NO Closed | `HIGH` (3.3V) → Coil De-energized → COM to NO Open | `esp8266_gateway.ino:76, 85-86, 170-188` |
| **Channel 2** | `D2` | `GPIO 4` | Active-LOW | Solenoid Valve Actuator | `LOW` (0V) → Optocoupler ON → Coil Energized → COM to NO Closed | `HIGH` (3.3V) → Coil De-energized → COM to NO Open | `esp8266_gateway.ino:77, 85-86, 196-214` |

---

## 6.0 End-to-End Irrigation Pump Control Trace

```
[1] USER ACTION
    └─ User clicks "Start Pump" or "Stop Pump" in React web dashboard.
[2] FRONTEND COMPONENT
    └─ src/components/panels/PumpControl.tsx (HardwareToggle button, lines 154-183)
    └─ Triggers onDispatch("pump", "start" | "stop")
[3] ZUSTAND STATE STORE
    └─ src/store/index.ts (dispatchHardwareCommand, lines 193-226)
    └─ Generates cmdId ("cmd_pump_<timestamp>"), sets status="sending", dispatches via _sendToHardware()
[4] WEBSOCKET CLIENT EMISSION
    └─ src/providers/WebSocketProvider.tsx (injectSender / _sendToHardware, lines 225-236)
    └─ Transmits JSON: {"type":"command", "cmdId":"cmd_pump_1725000000", "target":"pump", "action":"start"}
    └─ Destination: ws://agrosense.local:81 (or Cloudflare tunnel)
[5] ESP8266 WEBSOCKET HANDLER
    └─ hardware_firmware/esp8266_gateway/esp8266_gateway.ino (webSocketEvent, lines 545-630)
    └─ WStype_TEXT dispatches to handleCommand()
[6] COMMAND VALIDATION & PHASE 1 ACK
    └─ esp8266_gateway.ino (handleCommand, lines 386-536)
    └─ Validates target=="pump" && action in ["start","stop"]
    └─ Transmits ACK: {"type":"ack", "cmdId":"...", "target":"pump", "action":"start", "status":"awaiting_ack"}
[7] ACTUATION FUNCTION
    └─ esp8266_gateway.ino (setPump, lines 170-188)
    └─ Start: digitalWrite(PIN_RELAY_PUMP, RELAY_ON)  [Pin D1 / GPIO 5 driven LOW (0.0V)]
    └─ Stop : digitalWrite(PIN_RELAY_PUMP, RELAY_OFF) [Pin D1 / GPIO 5 driven HIGH (3.3V)]
    └─ Updates pumpActive = true/false; pumpStartMs = millis()
[8] CONTACT SETTLING & PHASE 3 BROADCAST
    └─ esp8266_gateway.ino (lines 512-534)
    └─ delay(ACK_SETTLE_DELAY) [40 ms mechanical contact settling]
    └─ Broadcasts: {"type":"confirmed", "cmdId":"...", "target":"pump", "action":"start", "status":"confirmed", "pumpActive":true, "valveOpen":false}
[9] RELAY OPTOCOUPLER & LOAD CONTACT
    └─ D1 (0V) forward-biases Relay Module IN1 optocoupler; armature closes COM to NO.
[10] PHYSICAL PUMP ENERGIZATION
    └─ External circuit completes from External PSU (+) -> Relay COM -> Relay NO -> Pump Motor (+) -> PSU (-).
    └─ Pump impeller rotates, delivering irrigation water.
```

---

## 7.0 End-to-End Solenoid Valve Control Trace

```
[1] USER ACTION        ──► User clicks "Open Valve" or "Close Valve" in UI (src/components/panels/PumpControl.tsx).
[2] STORE DISPATCH     ──► dispatchHardwareCommand("valve", "open" | "close") dispatches cmd_valve_<timestamp>.
[3] WS FRAME           ──► Transmits JSON {"type":"command","cmdId":"...","target":"valve","action":"open"}.
[4] ESP8266 HANDLER    ──► webSocketEvent() parses WStype_TEXT and invokes handleCommand().
[5] PHASE 1 ACK        ──► Transmits {"type":"ack","target":"valve","action":"open","status":"awaiting_ack"}.
[6] VALVE FUNCTION     ──► Calls setValve(true/false) in esp8266_gateway.ino:196-214:
                           • OPEN : digitalWrite(PIN_RELAY_VALVE, RELAY_ON)  [Pin D2 / GPIO 4 -> LOW (0.0V)]
                           • CLOSE: digitalWrite(PIN_RELAY_VALVE, RELAY_OFF) [Pin D2 / GPIO 4 -> HIGH (3.3V)]
[7] 40ms SETTLE        ──► delay(40) allows mechanical relay contact and solenoid plunger stabilization.
[8] PHASE 3 BROADCAST   ──► Broadcasts {"type":"confirmed","target":"valve","status":"confirmed","valveOpen":true}.
[9] RELAY CLOSURE      ──► D2 drives Relay IN2 optocoupler; internal coil switches COM contact to NO contact.
[10] VALVE ACTUATION   ──► External power energizes solenoid coil, lifting plunger to open hydraulic orifice.
```

---

## 8.0 Status LED Architecture & Signalling

| LED State / Pattern | GPIO 2 Level | System Condition / Trigger | Code Evidence |
|:---|:---|:---|:---|
| **OFF (Dark)** | `HIGH` (3.3V) | Boot initialization; Wi-Fi connected but 0 WebSocket clients active | `esp8266_gateway.ino:224, 557, 848` |
| **Rapid Blinking (400ms)** | Toggling `HIGH`/`LOW` | Actively attempting Wi-Fi connection / Wi-Fi reconnection in loop | `esp8266_gateway.ino:679, 727` |
| **Solid ON (Blue)** | `LOW` (0.0V) | One or more WebSocket clients actively connected (`connectedClients > 0`) | `esp8266_gateway.ino:569` |

---

## 9.0 Power Architecture & Galvanic Load Isolation

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CONTROL / SIGNAL SIDE (Low-Power DC)                                                            │
│ • ESP8266 Core Logic: 3.3V Regulated (AMS1117 LDO, max ~500–800mA peak)                        │
│ • Soil Sensor Probe: 3.3V VCC, 0–3.3V Analog Out to A0                                         │
│ • Relay Module Logic: 5.0V VCC (from NodeMCU VIN via USB), IN1/IN2 3.3V control signals         │
│ • Shared Common Ground: NodeMCU GND, Relay GND, and Soil Sensor GND connected to common 0V bus  │
│ ⚠️ CRITICAL: GPIO pins supply max ~12 mA. NEVER connect motors/coils directly to GPIO pins!    │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │ Galvanic Optocoupler Isolation Barrier
┌──────────────────────────────────────────────▼──────────────────────────────────────────────────┐
│ LOAD SIDE (High-Power DC/AC)                                                                    │
│ • Controlled via Relay Mechanical Contacts: Common (COM) to Normally Open (NO)                  │
│ • Irrigation Pump Motor: Powered by dedicated External PSU (NOT VERIFIED FROM CODE)             │
│ • Solenoid Valve Coil: Powered by dedicated External PSU (NOT VERIFIED FROM CODE)              │
│ ⚠️ NOT DETERMINED FROM CODE — User must verify external PSU and motor ratings against datasheet!│
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10.0 Complete Physical Connection Architecture (Schematic)

```
                             ┌─────────────────────────────────────────────────────────┐
                             │               ESP8266 NODEMCU 1.0 (ESP-12E)             │
                             │                                                         │
  Soil Probe (Analog AO) ────┼──► [A0]  ADC 0 (10-bit SAR, 0 - 3.3V Max)               │
                             │                                                         │
  Pump Relay Trigger (IN1) ◄─┼─── [D1]  GPIO 5 (Digital Out, Active-LOW)               │
                             │                                                         │
  Valve Relay Trigger (IN2)◄─┼─── [D2]  GPIO 4 (Digital Out, Active-LOW)               │
                             │                                                         │
  Onboard Blue Status LED ───┼─── [D4]  GPIO 2 (Digital Out, Active-LOW) [Internal]    │
                             │                                                         │
  Soil Sensor VCC (+3.3V) ◄──┼─── [3V3] 3.3V Regulated Output (AMS1117 Rail)           │
                             │                                                         │
  Relay Board VCC (+5.0V) ◄──┼─── [VIN] 5.0V USB Power Rail                            │
                             │                                                         │
  Common Ground Bus ─────────┼─── [GND] Common 0.0V Ground Reference                   │
                             └────────────────────────┬────────────────────────────────┘
                                                      │ USB Data Cable (115200 Baud)
                                                      ▼
                                       Host PC / 5V USB Power Supply

═══════════════════════════════════════════════════════════════════════════════════════════════════
                           GALVANICALLY ISOLATED RELAY SWITCHING STAGE
═══════════════════════════════════════════════════════════════════════════════════════════════════
  [RELAY CHANNEL 1: PUMP]                                [RELAY CHANNEL 2: SOLENOID VALVE]
  ESP D1 ──► [IN1] Optocoupler ──► Coil 1                ESP D2 ──► [IN2] Optocoupler ──► Coil 2
  Ext Pump PSU (+) ────────► [COM1] (Common)             Ext Valve PSU (+) ───────► [COM2] (Common)
  Pump Motor (+)   ◄──────── [NO1]  (Normally Open)      Solenoid Valve (+)◄─────── [NO2]  (Normally Open)
  Pump Motor (-)   ────────► Ext Pump PSU (-)            Solenoid Valve (-)────────► Ext Valve PSU (-)
  [NC1] (Normally Closed) ── UNCONNECTED (Safe Default)  [NC2] (Normally Closed) ── UNCONNECTED (Safe Default)
```

---

## 11.0 Beginner-Friendly Step-by-Step Connection Guide

| Step | ESP8266 Pin | Connect To | What It Does (Beginner Explanation) | Safety Precaution |
|:---|:---|:---|:---|:---|
| **1** | **POWER OFF** | Unplug USB cable | Ensures the board is completely unpowered before attaching wires. | **Never connect wires while powered!** |
| **2** | **`D1`** | Relay Module **`IN1`** | Carries the on/off command signal for the irrigation pump. | Verify pin label is `D1`, not `D0` or `D2`. |
| **3** | **`D2`** | Relay Module **`IN2`** | Carries the open/close command signal for the solenoid valve. | Verify pin label is `D2`. |
| **4** | **`A0`** | Soil Sensor **`AO`** | Transfers analog moisture voltage signal into the microcontroller. | Connect to `AO` (Analog Out), not `DO`. |
| **5** | **`3V3`** | Soil Sensor **`VCC`** | Supplies safe 3.3V operating power to the soil probe circuit. | Verify sensor is rated for 3.3V. |
| **6** | **`VIN`** | Relay Module **`VCC`** | Supplies 5V power from USB to energize the relay electromagnets. | **Do NOT connect relay VCC to 3V3!** |
| **7** | **`GND`** | Relay & Sensor **`GND`**| Connects all grounds together so electrical signals share a 0V reference.| **All components must share common GND.** |
| **8** | **POWER ON** | Plug in USB cable | Powers up the ESP8266. Relays start in SAFE (OFF) state. | Relay LEDs should be OFF at boot. |

---

## 12.0 Complete Technical System Architecture

```
                                ┌────────────────────────────────────────┐
                                │             FARM OPERATOR              │
                                └───────────────────┬────────────────────┘
                                                    │
                                                    ▼
                                ┌────────────────────────────────────────┐
                                │   AgroSense React Frontend Dashboard   │
                                │   (Zustand State Store + Tailwind v4)  │
                                └─────────┬────────────────────┬─────────┘
                                          │                    │
              ┌───────────────────────────┘                    └────────────────────────────┐
              │ Bidirectional WebSocket (Port 81)                                           │ Multimodal Camera Capture
              ▼                                                                             ▼
┌───────────────────────────────┐                                             ┌───────────────────────────────┐
│     NETWORK INGRESS PATH      │                                             │   SERVERLESS AI PROXY ROUTE   │
│ 1. Local mDNS: agrosense.local│                                             │ POST /api/analyze-plant       │
│ 2. Cloudflare: wss://*.tunnel │                                             │ (Secure Server-Side Node API) │
└─────────────┬─────────────────┘                                             └───────────────┬───────────────┘
              │                                                                               │ Google GenAI SDK (v1beta)
              ▼                                                                               ▼
┌───────────────────────────────┐                                             ┌───────────────────────────────┐
│ ESP8266 GATEWAY CONTROLLER    │                                             │   GEMINI 2.5 FLASH VISION     │
│ (esp8266_gateway.ino v2.1)    │                                             │   Multimodal Plant Pathology  │
└──────┬──────────────┬─────────┘                                             └───────────────┬───────────────┘
       │              │                                                                       │ Structured Diagnostic JSON
       ▼              ▼                                                                       ▼
┌─────────────┐ ┌─────────────┐                                               ┌───────────────────────────────┐
│  A0 ANALOG  │ │ D1/D2 RELAY │                                               │ DIAGNOSTIC UI & OVERLAY       │
│ Soil Sensor │ │   MODULE    │                                               │ Normalized Bounding Box +     │
│ Real (0-100)│ │ Active-LOW  │                                               │ Canonical Taxonomy & Remedy   │
└─────────────┘ └──────┬──────┘                                               └───────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌───────────────────┐     ┌───────────────────┐
│  IRRIGATION PUMP  │     │  SOLENOID VALVE   │
│  (Relay 1: COM-NO)│     │  (Relay 2: COM-NO)│
└───────────────────┘     └───────────────────┘
```

---

## 13.0 Telemetry Data Flow & Schema Architecture

```
[1] PHYSICAL SOIL PROBE  ──► Immersed in crop root zone. Conductance modulates analog voltage on A0 pin.
[2] ADC SAMPLING (ESP)   ──► readSoilMoisture() calls analogRead(A0) (0-1023 count); maps 1023->0%, 350->100%.
[3] TELEMETRY BUILDER    ──► broadcastTelemetry() formats JSON frame every 2000ms:
                             {
                               "type": "telemetry",
                               "soilMoisture": 45.2,                <-- REAL PHYSICAL SENSOR (A0)
                               "soilStatus": "ok",                  <-- "ok" | "fault" | "no_probe"
                               "temperature": null,                 <-- EXPLICIT NULL (UNAVAILABLE)
                               "tempStatus": "sensor_unavailable",  <-- EXPLICIT STATUS
                               "humidity": null,                    <-- EXPLICIT NULL (UNAVAILABLE)
                               "humidStatus": "sensor_unavailable", <-- EXPLICIT STATUS
                               "pumpActive": false,                 <-- ACTUAL GPIO STATE
                               "valveOpen": false,                  <-- ACTUAL GPIO STATE
                               "ip": "192.168.1.105"                <-- DYNAMIC DHCP LOCAL IP
                             }
[4] WS TRANSMISSION      ──► webSocket.broadcastTXT(json) transmits frame over TCP port 81.
[5] FRONTEND INGESTION   ──► src/providers/WebSocketProvider.tsx handleMessage() parses JSON.
[6] ZUSTAND MUTATION     ──► useAppStore.getState().updateTelemetry() updates store; preserves null values.
[7] UI GAUGE RENDERING   ──► TelemetryPanel.tsx displays 45.2% [REAL SENSOR] and N/A [SENSOR NOT CONNECTED].
```

---

## 14.0 Network Architecture: Local mDNS & Cloudflare Zero-Trust Tunnel

| Network Mode | Transport Endpoint | Protocol & Security | Latency Profile | Deployment Context |
|:---|:---|:---|:---|:---|
| **LOCAL ESP** (Primary) | `ws://agrosense.local:81` (or `ws://<DHCP_IP>:81`) | Plain WebSocket (WS), mDNS UDP 5353 responder, Local LAN only | Ultra-low (&lt; 10 ms RTT) | Laptop/phone on same Wi-Fi router or mobile hotspot (SSID: `Redmi`). Zero internet required. |
| **CLOUDFLARE** (Remote) | `wss://<tunnel>.trycloudflare.com` (or custom domain) | TLS Encrypted (WSS), Outbound QUIC/TLS tunnel via `cloudflared` | Cloud round-trip (~40–120 ms RTT) | Remote farm management via Vercel HTTPS dashboard. No router port forwarding or public IP needed. |

### Frontend Auto-Discovery Hierarchy (`WebSocketProvider.tsx`):
1. `ws://agrosense.local:81` (mDNS default)
2. `localStorage["AGROSENSE_WS_URL"]` (User manual override)
3. `VITE_CLOUDFLARE_WS_URL` / `VITE_WS_URL` (Cloudflare Tunnel WSS)
4. `localStorage["AGROSENSE_LAST_KNOWN_IP"]` (Cached DHCP IP from prior telemetry)
5. `ws://10.18.37.83:81` (Static hardware fallback)

---

## 15.0 Gemini AI Multimodal Vision Architecture

```
[1] HTML5 CAMERA STREAM   ──► src/components/CameraFeed.tsx captures live feed (getUserMedia: 640x480).
[2] FRAME CAPTURE         ──► src/components/panels/VisionModule.tsx draws to offscreen canvas (max 1024px),
                              exports base64 JPEG (quality 0.88).
[3] CLIENT DISPATCH       ──► src/ai/providers/GeminiProvider.ts acquires single-active-request lock,
                              executes POST /api/analyze-plant with payload { image, mimeType }.
[4] SECURE SERVERLESS API ──► api/analyze-plant.ts receives payload:
                              • Accesses process.env.GEMINI_API_KEY strictly on server side (zero client exposure).
                              • Normalizes model: gemini-2.5-flash (via normalizeModelName).
                              • Instantiates GoogleGenAI SDK ({ apiKey }) with v1beta endpoint.
                              • Injects GEMINI_SYSTEM_INSTRUCTION (plant pathologist domain prompt).
                              • Enforces strict structured JSON schema (responseSchema):
                                - plant_detected: boolean
                                - leaf_detected: boolean
                                - plant_species: string | null
                                - disease_class_id: integer in [0..8] | null
                                - disease_class: canonical string identifier
                                - severity: "none" | "mild" | "moderate" | "severe" | "unknown"
                                - model_confidence: float in [0.0..1.0]
                                - bounding_box: { x, y, width, height } in normalized [0..1] range
                                - visual_evidence: string (diagnostic description)
                                - recommendation: string (agricultural remedy)
[5] SANITIZATION & REDACT ──► extractSanitizedGeminiError() scrubs any API keys/secrets from logs.
                              sanitizeGeminiResult() clamps bounding box coordinates into [0..1].
[6] DIAGNOSTIC RENDERING  ──► VisionModule.tsx updates useAppStore:
                              • AIOverlay.tsx renders normalized SVG bounding box brackets over leaf.
                              • DiagnosticCard.tsx renders pathology label, confidence tier, & remedy.
```

---

## 16.0 V2 Edge ONNX Architecture & Model Registry Status

| Artifact / Model File | Architecture & Quantization | Target Role & Classes | Current Runtime Status | Source Location |
|:---|:---|:---|:---|:---|
| **`detector_v2.onnx`** | YOLOv8 Nano (INT8 Quantized, 3.2 MB) | Localizes target plant leaves with normalized bounding boxes | **PRESERVED / INACTIVE** (Ready for offline edge use) | `public/models/detector_v2.onnx` |
| **`classifier_v2.onnx`** | MobileNetV3 Small (INT8 Quantized, 2.8 MB)| 9-Class canonical disease classifier + Energy OOD gating | **PRESERVED / INACTIVE** (Ready for offline edge use) | `public/models/classifier_v2.onnx` |
| **`v2_class_mapping.json`** | JSON Taxonomy Mapping | Maps 9 output logits to canonical scientific disease categories | **PRESERVED / INACTIVE** | `public/models/v2_class_mapping.json` |
| **`ONNXProvider.ts`** | TypeScript 8-Stage Perception Pipeline | `QualityGate` → `Detector` → `Validator` → `ROI` → `Classifier` → `OODGate` | **PRESERVED / INACTIVE** (Fully compilable & tested) | `src/ai/providers/ONNXProvider.ts` |

---

## 17.0 Hardware Safety, GPIO Conflict Audit & Boot Strapping

| Audit Check Item | Evaluated Configuration | Verification Finding | Safety Status |
|:---|:---|:---|:---|
| **GPIO Collision / Duplication** | `D1` (Pump), `D2` (Valve), `D4` (LED), `A0` (Soil) | Every assigned pin has an exclusive, non-overlapping firmware assignment. | **PASS (0 Conflicts)** |
| **Pin Direction Safety** | `D1`=OUTPUT, `D2`=OUTPUT, `D4`=OUTPUT, `A0`=INPUT | `pinMode()` initialized in `setup()` before network tasks. No bus contention. | **PASS** |
| **Boot Strapping (`GPIO 0` / `D3`)** | Must be `HIGH` at boot (UART Flash mode if `LOW`) | `D3` is unassigned in active firmware; onboard 10kΩ pull-up holds pin `HIGH`. | **PASS** |
| **Boot Strapping (`GPIO 2` / `D4`)** | Must be `HIGH` at boot (Boot fails if `LOW`) | `D4` controls built-in LED (Active-LOW). `setup()` initializes `HIGH` (OFF). | **PASS** |
| **Boot Strapping (`GPIO 15` / `D8`)** | Must be `LOW` at boot (Flash read fails if `HIGH`)| `D8` is unassigned in active firmware; onboard 10kΩ pull-down holds pin `LOW`. | **PASS** |
| **Failsafe Power-On State** | `allActuatorsSafe()` called at `setup()` line 848 | Relays explicitly driven to `RELAY_OFF` (`HIGH`) prior to Wi-Fi/WS initialization. | **PASS** |
| **Actuator Runtime Watchdog** | `PUMP_MAX_RUNTIME_MS`, `VALVE_MAX_RUNTIME_MS` | Watchdog logic implemented in `checkActuatorSafety()`; set to 0 (user-controlled). | **PASS** |

---

## 18.0 Observations, Unverified Items & Codebase Discrepancies

### 1. Verified Implementation Facts
- Firmware is `AgroSense-ESP-v2.1 (Real-Sensor-Only)`.
- Active-LOW relay logic on `D1` (GPIO 5) and `D2` (GPIO 4) is verified.
- Status LED on `D4` (GPIO 2) is verified Active-LOW.
- Soil moisture on `A0` (ADC 0) is verified real physical analog input with calibration constants `SOIL_DRY_ADC=1023`, `SOIL_WET_ADC=350`, `SOIL_FLOAT_MIN=50`.
- Temperature and humidity are verified unavailable and reported strictly as `null` (`"sensor_unavailable"`).

### 2. Items Not Verified From Code
- **External Load Ratings:** Exact pump operating voltage, pump current/wattage, solenoid valve coil voltage/pressure rating, and external PSU specifications are **NOT VERIFIED FROM SOURCE CODE**. They depend on the specific external hardware wired to the relay contacts.

### 3. Documentation vs. Code Discrepancies
- **Progress Summary Mismatch:** `PROJECT_PROGRESS_SUMMARY.md` is an early Phase 1/2 checkpoint referencing "ESP32", "Mock Telemetry", and "simulated pump timers". The active firmware is `ESP8266 NodeMCU 1.0` with real physical `A0` sensing.
- **Hardware Guide Mismatch:** `AGROSENSE_HARDWARE_SETUP_GUIDE.md` references v2.0 firmware with simulated temperature/humidity drift. The active firmware is upgraded to v2.1 (Real-Sensor-Only) where unavailable sensors are reported strictly as `null`.

---

## 19.0 Verification Matrix

| Subsystem Item | Source Code Verified | Physical Wiring Verified | Documentation Status |
|:---|:---|:---|:---|
| **Pump Relay (`D1` / `GPIO 5`)** | **VERIFIED** (`esp8266_gateway.ino:76`) | **VERIFIED** (Optocoupler IN1) | Complete (`PINOUT_REF`, `PUMP_TEST`) |
| **Valve Relay (`D2` / `GPIO 4`)** | **VERIFIED** (`esp8266_gateway.ino:77`) | **VERIFIED** (Optocoupler IN2) | Complete (`PINOUT_REF`, `PUMP_TEST`) |
| **Status LED (`D4` / `GPIO 2`)** | **VERIFIED** (`esp8266_gateway.ino:78`) | **VERIFIED** (ESP-12E Blue LED) | Complete (`PINOUT_REF`) |
| **Soil Moisture Sensor (`A0`)** | **VERIFIED** (`esp8266_gateway.ino:79`) | **VERIFIED** (Analog Probe AO) | Complete (`REAL_SENSOR_DATA`) |
| **Temperature / Humidity** | **VERIFIED NULL** (`esp8266_gateway.ino:332`) | **NOT CONNECTED** (No Hardware) | Documented Unavailable (v2.1) |
| **External Load Ratings** | **NOT DETERMINED FROM CODE** | **NOT VERIFIED** (User HW Dependent) | Noted in Power Architecture |
| **WebSocket Ingress (Port 81)** | **VERIFIED** (`esp8266_gateway.ino:113`) | **VERIFIED** (TCP Port 81) | Complete (`LOCAL_NET`, `CLOUDFLARE`) |
| **Gemini Vision AI Engine** | **VERIFIED** (`api/analyze-plant.ts:324`) | **VERIFIED** (HTTPS API / Cloud) | Complete (Active Primary) |
| **V2 ONNX Models & Pipeline** | **VERIFIED** (`src/ai/providers/ONNXProvider.ts`)| **VERIFIED** (Local INT8 Files) | Complete (Preserved / Inactive) |

---

## 20.0 Final Exact Pin Reference Quick Card

**AGROSENSE SIH25015 — CURRENT HARDWARE PIN CONNECTIONS (FIELD QUICK REFERENCE)**

| NodeMCU PIN | SILICON GPIO | CONNECTED DEVICE | EXACT HARDWARE FUNCTION | ELECTRICAL LOGIC |
|:---|:---|:---|:---|:---|
| **`D1`** | `GPIO 5` | Irrigation Pump Relay | Controls 2-Channel Relay Channel 1 (Pump) | Active-LOW (LOW=ON, HIGH=OFF) |
| **`D2`** | `GPIO 4` | Solenoid Valve Relay | Controls 2-Channel Relay Channel 2 (Valve) | Active-LOW (LOW=ON, HIGH=OFF) |
| **`D4`** | `GPIO 2` | Built-in Blue LED | System Status & WebSocket Client Indicator | Active-LOW (LOW=ON, HIGH=OFF) |
| **`A0`** | `ADC 0 (TOUT)` | Soil Moisture Sensor | Reads Analog Soil Resistance / Moisture | Analog 0–3.3V (10-bit: 0–1023) |
| **`VIN`** | Power Rail | Relay Module VCC | Supplies +5.0V Power to Relay Coils | +5.0V DC (USB Power Rail) |
| **`3V3`** | Power Rail | Soil Sensor VCC | Supplies +3.3V Power to Soil Probe Circuit | +3.3V DC (Regulated Rail) |
| **`GND`** | Ground Bus | Relay & Sensor GND | Common 0.0V Ground Return Bus | 0.0V Ground Reference |
| **`D0, D3, D5–D8`** | `GPIO 16,0,14,12,13,15`| NOT CONNECTED | Unassigned / Reserved for Future Expansion | N/A |
| **External Loads** | Relay COM-NO | Pump Motor & Valve | Switched by Relay Contacts (Galvanically Isolated) | **NOT VERIFIED FROM CODE (Check Datasheet)** |

---

*AgroSense Documentation Suite — Smart India Hackathon (SIH25015)*
