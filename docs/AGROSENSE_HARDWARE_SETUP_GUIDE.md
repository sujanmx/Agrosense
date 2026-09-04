# AgroSense SIH25015 — Complete Hardware Setup Guide

> **Board:** NodeMCU 1.0 (ESP-12E Module)  
> **Firmware:** AgroSense-ESP-v2.0  
> **Audience:** Complete beginners — assumes you have NEVER connected an ESP8266 before  

---

## 1. INTRODUCTION

Welcome to the AgroSense hardware setup guide! This document covers how to physically connect the components of your AgroSense SIH25015 plant monitoring system.

AgroSense is a smart plant monitoring and irrigation control system powered by an ESP8266 microcontroller. It reads soil moisture from a sensor, controls a water pump and solenoid valve through relays, and communicates with a React web dashboard over WebSocket.

**What this guide will help you do:**
- Identify each component
- Understand what each pin does
- Connect every wire correctly
- Power the system safely
- Verify everything works

---

## 2. COMPONENT CHECKLIST

Before starting, gather the following components.

### Required Components

| # | Component | Purpose |
|---|-----------|---------|
| 1 | **NodeMCU ESP8266 (ESP-12E)** | The "brain" — runs firmware, hosts WebSocket server |
| 2 | **2-Channel Relay Module** (5V, optocoupler-isolated) | Electronic switches to control pump and valve |
| 3 | **Soil Moisture Sensor** (resistive or capacitive) | Measures how wet the soil is |
| 4 | **USB Micro Cable** (must be a DATA cable, not charge-only) | Programs and powers the ESP8266 |
| 5 | **Jumper Wires** (Female-to-Female or Male-to-Female) | Connects components together |

### Optional Components

| # | Component | Purpose |
|---|-----------|---------|
| 1 | **DHT11 / DHT22 Sensor** | Future upgrade — real temperature & humidity |
| 2 | **Breadboard** | Makes connections without soldering |
| 3 | **Terminal Blocks** | Secure screw-terminal wire connections |
| 4 | **Enclosure / Project Box** | Protects electronics from water and dust |
| 5 | **External 5V/12V Power Supply** | Powers pump/solenoid loads via relay |

> [!NOTE]
> Do NOT assume exact electrical ratings for relay modules or sensors. The specific voltage and current requirements depend on the exact product you purchased. **NOT SPECIFIED — USER MUST VERIFY** before connecting power.

---

## 3. PIN-BY-PIN WIRING TABLE

This is your primary reference for connecting the ESP8266 to other components.

| ESP8266 Pin | GPIO | Connect To | Purpose | Notes |
|:------------|:-----|:-----------|:--------|:------|
| **D1** | GPIO5 | Relay Module IN1 | Controls Irrigation Pump | Active-LOW logic (LOW = pump ON) |
| **D2** | GPIO4 | Relay Module IN2 | Controls Solenoid Valve | Active-LOW logic (LOW = valve ON) |
| **D4** | GPIO2 | *(Built-in LED)* | System Status Indicator | Onboard LED — do NOT connect external wire |
| **A0** | ADC0 | Soil Sensor Analog Out (AO) | Reads soil moisture level | 10-bit ADC (0–1023), max 3.3V input |
| **3V3** | — | Soil Sensor VCC | 3.3V power for sensor | **NOT SPECIFIED — USER MUST VERIFY** sensor voltage |
| **VIN** | — | Relay Module VCC | 5V power for relay module | Only available when powered via USB |
| **GND** | — | All component GND pins | Common ground | **ESSENTIAL:** All grounds MUST be connected together |

> [!IMPORTANT]
> **Power Pin Warning:** The `3V3` pin outputs 3.3V. The `VIN` pin provides ~5V when powered via USB. Connect your relay module VCC to `VIN` (5V) and your soil sensor VCC to `3V3` — but **VERIFY** your specific component's voltage requirements first.

---

## 4. VISUAL ASCII WIRING DIAGRAM

### Main ESP8266 Connections

