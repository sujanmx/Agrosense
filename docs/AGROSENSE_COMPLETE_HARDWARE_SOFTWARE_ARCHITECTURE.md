# AgroSense Complete Hardware & Software Architecture
### A Comprehensive High-School Engineering Guide to IoT, Microcontrollers, and AI-Powered Agriculture
**Project:** AgroSense SIH25015  
**Firmware Version:** `AgroSense-ESP-v2.0`  
**Target Hardware:** NodeMCU 1.0 (ESP-12E / ESP8266EX)  
**Document Classification:** Comprehensive Technical & Educational Reference  

---

## Table of Contents
1. [Introduction & Project Philosophy](#1-introduction--project-philosophy)
2. [Phase 1 — ESP8266 Hardware Identity & Specifications](#2-phase-1--esp8266-hardware-identity--specifications)
3. [Phase 2 — Complete GPIO Pin Audit](#3-phase-2--complete-gpio-pin-audit)
4. [Phase 3 — Physical Connection Map](#4-phase-3--physical-connection-map)
5. [Phase 4 — Power Architecture & Electrical Safety](#5-phase-4--power-architecture--electrical-safety)
6. [Phase 5 — Relay Module Deep-Dive](#6-phase-5--relay-module-deep-dive)
7. [Phase 6 — Soil Moisture Sensor Electrical Analysis](#7-phase-6--soil-moisture-sensor-electrical-analysis)
8. [Phase 7 — Sensor Classification (Physical vs. Simulated)](#8-phase-7--sensor-classification-physical-vs-simulated)
9. [Phase 8 — The High-School Breadboard Guide](#9-phase-8--the-high-school-breadboard-guide)
10. [Phase 9 — Wire-by-Wire Assembly Manual](#10-phase-9--wire-by-wire-assembly-manual)
11. [Phase 10 — Visual Breadboard Wiring Diagram](#11-phase-10--visual-breadboard-wiring-diagram)
12. [Phase 11 — High-Current Actuators (Pump & Solenoid)](#12-phase-11--high-current-actuators-pump--solenoid)
13. [Phase 12 — Firmware Boot Safety & Hardware Trust Pipeline](#13-phase-12--firmware-boot-safety--hardware-trust-pipeline)
14. [Phase 13 — Local Network Fundamentals (IP, DHCP, DNS, Ports)](#14-phase-13--local-network-fundamentals-ip-dhcp-dns-ports)
15. [Phase 14 — Multicast DNS (`agrosense.local`) In Action](#15-phase-14--multicast-dns-agrosenselocal-in-action)
16. [Phase 15 — Frontend Connection Engine & Candidate Hierarchy](#16-phase-15--frontend-connection-engine--candidate-hierarchy)
17. [Phase 16 — Hybrid Cloudflare Remote Architecture & WSS](#17-phase-16--hybrid-cloudflare-remote-architecture--wss)
18. [Phase 17 — Full End-to-End System Software Architecture](#18-phase-17--full-end-to-end-system-software-architecture)

---

## 1. Introduction & Project Philosophy

Welcome to **AgroSense**! AgroSense is an open-architecture, smart-agriculture IoT system that bridges the physical world of soil, pumps, and water valves with the digital world of real-time web dashboards and Artificial Intelligence.

To understand this system, think of it like the human body:
- **The Physical Sensors (Nerves):** Measure moisture in the soil.
- **The Microcontroller / ESP8266 (Spinal Cord):** Reads electrical signals, communicates locally, and triggers fast reflexes.
- **The Actuators / Relays (Muscles):** Turn heavy water pumps and valves on and off.
- **The React Dashboard & Gemini AI (Brain):** Displays live status to the farmer and analyzes plant leaf photos for disease.

---

## 2. Phase 1 — ESP8266 Hardware Identity & Specifications

All information in this section is verified directly from project code, Arduino CLI toolchains, and hardware flash registries.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HARDWARE IDENTITY MANIFEST                         │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ Attribute                │ Project Value [Source of Truth]                  │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ Target Board             │ NodeMCU 1.0 (ESP-12E Module) [CONFIRMED CODE]    │
│ Microcontroller (MCU)    │ Espressif ESP8266EX (32-bit Xtensa LX106 @ 80MHz)│
│ Flash Memory Size        │ 4 Megabytes (32 Megabits) SPI Flash              │
│ Arduino FQBN             │ esp8266:esp8266:nodemcuv2 [CONFIRMED ARDUINO-CLI]│
│ Arduino Core Platform    │ ESP8266 Core v3.1.2 [CONFIRMED ARDUINO-CLI]      │
│ Firmware Version Tag     │ AgroSense-ESP-v2.0 [CONFIRMED CODE]              │
│ Serial UART Baud Rate    │ 115200 baud, 8N1 [CONFIRMED CODE]                │
│ Primary Wi-Fi Mode       │ Station Mode (WIFI_STA) [CONFIRMED CODE]         │
│ Compiled Wi-Fi SSID      │ Redmi [CONFIRMED CODE]                           │
│ Local mDNS Hostname      │ agrosense.local [CONFIRMED CODE]                 │
│ Local WebSocket Server   │ Port 81 (TCP) [CONFIRMED CODE]                   │
│ WebSocket Library        │ WebSocketsServer by Markus Sattler v2.7.2        │
│ JSON Serialization Lib   │ ArduinoJson by Benoît Blanchon v7.4.3            │
│ Local mDNS Library       │ ESP8266mDNS.h (Bundled in ESP8266 Core 3.1.2)    │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 3. Phase 2 — Complete GPIO Pin Audit

Microcontroller pins are not all identical. On the ESP8266, some pins are wired to internal flash memory, some control the boot mode, and some have internal pull-up resistors.

```text
┌──────────┬────────┬───────┬────────────────────────┬───────────┬───────────────────────────┬──────────────┬───────────────────────────────┬─────────────────┐
│ ESP Pin  │ GPIO   │ Used? │ Connected Component    │ Direction │ Hardware Purpose          │ Active State │ Boot Strap Behavior           │ Project Source  │
├──────────┼────────┼───────┼────────────────────────┼───────────┼───────────────────────────┼──────────────┼───────────────────────────────┼─────────────────┤
│ A0       │ ADC0   │ YES   │ Soil Moisture Sensor   │ INPUT     │ Analog moisture (0–1023)  │ Analog (0–3V)│ Input only. Max 3.3V on board.│ CONFIRMED CODE  │
│ D0       │ GPIO16 │ NO    │ None (Unused)          │ N/A       │ Sleep Wake / General I/O  │ High on boot │ No PWM/Interrupt. Safe.       │ NOT SPECIFIED   │
│ D1       │ GPIO5  │ YES   │ Pump Relay Input (IN1) │ OUTPUT    │ Drives Irrigation Pump    │ Active-LOW   │ General GPIO. Safe at boot.   │ CONFIRMED CODE  │
│ D2       │ GPIO4  │ YES   │ Valve Relay Input (IN2)│ OUTPUT    │ Drives Solenoid Valve     │ Active-LOW   │ General GPIO / I2C SDA. Safe. │ CONFIRMED CODE  │
│ D3       │ GPIO0  │ NO    │ None (Unused)          │ N/A       │ Flash Mode Boot Pin       │ Pull-up HIGH │ MUST be HIGH at boot. Avoid.  │ ESP-12E SPEC    │
│ D4       │ GPIO2  │ YES   │ Built-in Blue LED      │ OUTPUT    │ Status & Traffic Blink    │ Active-LOW   │ MUST be HIGH at boot. TXD1 log│ CONFIRMED CODE  │
│ D5       │ GPIO14 │ NO    │ None (Unused)          │ N/A       │ Hardware SPI Clock (SCLK) │ High-Z       │ General GPIO. Safe after boot.│ NOT SPECIFIED   │
│ D6       │ GPIO12 │ NO    │ None (Unused)          │ N/A       │ Hardware SPI MISO         │ High-Z       │ General GPIO. Safe after boot.│ NOT SPECIFIED   │
│ D7       │ GPIO13 │ NO    │ None (Unused)          │ N/A       │ Hardware SPI MOSI / RXD2  │ High-Z       │ General GPIO. Safe after boot.│ NOT SPECIFIED   │
│ D8       │ GPIO15 │ NO    │ None (Unused)          │ N/A       │ Boot Selection Pin        │ Pull-down LOW│ MUST be LOW at boot. Avoid.   │ ESP-12E SPEC    │
│ TX       │ GPIO1  │ NO    │ Serial Monitor Transmit│ OUTPUT    │ UART0 Console Output      │ High         │ Transmits boot logs at 115200.│ CONFIRMED CODE  │
│ RX       │ GPIO3  │ NO    │ Serial Monitor Receive │ INPUT     │ UART0 Console Input       │ High         │ Receives serial data from PC. │ CONFIRMED CODE  │
└──────────┴────────┴───────┴────────────────────────┴───────────┴───────────────────────────┴──────────────┴───────────────────────────────┴─────────────────┘
```

> [!WARNING]
> **Pins to Avoid for Actuators:**
> - **`D3` (GPIO 0):** If pulled LOW during startup, the ESP enters firmware flash mode instead of running your code.
> - **`D8` (GPIO 15):** If pulled HIGH during startup, the ESP fails to boot completely.
> - **`D4` (GPIO 2):** Pulled HIGH internally; emits a burst of debug data at boot.

---

## 4. Phase 3 — Physical Connection Map

This table represents the **only physical wire connections** established by the AgroSense firmware:

```text
┌─────────────────────────┬─────────────────────────┬──────────────┬────────────────────────┬──────────────────────────────────────────┐
│ FROM (NodeMCU Pin)      │ TO (Periphery Pin)      │ WIRE TYPE    │ ELECTRICAL SIGNAL      │ SYSTEM PURPOSE                           │
├─────────────────────────┼─────────────────────────┼──────────────┼────────────────────────┼──────────────────────────────────────────┤
│ Pin D1 (GPIO 5)         │ Relay Module IN1        │ Female-Male  │ Digital (LOW=ON)       │ Irrigation Pump relay coil switch signal │
│ Pin D2 (GPIO 4)         │ Relay Module IN2        │ Female-Male  │ Digital (LOW=ON)       │ Solenoid Valve relay coil switch signal  │
│ Pin A0 (ADC 0)          │ Soil Sensor AO / AOUT   │ Female-Male  │ Analog Voltage (0–3.3V)│ Variable voltage representing wetness    │
│ Pin 3V3                 │ Soil Sensor VCC         │ Female-Male  │ +3.3 Volts DC Regulated│ Low-voltage power for sensor amplifier   │
│ Pin VIN (or Ext 5V)     │ Relay Module VCC        │ Female-Male  │ +5.0 Volts DC Power    │ Coil operating power for mechanical relay│
│ Pin GND                 │ Soil Sensor GND         │ Female-Male  │ 0V Ground Return       │ Shared electrical reference plane        │
│ Pin GND                 │ Relay Module GND        │ Female-Male  │ 0V Ground Return       │ Shared electrical reference plane        │
└─────────────────────────┴─────────────────────────┴──────────────┴────────────────────────┴──────────────────────────────────────────┘
```

---

## 5. Phase 4 — Power Architecture & Electrical Safety

A fundamental rule in electrical engineering is keeping **Logic Power** separate from **Load Power**.

```text
                     ┌─────────────────────────────────────────────────────────┐
                     │               AGROSENSE POWER ARCHITECTURE              │
                     └─────────────────────────────────────────────────────────┘

        [ USB 5V Power Supply ] ─────────────────────────┐
                   │                                     │
                   ▼ (Micro-USB Cable)                   ▼
        ┌─────────────────────┐               ┌─────────────────────┐
        │   NodeMCU Board     │               │ 2-Channel Relay     │
        │                     │               │ Logic & Coils       │
        │ [AMS1117 Regulator] │               │                     │
        │   5V ──► 3.3V Rail  │               │   VCC ◄── 5V (VIN)  │
        └──────────┬──────────┘               │   GND ◄── GND       │
                   │                          └─────────────────────┘
                   ▼ (+3.3V Logic)
        ┌─────────────────────┐
        │ Soil Moisture Probe │
        │   VCC ◄── 3.3V      │
        │   GND ◄── GND       │
        └─────────────────────┘

  ═════════════════════════════════════════════════════════════════════════════════════
   ISOLATION BARRIER — LOGIC NEVER TOUCHES HIGH-CURRENT MOTORS DIRECTLY
  ═════════════════════════════════════════════════════════════════════════════════════

        [ External DC Power Supply ] ──► [ Relay COM ] ──► [ Relay NO ] ──► [ Pump / Valve ]
```

### Critical High-School Concept: Why Can't the ESP Power a Pump Directly?
1. **Current Limit:** An ESP8266 GPIO pin can safely provide only **12 milliamperes (0.012 A)**. A small 12V submersible water pump requires **500 to 2000 milliamperes (0.5 to 2.0 A)**. Connecting a motor directly to an ESP pin will immediately melt the internal silicon chip.
2. **Inductive Flyback (Back-EMF):** Electric motors and solenoid coils have wire coils inside. When a motor is turned off, its magnetic field collapses, generating a massive reverse voltage spike of **50 to 200 Volts**. The relay module contains **optocouplers** (light beams) and **flyback diodes** to isolate and protect the ESP from these destruction spikes.

---

## 6. Phase 5 — Relay Module Deep-Dive

A relay is simply an **electrically-operated mechanical switch**.

```text
               ┌────────────────────────────────────────────────┐
               │         RELAY TERMINAL BLOCK ANATOMY           │
               ├────────────────────────────────────────────────┤
               │                                                │
               │   [ NO ] ─── Normally Open contact             │
               │              (Disconnected when relay is OFF;  │
               │               Connects to COM when relay is ON)│
               │                                                │
               │   [ COM ] ── Common contact                    │
               │              (Connect incoming power here)     │
               │                                                │
               │   [ NC ] ─── Normally Closed contact           │
               │              (Connected when relay is OFF;     │
               │               Disconnects when relay is ON)    │
               │                                                │
               └────────────────────────────────────────────────┘
```

### Relay Logic Verified from Project Code:
- **Active-LOW Logic:**  
  `RELAY_ON = LOW (0V)` ➔ Energizes the relay coil, clicking contacts closed (`COM` connects to `NO`).  
  `RELAY_OFF = HIGH (3.3V)` ➔ De-energizes the coil, contacts spring open (`COM` disconnected from `NO`).
- **Startup State:** `allActuatorsSafe()` forces both `D1` and `D2` to `HIGH` immediately upon booting so water never flows unexpectedly.
- **`JD-VCC` Terminal:** On many dual-relay boards, a jumper connects `VCC` and `JD-VCC`. *VERIFY THE MODULE LABEL/DATASHEET BEFORE CONNECTING.*

---

## 7. Phase 6 — Soil Moisture Sensor Electrical Analysis

The soil moisture sensor measures the electrical conductivity between two metal probe prongs pushed into the dirt.

```text
               DRY SOIL (High Resistance)             WET SOIL (Low Resistance)
             ┌───────────────────────────┐         ┌───────────────────────────┐
             │ Air/Dry Soil = Poor Cond. │         │ Water + Minerals = Cond.  │
             │ Resistance ≈ VERY HIGH    │         │ Resistance ≈ LOW          │
             │ Voltage at AO ≈ 3.3 Volts │         │ Voltage at AO ≈ 1.1 Volts │
             │ Raw ADC Value ≈ 1023      │         │ Raw ADC Value ≈ 350       │
             │ Mapped Moisture = 0.0%    │         │ Mapped Moisture = 100.0%  │
             └───────────────────────────┘         └───────────────────────────┘
```

### Calibration Math in Firmware:
```cpp
#define SOIL_DRY_ADC    1023    // Dry air baseline
#define SOIL_WET_ADC    350     // Water immersion baseline
#define SOIL_FLOAT_MIN  50      // Floating pin threshold

float mapped = (float)map(rawADC, SOIL_DRY_ADC, SOIL_WET_ADC, 0, 100);
return constrain(mapped, 0.0f, 100.0f);
```

If the raw ADC reads less than `50`, the firmware detects that the probe wire is unplugged (floating pin) and triggers software fallback simulation.

---

## 8. Phase 7 — Sensor Classification (Physical vs. Simulated)

Transparency in engineering is paramount. Here is the strict classification of data sources in AgroSense:

```text
┌─────────────────────┬───────────────────┬─────────────────────────────────────────────────────────────┐
│ Sensor Reading      │ Classification    │ Engineering Truth & Implementation Rationale                │
├─────────────────────┼───────────────────┼─────────────────────────────────────────────────────────────┤
│ Soil Moisture (%)   │ PHYSICAL SENSOR   │ Sampled live every 2000ms from physical Analog Pin A0.      │
│ Temperature (°C)    │ SOFTWARE SIMULATED│ Generated in code via `applyDrift()` (20°C to 42°C range).  │
│ Humidity (%RH)      │ SOFTWARE SIMULATED│ Generated in code via `applyDrift()` (28% to 92% range).    │
│ Plant Health / AI   │ HYBRID AI VISION  │ Processed live via Google Gemini 2.5 Flash & ONNX fallback. │
└─────────────────────┴───────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 9. Phase 8 — The High-School Breadboard Guide

If you have never used a breadboard before, it is simply a grid of metal clips inside plastic holes that allows you to connect wires without soldering.

```text
                           BREADBOARD INTERNAL CONNECTIONS
   
    (+)  [ ○ ○ ○ ○ ○ ... ○ ○ ○ ○ ○ ]  ◄── (+) Power Rail: Connected all the way along horizontally
    (-)  [ ○ ○ ○ ○ ○ ... ○ ○ ○ ○ ○ ]  ◄── (-) Ground Rail: Connected all the way along horizontally
    
          A   B   C   D   E
    01   [ ○ ─ ○ ─ ○ ─ ○ ─ ○ ]  ◄── Row 1 (A-E): Connected together VERTICALLY in a 5-hole strip
    02   [ ○ ─ ○ ─ ○ ─ ○ ─ ○ ]
    03   [ ○ ─ ○ ─ ○ ─ ○ ─ ○ ]
    ===========================  ◄── CENTER DIVIDER TRENCH (No electrical connection across trench)
    01   [ ○ ─ ○ ─ ○ ─ ○ ─ ○ ]  ◄── Row 1 (F-J): Separate 5-hole strip on the other side
    02   [ ○ ─ ○ ─ ○ ─ ○ ─ ○ ]
          F   G   H   I   J
    
    (+)  [ ○ ○ ○ ○ ○ ... ○ ○ ○ ○ ○ ]
    (-)  [ ○ ○ ○ ○ ○ ... ○ ○ ○ ○ ○ ]
```

### Rules for Placing the NodeMCU:
1. Place the NodeMCU **directly across the center divider trench**.
2. The left pins go into column `E`, and the right pins go into column `F`.
3. This ensures that pin `D1` on the left is **not shorted** to pin `D2` on the right!

---

## 10. Phase 9 — Wire-by-Wire Assembly Manual

Follow these step-by-step instructions with your power supply disconnected:

```text
STEP 1: Common Ground Rail
• Find the NodeMCU pin marked 'GND'.
• Insert a jumper wire from NodeMCU GND to the Blue/Negative (-) rail on the breadboard.
• Purpose: Establishes a shared 0V reference.

STEP 2: +3.3V Logic Rail
• Find the NodeMCU pin marked '3V3'.
• Insert a jumper wire from NodeMCU 3V3 to the Red/Positive (+) rail on the breadboard.
• Purpose: Supplies 3.3V power to the soil moisture probe.

STEP 3: Soil Moisture Sensor Power
• Find 'VCC' on the Soil Sensor conditioning board.
• Connect 'VCC' to the Red/Positive (+) 3.3V rail.
• Connect 'GND' on the Soil Sensor to the Blue/Negative (-) ground rail.

STEP 4: Soil Moisture Sensor Signal (A0)
• Find 'AO' or 'AOUT' on the Soil Sensor board.
• Connect 'AO' to the NodeMCU pin marked 'A0'.
• Purpose: Carries analog moisture voltage to the ESP8266 ADC.

STEP 5: Relay Module Signal 1 (Pump)
• Find 'IN1' on the 2-channel Relay Module.
• Connect 'IN1' to the NodeMCU pin marked 'D1'.
• Purpose: Allows GPIO 5 to trigger Relay 1.

STEP 6: Relay Module Signal 2 (Valve)
• Find 'IN2' on the 2-channel Relay Module.
• Connect 'IN2' to the NodeMCU pin marked 'D2'.
• Purpose: Allows GPIO 4 to trigger Relay 2.

STEP 7: Relay Module Power & Ground
• Connect 'GND' on the Relay Module to the Blue/Negative (-) ground rail.
• Connect 'VCC' on the Relay Module to the NodeMCU 'VIN' pin (5V USB rail).
• Caution: VERIFY THE MODULE LABEL/DATASHEET BEFORE CONNECTING.
```

---

## 11. Phase 10 — Visual Breadboard Wiring Diagram

```text
                       AGROSENSE PHYSICAL WIRING SCHEMATIC
                       
  ┌──────────────────────────┐                   ┌──────────────────────────┐
  │   SOIL MOISTURE SENSOR   │                   │  2-CHANNEL RELAY MODULE  │
  │                          │                   │                          │
  │  [ VCC ] ─────────────┐  │                   │  [ VCC ] ─────────────┐  │
  │  [ GND ] ──────────┐  │  │                   │  [ GND ] ──────────┐  │  │
  │  [ AO  ] ───────┐  │  │  │                   │  [ IN1 ] ───────┐  │  │  │
  └─────────────────┼──┼──┼──┘                   │  [ IN2 ] ────┐  │  │  │  │
                    │  │  │                      └──────────────┼──┼──┼──┼──┘
                    │  │  │                                     │  │  │  │
 ═══════════════════╪══╪══╪═════════════════════════════════════╪══╪══╪══╪═════════════
                    │  │  │      NODEMCU 1.0 (ESP-12E)          │  │  │  │
                    │  │  │    ┌───────────────────────┐        │  │  │  │
                    │  │  └───►│ 3V3               VIN │◄───────┼──┼──┼──┘ (5V USB)
                    │  └──────►│ GND               GND │◄───────┼──┼──┘
                    └─────────►│ A0                 D1 │────────┼──┘ (Pump Signal)
                               │ ...                D2 │────────┘    (Valve Signal)
                               │ ...                D4 │── (Built-in Blue Status LED)
                               └───────────────────────┘
```

---

## 12. Phase 11 — High-Current Actuators (Pump & Solenoid)

```text
                         ACTUATOR ISOLATION ARCHITECTURE
                         
   ┌─────────────┐        ┌──────────────────┐        ┌─────────────────────────┐
   │ ESP8266     │ 3.3V   │ Optocoupled      │ 12V DC │ External 12V DC Pump    │
   │ Microchip   ├───────►│ Relay Switch     ├───────►│ (Completely isolated    │
   │ (Controller)│ Signal │ (Mechanical Gate)│ Power  │  from ESP electronics)  │
   └─────────────┘        └──────────────────┘        └─────────────────────────┘
```

> [!CAUTION]
> **HIGH VOLTAGE SAFETY WARNING:**
> - Never wire AC mains electricity (110V/230V wall power) to a breadboard.
> - If working with AC mains voltage, **always consult a certified electrician**.
> - For initial classroom bench testing, keep the relay output screw terminals completely empty.

---

## 13. Phase 12 — Firmware Boot Safety & Hardware Trust Pipeline

To ensure absolute safety in physical irrigation systems, AgroSense uses a **3-Phase Hardware Trust Pipeline**:

```text
                       3-PHASE HARDWARE TRUST PIPELINE
                       
   (1) USER INTENT          (2) AWAITING_ACK           (3) CONFIRMED STATE
   Farmer clicks "START" ──► ESP sends immediate ──► Relay switches mechanically ──► ESP broadcasts
   on React Dashboard        ACK frame to UI          40ms contact settling delay    CONFIRMED to all tabs
   
   UI: [ SENDING ]           UI: [ AWAITING_ACK ]     Relay: [ CLICK ]               UI: [ CONFIRMED ]
```

### Firmware Boot Sequence in `setup()`:
1. **Serial Boot:** Serial console initialized at `115200 baud`.
2. **Safe State First:** `allActuatorsSafe()` forces all relay GPIOs to `HIGH` (OFF) before turning on Wi-Fi.
3. **Wi-Fi Negotiation:** Connects to `Redmi` hotspot using dynamic DHCP.
4. **mDNS Startup:** Registers `agrosense.local` on the local network.
5. **WebSocket Server:** Starts listening on Port `81`.

---

## 14. Phase 13 — Local Network Fundamentals (IP, DHCP, DNS, Ports)

```text
┌──────────────────┬─────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ Concept          │ Real-World Analogy          │ Technical Role in AgroSense                                 │
├──────────────────┼─────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **IP Address**   │ House Street Address        │ Unique numerical identifier on the Wi-Fi (e.g. 192.168.43.5)│
│ **DHCP Server**  │ Hotel Room Key Desk         │ Assigns temporary IP addresses to devices when they connect │
│ **DNS**          │ Global Phonebook            │ Translates public domain names (`google.com`) to public IPs │
│ **mDNS**         │ Local Room Name Callout     │ Translates local hostnames (`agrosense.local`) on home Wi-Fi│
│ **Port Number**  │ Apartment Door Number       │ Identifies the specific app inside the chip (Port `81` = WS)│
│ **WebSocket**    │ Open Telephone Line         │ Persistent full-duplex two-way stream for real-time data    │
└──────────────────┴─────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 15. Phase 14 — Multicast DNS (`agrosense.local`) In Action

```text
  💻 Laptop Browser                                       📟 NodeMCU ESP8266
         │                                                       │
         │ ─── (1) Multicast Query: "Who is agrosense.local?" ─►│ (Listens on UDP 5353)
         │                                                       │
         │ ◄── (2) mDNS Response: "I am at 192.168.43.150" ─────│
         │                                                       │
         │ ─── (3) Open WebSocket: ws://192.168.43.150:81 ─────►│ (Accepts on Port 81)
         │                                                       │
         │ ◄── (4) Live Telemetry Stream (every 2000ms) ────────│
```

---

## 16. Phase 15 — Frontend Connection Engine & Candidate Hierarchy

In [`src/providers/WebSocketProvider.tsx`](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/src/providers/WebSocketProvider.tsx), the connection manager follows this strict candidate sequence:

```text
PRIORITY 1: ws://agrosense.local:81  (Local mDNS ➔ Mode: LOCAL ESP 🟢)
     │ [If fails / times out after 3.0s]
     ▼
PRIORITY 2: localStorage["AGROSENSE_WS_URL"]  (Manual IP override)
     │ [If fails or empty]
     ▼
PRIORITY 3: VITE_CLOUDFLARE_WS_URL  (Cloudflare Remote Tunnel ➔ Mode: CLOUDFLARE ☁️)
     │ [If fails or unconfigured]
     ▼
PRIORITY 4: localStorage["AGROSENSE_LAST_KNOWN_IP"]  (Cached Telemetry IP)
     │ [If fails]
     ▼
PRIORITY 5: ws://10.18.37.83:81  (Static Lab Fallback)
     │ [If all fail]
     ▼
STATUS: DISCONNECTED 🔴 (Trigger exponential backoff retry cycle)
```

---

## 17. Phase 16 — Hybrid Cloudflare Remote Architecture & WSS

```text
1. LOCAL FARM NETWORK (Offline Capable):
   Laptop / Phone ──► Redmi Wi-Fi ──► ws://agrosense.local:81 ──► ESP8266 Gateway
   • Latency: ~4 to 10 milliseconds
   • Internet Access: NOT required

2. REMOTE WORLDWIDE ACCESS (Anywhere):
   Smartphone (Cellular 4G/5G) ──► wss://tunnel.trycloudflare.com ──► Cloudflare Edge ──► ESP8266
   • Latency: ~80 to 200 milliseconds
   • Encryption: TLS/SSL (WSS) required for public web security
```

---

## 18. Phase 17 — Full End-to-End System Software Architecture

```text
                               ┌───────────────────────────────────────────────────────────┐
                               │                 AGROSENSE REACT FRONTEND                  │
                               │  • Vite + React 18 + TypeScript + TailwindCSS + Zustand   │
                               └─────────────┬───────────────────────────────┬─────────────┘
                                             │                               │
                      HTTP POST Leaf Image   │                               │ Live WebSocket Stream
                             (Base64)        │                               │ (ws:// or wss://)
                                             ▼                               │
                       ┌───────────────────────────┐                         │
                       │    VERCEL SERVERLESS      │                         │
                       │    /api/analyze-plant     │                         │
                       └─────────────┬─────────────┘                         │
                                     │                                       │
                    ┌────────────────┴────────────────┐                      │
                    │                                 │                      │
                    ▼                                 ▼                      │
         [ Google Gemini 2.5 Flash ]        [ Local ONNX Runtime ]           │
         Primary Cloud Vision AI Model      Offline INT8 Fallback Model      │
         (Species, Disease, Severity)       (MobileNet / YOLO Detector)      │
                                                                             │
 ════════════════════════════════════════════════════════════════════════════╪══════════════════════════════════
                                                                             │
                                                                             ▼
                                                              ┌───────────────────────────┐
                                                              │  NodeMCU ESP8266 Gateway  │
                                                              │  (Firmware: ESP-v2.0)     │
                                                              │  Port 81 WebSocket Server │
                                                              └──────────────┬────────────┘
                                                                             │
                                              ┌──────────────────────────────┴──────────────────────────────┐
                                              │                                                             │
                                              ▼                                                             ▼
                                     [ ANALOG SENSORS ]                                            [ DIGITAL ACTUATORS ]
                                     • Physical Soil Moisture (A0)                                 • Irrigation Pump Relay (D1)
                                     • Simulated Temperature & Humidity                            • Solenoid Valve Relay (D2)
```

---
*End of Master Architecture Specification — AgroSense SIH25015*
