# AgroSense â€” Real Sensor Data Guide

**Firmware:** AgroSense-ESP-v2.1 (Real-Sensor-Only)
**Board:** NodeMCU 1.0 (ESP-12E Module)
**Audience:** Students, Developers, Anyone who wants to understand the hardware
**Last Updated:** 2026-09-01

---

## TL;DR â€” What's Real, What's Not

| Measurement | Is It Real? | Source | Dashboard |
|---|---|---|---|
| Soil Moisture | YES â€” REAL | Physical resistive probe on A0 pin | Shows actual % |
| Temperature | NO â€” NOT CONNECTED | No physical sensor | Shows N/A |
| Humidity | NO â€” NOT CONNECTED | No physical sensor | Shows N/A |

**The dashboard NEVER shows fake numbers. If a sensor is missing, it shows N/A.**

---

## 1. Which Sensors Are Actually Connected?

| Sensor | Physically Connected? | Where? | What It Measures |
|---|---|---|---|
| **Soil Moisture Probe** | YES â€” REAL | A0 (Analog pin) | How wet the soil is (0-100%) |
| Temperature Sensor | NO â€” NOT CONNECTED | â€” | Would measure air temperature in Â°C |
| Humidity Sensor | NO â€” NOT CONNECTED | â€” | Would measure relative humidity in % |

No DHT11, DHT22, DS18B20, BME280, BMP280, SHT31, TMP36, LM35, or any other
temperature/humidity sensor is wired to this board.

---

## 2. Which ESP8266 Pins Does Each Sensor Use?

| Pin Label | GPIO # | What's Connected | Direction | Notes |
|---|---|---|---|---|
| D1 | GPIO 5 | Irrigation Pump Relay | OUTPUT (Active-LOW) | LOW = Pump ON |
| D2 | GPIO 4 | Solenoid Valve Relay | OUTPUT (Active-LOW) | LOW = Valve OPEN |
| D4 | GPIO 2 | Built-in LED | OUTPUT (Active-LOW) | LOW = LED ON |
| **A0** | **ADC 0** | **Soil Moisture Probe** | **Analog INPUT** | **0-1023, 10-bit** |

Active-LOW means writing LOW (0V) turns the pump ON; writing HIGH (3.3V) turns it OFF.
This is normal for most relay modules sold for NodeMCU.

---

## 3. How Does the ESP Read the Soil Sensor?

The ESP8266 has one built-in Analog-to-Digital Converter (ADC) pin called A0.

```
Soil Probe (two metal prongs in the soil)
       |
A0 pin (NodeMCU analog input)
       |
analogRead(A0)
       |
Returns a number between 0 and 1023
```

analogRead(A0) is called every 2 seconds inside broadcastTelemetry().

The relevant firmware code in hardware_firmware/esp8266_gateway.ino:

```cpp
#define PIN_SOIL_ANALOG  A0   // ADC 0 â€” Soil Moisture Sensor (0-1023)

float readSoilMoisture() {
  int rawADC = analogRead(PIN_SOIL_ANALOG);
  ...
}
```

---

## 4. How Does the Raw ADC Reading Become a Soil Moisture Percentage?

Step-by-step formula:

```
Raw ADC Value (from analogRead)
       |
Validation:
  - Is rawADC between 0 and 1023? If not  -> fault  (-1)
  - Is rawADC less than 50?       If yes  -> no_probe (-2)
       |
Calibration mapping:
  DRY_ADC  = 1023  ->  0%   (probe in dry air)
  WET_ADC  = 350   ->  100% (probe in water)

  percent = map(rawADC, 1023, 350, 0, 100)
       |
Clamping:
  Result is clamped to 0-100%
       |
Stored in gSoilMoisture (float)
```

Example:
  Raw ADC = 686  -> roughly halfway between DRY (1023) and WET (350)
  Percent ~= 50%
  Dashboard shows: 50.0%  [REAL SENSOR]

Project calibration values (stored in firmware, not hardcoded magic numbers):

| Constant | Value | Meaning |
|---|---|---|
| SOIL_DRY_ADC | 1023 | Probe in dry air -> 0% moisture |
| SOIL_WET_ADC | 350 | Probe submerged in water -> 100% |
| SOIL_FLOAT_MIN | 50 | Below this -> probe likely disconnected |

Note: These are project defaults for a common resistive probe.
Calibrate for your specific probe: measure ADC in dry air (set SOIL_DRY_ADC)
and in water (set SOIL_WET_ADC).

---

## 5. Complete Data Flow â€” From Sensor to Dashboard