```
      NodeMCU ESP8266 (ESP-12E)
      ┌───────────────────────────┐
      │                           │
      │  A0  ◄────────────────────┼──── Soil Moisture Sensor [AO]
      │                           │
      │  D1  ─────────────────────┼────► Relay Module [IN1] (Pump)
      │                           │
      │  D2  ─────────────────────┼────► Relay Module [IN2] (Valve)
      │                           │
      │  D4  ── (Built-in LED)    │     (No external wire needed)
      │                           │
      │  3V3 ─────────────────────┼────► Soil Sensor [VCC]
      │                           │
      │  VIN ─────────────────────┼────► Relay Module [VCC]
      │                           │
      │  GND ─────────────────────┼────► Common Ground Bus
      │                           │         ├── Relay Module [GND]
      │  GND ─────────────────────┼─────────└── Soil Sensor [GND]
      │                           │
      │  [USB] ◄──── Data Cable ──┼──── Computer
      │                           │
      └───────────────────────────┘
```

### Relay Load Connections (Separate Circuit!)

```
                         Relay Module
                  ┌─────────────────────────┐
 (From ESP D1) ──►│ IN1                     │
 (From ESP D2) ──►│ IN2                     │
                  │                         │
 (Common GND) ──►│ GND                     │
                  │                         │
 (From VIN 5V)──►│ VCC                     │
                  └─────────────────────────┘
                              │
                   Switching Side (Heavy Duty)
                              ▼
                  ┌─────────────────────────┐
 (External       │                         │
  Power +) ─────►│ COM (Common)            │
                  │                         │
 (To Pump/    ◄──│ NO  (Normally Open)     │  ← USE THIS terminal
  Valve +)        │                         │
                  │ NC  (Normally Closed)   │  ← Do NOT use for pump
                  └─────────────────────────┘

  NOTE: The pump/valve NEGATIVE wire connects directly
        back to the external power supply NEGATIVE.
```

> [!WARNING]
> **The relay switching side is a completely separate electrical circuit from the ESP8266.**
> The ESP only controls the relay input signal. The pump/solenoid gets its power from an external power supply, NOT from the ESP8266.

---

## 5. STEP-BY-STEP WIRING — "DO IT LIKE A BABY" GUIDE

Follow these instructions **exactly in order**. Do not skip any step.

> [!CAUTION]
> **SAFETY FIRST:** The ESP8266 must be completely UNPOWERED (USB disconnected) while you are connecting wires. Never connect or disconnect wires while the board is powered.

---

**STEP 1:** Unplug the USB cable from the ESP8266. The board must be completely powered off.

**STEP 2:** Find your 2-channel relay module. Look for the pins labeled `IN1`, `IN2`, `VCC`, and `GND` on the input side.

**STEP 3:** Connect a jumper wire from **`IN1`** on the relay module to pin **`D1`** on the ESP8266. This is your **pump** control signal.

**STEP 4:** Connect a jumper wire from **`IN2`** on the relay module to pin **`D2`** on the ESP8266. This is your **valve** control signal.

**STEP 5:** Connect the **`GND`** pin on the relay module to any **`GND`** pin on the ESP8266. This is the common ground.

**STEP 6:** Connect the **`VCC`** pin on the relay module to the **`VIN`** pin on the ESP8266. This provides 5V power to the relay module.

> [!NOTE]
> **NOT SPECIFIED — USER MUST VERIFY** your relay module's voltage requirement. Most common 2-channel relay modules require 5V. If yours requires a different voltage, use an appropriate external power supply instead of VIN.

**STEP 7:** Find your Soil Moisture Sensor. Locate the pins labeled `AO` (or `A0`), `VCC`, and `GND`.

**STEP 8:** Connect the sensor's **`AO`** (Analog Output) pin to pin **`A0`** on the ESP8266.

**STEP 9:** Connect the sensor's **`VCC`** pin to the **`3V3`** pin on the ESP8266.

> [!NOTE]
> **NOT SPECIFIED — USER MUST VERIFY** your soil sensor's operating voltage. Most work at 3.3V–5V. If your sensor requires 5V, connect VCC to `VIN` instead of `3V3`.

**STEP 10:** Connect the sensor's **`GND`** pin to any **`GND`** pin on the ESP8266. All grounds must be connected together.

**STEP 11:** **STOP AND CHECK.** Review every single wire against the Pin-by-Pin Wiring Table in Section 3 above. Verify each connection one by one.

**STEP 12:** Only after verifying ALL connections, plug the USB cable into the ESP8266 to power it on.

---

## 6. POWER & SAFETY

> [!CAUTION]
> **READ THIS ENTIRE SECTION BEFORE CONNECTING ANY MOTORS, PUMPS, OR SOLENOIDS.**
> Failing to follow these rules can **permanently destroy your ESP8266** and potentially cause fire or electric shock.

### ESP8266 Electrical Limits

| Parameter | Value | Warning |
|-----------|-------|---------|
| Logic voltage | **3.3V** | All GPIO pins are 3.3V — do NOT apply 5V to any GPIO |
| Max current per GPIO pin | **~12 mA** | Far too little to power a motor directly |
| Total GPIO current | **~80 mA** | Shared across all pins |
| ADC input range | **0–3.3V** (on NodeMCU) | Exceeding this damages the ADC |

### Critical Safety Rules

1. **NEVER connect a water pump motor directly to a GPIO pin (D1, D2, etc.).**
   - A motor can draw 200mA–2A or more. A GPIO pin can supply ~12mA.
   - Connecting a motor directly to a GPIO **will burn out the ESP8266 instantly**.

2. **NEVER connect a solenoid valve directly to a GPIO pin.**
   - Solenoids are inductive loads that draw significant current and create voltage spikes.

3. **The relay is the safe intermediary.**
   - ESP GPIO → Relay IN (tiny signal, ~1 mA)
   - Relay contacts → External power → Pump/Solenoid (separate high-power circuit)

4. **Always maintain a common ground.**
   - ESP GND, relay module GND, and sensor GND must all be connected together.
   - If using an external power supply for loads, its GND must also be common.

5. **External loads need their own power supply.**
   - A 12V DC pump needs a 12V DC power supply.
   - A 24V solenoid needs a 24V power supply.
   - **NOT SPECIFIED — USER MUST VERIFY** the exact voltage and current requirements of your pump and solenoid.

6. **Flyback protection for inductive loads.**
   - When a relay switches off a motor or solenoid, a voltage spike occurs.
   - Many relay modules include built-in flyback diodes. If yours doesn't, add a flyback diode across the load.

7. **If mains voltage (110V/220V AC) is involved:**

> [!CAUTION]
> **STOP. Mains voltage is LETHAL.**
> If your pump or solenoid operates on 110V/220V AC, you MUST use a qualified electrician.
> Keep beginner projects at safe low voltages: **5V, 12V, or 24V DC only.**

---

## 7. HOW THE RELAY CONNECTS TO THE LOAD

A relay is an electrically operated switch. The ESP8266 sends a tiny logic signal to the relay, which uses an electromagnet to close a heavy-duty switch for your pump.

### The Signal Chain

```
ESP8266 GPIO (D1)          Relay Module                 External Load
      │                        │                             │
      │  LOW (0V) signal       │  Electromagnet              │
      ├───────────────────────►│  energizes the              │
      │  (only ~1mA current)   │  internal switch            │
      │                        │                             │
      │                        │  COM ── connects to ── NO   │
      │                        │                             │
      │                        │         External Power      │
      │                        │         (+) ─► COM          │
      │                        │         NO ─► Pump (+)      │
      │                        │         Pump (-) ─► PSU (-) │
      │                        │                             │
```

### Understanding Relay Terminals

The switching side of the relay has three screw terminals:

| Terminal | Name | What It Does |
|----------|------|-------------|
| **COM** | Common | Where the incoming power from your external power supply connects |
| **NO** | Normally Open | Connects to your pump/valve. Circuit is OPEN (disconnected) when relay is OFF. **This is the safe default — USE THIS.** |
| **NC** | Normally Closed | Circuit is CLOSED (connected) when relay is OFF. **Do NOT use for pump/valve** — they would run whenever the ESP is off! |