```
Physical Soil Probe (in soil)
       |
A0 pin -> analogRead(A0) -> rawADC (0-1023)
       |
Validation:
  out-of-range? -> fault
  rawADC < 50?  -> no_probe
       |
map(rawADC, 1023, 350, 0, 100)
constrain(result, 0, 100)
       |
gSoilMoisture = 48.0  [REAL PHYSICAL READING]

       |

Telemetry JSON (every 2 seconds):
  {
    "type":         "telemetry",
    "soilMoisture": 48.0,                <- REAL PHYSICAL SENSOR
    "soilStatus":   "ok",
    "temperature":  null,                <- NO PHYSICAL SENSOR
    "tempStatus":   "sensor_unavailable",
    "humidity":     null,                <- NO PHYSICAL SENSOR
    "humidStatus":  "sensor_unavailable",
    "pumpActive":   false,
    "valveOpen":    false,
    "ip":           "192.168.x.x"
  }

       |  WebSocket  ws://agrosense.local:81  |

React Frontend (WebSocketProvider.tsx):
  - Receives JSON frame
  - Parses: soilMoisture=48.0, temperature=null
  - Calls store.updateTelemetry(...)

Zustand Store (store/index.ts):
  - soilMoisture: 48.0
  - temperature:  null   <- preserved as null (never replaced with fake data)
  - humidity:     null   <- preserved as null

TelemetryPanel.tsx (dashboard cards):

  [Temperature]
    N/A
    [SENSOR NOT CONNECTED]

  [Humidity]
    N/A
    [SENSOR NOT CONNECTED]

  [Soil Moisture]
    48.0%
    [REAL SENSOR]
```

---

## 6. Which Readings Are Real?

| Reading | Real? | Reason |
|---|---|---|
| **Soil Moisture** | REAL | Physical resistive probe on A0; analogRead + calibration |
| Temperature | UNAVAILABLE | No DHT/DS18B20/BME280/SHT31/TMP36/LM35 wired |
| Humidity | UNAVAILABLE | Same sensor as temperature â€” none connected |

---

## 7. Telemetry Field Reference

Every 2 seconds, the ESP broadcasts this JSON over WebSocket (port 81):

| Field | Type | Real / Unavailable | Unit | Notes |
|---|---|---|---|---|
| type | "telemetry" | â€” | â€” | Message type |
| soilMoisture | number OR null | REAL | % | From A0; null if fault/no_probe |
| soilStatus | "ok"/"fault"/"no_probe" | REAL | â€” | Sensor health |
| temperature | null | UNAVAILABLE | Â°C | Always null â€” no sensor |
| tempStatus | "sensor_unavailable" | UNAVAILABLE | â€” | Always this value |
| humidity | null | UNAVAILABLE | %RH | Always null â€” no sensor |
| humidStatus | "sensor_unavailable" | UNAVAILABLE | â€” | Always this value |
| pumpActive | boolean | REAL | â€” | Actual GPIO state |
| valveOpen | boolean | REAL | â€” | Actual GPIO state |
| ip | string | REAL | â€” | DHCP IP of ESP |

---

## 8. Why Fake Data Is Dangerous for a Real Agriculture System

Fake Temperature (e.g. showing 28C when it is actually 44C):
  - You miss heat stress alerts
  - Plants wilt and die before you notice
  - Irrigation decisions based on wrong temperature cause more harm

Fake Humidity (e.g. showing 50% when it is actually 90%):
  - You miss fungal disease risk (fungus thrives above 70% RH)
  - You delay treatment while disease spreads

Fake Soil Moisture (e.g. showing 60% when soil is actually bone dry):
  - Plants die of dehydration
  - Pump never activates because the dashboard shows "enough water"

Rule: A displayed number must match physical reality.
If no sensor exists, show N/A.
A question mark is honest. A fake number can destroy a crop.

---

## 9. How to Add Real Temperature Sensing Later (DHT22)

Hardware you need to buy:

| Item | Cost (approx.) |
|---|---|
| DHT22 sensor module (with breakout board) | 150-250 rupees |

Wiring (DO NOT connect until ready):
  DHT22 VCC  -> NodeMCU 3.3V
  DHT22 DATA -> NodeMCU D3 (GPIO 0)
  DHT22 GND  -> NodeMCU GND

Install a 10 kÎ© pull-up resistor between DATA and VCC,
or use a DHT22 breakout module that has it built in.

Firmware changes (after hardware is connected):
  1. Install "DHT sensor library" by Adafruit in Arduino Library Manager
  2. Add: #include <DHT.h>
  3. Add: DHT dht(D3, DHT22);
  4. In setup(): dht.begin();
  5. In readAllSensors():
       float t = dht.readTemperature();
       float h = dht.readHumidity();
       if (!isnan(t)) { gTemperature = t; gTempFault = false; }
       else            { gTempFault = true; }
       if (!isnan(h)) { gHumidity = h; gHumidFault = false; }
       else            { gHumidFault = true; }
  6. In broadcastTelemetry():
       Change "sensor_unavailable" to "ok" for temp/humidity
       Send actual values instead of null

Frontend: No changes needed.
The dashboard already handles non-null temperature and humidity correctly.

---

## 10. How to Add Real Humidity Sensing Later

A DHT22 measures BOTH temperature AND humidity with one sensor.
Follow Step 9 above â€” one sensor gives you both readings.

Sensor options by accuracy:

| Sensor | Cost | Accuracy |
|---|---|---|
| DHT22 (recommended) | 150-250 rupees | +-0.5Â°C, +-2%RH |
| DHT11 (budget) | 80-150 rupees | +-2Â°C, +-5%RH |
| BME280 (best) | 300-500 rupees | +-1Â°C, +-3%RH + pressure |
| SHT31 | 400-600 rupees | +-0.3Â°C, +-2%RH |

---

## 11. Sensor Error Handling

| State | soilStatus | soilMoisture | Dashboard |
|---|---|---|---|
| Normal reading | "ok" | 48.0 | Shows 48.0% with REAL SENSOR badge |
| ADC hardware fault | "fault" | null | Shows N/A with SENSOR FAULT badge |
| Probe disconnected | "no_probe" | null | Shows N/A with PROBE DISCONNECTED badge |

Errors are NEVER converted into fake numbers.
null is sent; the dashboard shows N/A.

---

## 12. Random/Fake Data Audit Results

Full-project search performed for:
  random(), Math.random(), simulate, mock, fake, dummy, demo, hardcoded, setInterval

Findings:

| Location | Occurrence | Category | Verdict |
|---|---|---|---|
| WebSocketProvider.tsx:190 | Math.random() * 2 - 1 | Backoff jitter for retry timing â€” NOT sensor data | SAFE TO KEEP |
| api/analyze-plant.ts:683 | Math.random().toString(36) | Unique diagnostic ID generation â€” NOT sensor data | SAFE TO KEEP |
| WebSocketProvider.tsx:213 | setInterval | Ping interval for latency measurement â€” NOT sensor data | SAFE TO KEEP |
| generate_mock_data.py | mock/simulate | ML training image generator â€” offline tool, not connected to dashboard | SAFE â€” OFFLINE TOOL |
| src/ai/types/index.ts:8 | "simulated_benchmark" | Type string for offline ML benchmarking | SAFE â€” TEST ONLY |
| training/evaluation/*.py | simulate | Hardware-in-the-loop test scenarios â€” offline validation | SAFE â€” OFFLINE |

CONCLUSION: ZERO instances of random or fake sensor values in the production sensor data path.

---

## 13. Sensor Test Plan

Test 1 â€” Soil probe disconnected:
  Disconnect probe from A0.
  Expected: Dashboard shows N/A with PROBE DISCONNECTED badge.
  Serial Monitor: "Soil probe appears disconnected (ADC below SOIL_FLOAT_MIN)"

Test 2 â€” Soil probe connected:
  Plug probe back in.
  Expected: Dashboard shows real % with REAL SENSOR badge.
  Serial Monitor: [TELEMETRY] Broadcast -> {"soilMoisture":XX.X,"soilStatus":"ok",...}

Test 3 â€” Dry soil:
  Insert probe into completely dry soil or dry air.
  Expected: ADC near 900-1023 -> moisture % near 0%.

Test 4 â€” Wet soil:
  Insert probe into saturated soil or dip in water.
  Expected: ADC near 350-500 -> moisture % near 80-100%.

Test 5 â€” Temperature sensor (no hardware):
  No action needed.
  Expected: Dashboard shows N/A with SENSOR NOT CONNECTED badge â€” permanently.

Test 6 â€” Humidity sensor (no hardware):
  No action needed.
  Expected: Dashboard shows N/A with SENSOR NOT CONNECTED badge â€” permanently.

Test 7 â€” Frontend matches ESP telemetry:
  Open Serial Monitor at 115200 baud, note soilMoisture value.
  Expected: Dashboard shows same value within 2 seconds.

Test 8 â€” WebSocket frame verification:
  Open browser DevTools -> Network -> WS tab -> filter to ws://agrosense.local:81
  Expected JSON frames:
    temperature: null
    humidity: null
    soilMoisture: <real number or null>

---

## 14. GPIO Preservation Checklist

| Pin | Function | Behavior | Status |
|---|---|---|---|
| D1 / GPIO 5 | Pump relay | Active-LOW | Preserved |
| D2 / GPIO 4 | Valve relay | Active-LOW | Preserved |
| D4 / GPIO 2 | Built-in LED | Active-LOW | Preserved |
| A0 / ADC 0 | Soil moisture | analogRead -> 0-1023 | Preserved |

---

## Summary Table

| Property | Value |
|---|---|
| Physical sensors | 1 â€” Soil moisture probe (A0) |
| Unavailable sensors | 2 â€” Temperature, Humidity |
| Fake data on dashboard | NONE |
| Telemetry interval | 2 seconds |
| WebSocket port | 81 |
| mDNS hostname | agrosense.local |
| Firmware version | AgroSense-ESP-v2.1 |
| Cloudflare fallback | Supported |
| GPIO mapping preserved | Yes |
| Relay polarity | Active-LOW |
| React build | Passes â€” 0 TypeScript errors, 0 build errors |
| Firmware fake data search | None found |

---

AgroSense SIH25015 â€” 2026
|--------|----------------------|--------|-----------------|