### Why NO (Normally Open)?

- When ESP is OFF → relay is OFF → NO is disconnected → pump is OFF ✅
- When ESP sends command → relay activates → NO connects → pump runs ✅
- If ESP crashes or loses power → relay deactivates → pump stops ✅ (SAFE!)

---

## 8. BEGINNER PRE-POWER CHECKLIST

> [!IMPORTANT]
> **Do NOT plug in the USB cable until every box below is checked!**

- [ ] ESP8266 USB cable is completely **unplugged**
- [ ] Jumper wire connects **Pump relay IN1 → D1**
- [ ] Jumper wire connects **Valve relay IN2 → D2**
- [ ] Jumper wire connects **Soil sensor AO → A0**
- [ ] **Common grounds** are connected (ESP GND → Relay GND, ESP GND → Sensor GND)
- [ ] Relay module **VCC power** is connected and verified (typically VIN for 5V)
- [ ] Soil sensor **VCC power** is connected and verified (typically 3V3)
- [ ] **CRITICAL:** No motor, pump, or solenoid is connected directly to any ESP GPIO pin
- [ ] **CRITICAL:** No accidental short circuits between power pins (VIN/3V3) and GND
- [ ] Relay polarity confirmed: AgroSense uses **Active-LOW** logic (LOW = relay ON)
- [ ] All relay load terminals (COM/NO/NC) are **empty** for initial testing
- [ ] All actuators will be **OFF** at boot (firmware ensures this)

---

## 9. OPTIONAL FUTURE UPGRADE: DHT TEMPERATURE & HUMIDITY SENSOR

In the current AgroSense hardware configuration, **temperature and humidity are software-simulated** for demonstration purposes. There is no physical DHT sensor required for the base setup.

The firmware generates realistic-looking values using a random-walk algorithm. The React dashboard displays these values alongside real soil moisture data.

### Adding a Physical DHT Sensor (Future)

If you want real temperature and humidity readings, you can add a DHT11 or DHT22 sensor:

> [!IMPORTANT]
> **The GPIO pin for the DHT sensor is NOT SPECIFIED — USER MUST VERIFY** a suitable pin and update the firmware accordingly.
>
> Recommended candidates (from the pinout reference):
> - D5 (GPIO14) — safe at boot, no conflicts
> - D6 (GPIO12) — safe at boot, good for 1-wire sensors
>
> Adding a physical sensor requires:
> 1. Choosing a GPIO pin
> 2. Installing the DHT library in Arduino IDE
> 3. Modifying the firmware to replace simulated values with real readings
> 4. Adding a 4.7kΩ–10kΩ pull-up resistor between data pin and 3.3V

---

## 10. QUICK REFERENCE CARD

```
┌─────────────────────────────────────────────────────────────┐
│              AgroSense SIH25015 Quick Reference             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BOARD:     NodeMCU 1.0 (ESP-12E)                          │
│  FIRMWARE:  AgroSense-ESP-v2.0                              │
│  BAUD:      115200                                          │
│  WS PORT:   81                                              │
│                                                             │
│  D1 (GPIO5)  → Pump Relay IN1    (Active-LOW)              │
│  D2 (GPIO4)  → Valve Relay IN2   (Active-LOW)              │
│  D4 (GPIO2)  → Built-in LED      (Active-LOW, onboard)     │
│  A0 (ADC0)   → Soil Sensor AO    (0-1023, 0-3.3V)         │
│                                                             │
│  3V3 → Sensor VCC    VIN → Relay VCC    GND → All GND      │
│                                                             │
│  RELAY: LOW = ON,  HIGH = OFF                               │
│  LED:   LOW = ON,  HIGH = OFF                               │
│                                                             │
│  Soil: ADC 1023 = Dry (0%)   ADC 350 = Wet (100%)         │
│  Temp/Humidity: SOFTWARE SIMULATED (no DHT sensor)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*AgroSense SIH25015 — Smart India Hackathon Hardware Documentation Suite*
