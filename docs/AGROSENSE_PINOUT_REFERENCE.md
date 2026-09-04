# AgroSense SIH25015 — ESP8266 Hardware Pinout Reference Card

> **Hardware Target:** NodeMCU 1.0 (ESP-12E Module)  
> **Firmware Reference:** [`esp8266_gateway.ino`](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino)  
> **Target Audience:** IoT Hardware Engineers & Beginners  
> **Revision:** 1.0.0 (Production Verified)

---

## 1. AgroSense Pin Assignment Table

The table below lists all physical connections utilized by the active AgroSense gateway firmware.

| ESP8266 Pin | GPIO Number | Connected Component | Signal Type | Active State | Default Boot Level | Functional Notes |
|:---|:---|:---|:---|:---|:---|:---|
| **`D1`** | `GPIO5` | Irrigation Pump Relay IN | Digital Output | **Active-LOW** | `HIGH` (Coil OFF) | Driven `LOW` to activate pump relay; 40 ms settling delay. |
| **`D2`** | `GPIO4` | Solenoid Valve Relay IN | Digital Output | **Active-LOW** | `HIGH` (Coil OFF) | Driven `LOW` to open valve relay; 40 ms settling delay. |
| **`D4`** | `GPIO2` | Built-in Blue LED | Digital Output | **Active-LOW** | `HIGH` (LED OFF) | Onboard LED (ESP-12E module). Lights up when clients connect. |
| **`A0`** | `ADC0` | Soil Moisture Sensor | Analog Input | N/A | High-Z (Analog) | 10-bit ADC (0–1023 count), maps 0–3.3V on NodeMCU board. |

> [!IMPORTANT]
> **Active-LOW Polarity:** Both relay channels and the onboard LED turn **ON** when the GPIO output is set to `LOW` (`0V`) and turn **OFF** when set to `HIGH` (`3.3V`).

---

## 2. Power Pins & Ground Reference

| Pin Label | Voltage Level | Direction | Max Rating / Spec | Recommended Usage | Safety Notes |
|:---|:---|:---|:---|:---|:---|
| **`VIN`** | `5.0V` (nom.) | Input / Output | 5V–12V DC Input | Relay Module `VCC`, External 5V Supply | Supplies input to onboard AMS1117-3.3 regulator. When powered via Micro-USB, `VIN` outputs ~4.75V–5.0V. |
| **`3V3`** | `3.3V` regulated | Output | ~500 mA – 800 mA total | Soil Sensor `VCC`, 3.3V sensors | **NEVER** power inductive loads (relay coils, DC motors) from `3V3`. Peak ESP8266 RF transmission consumes ~170–200 mA. |
| **`GND`** | `0V` (Ground) | Common Ref | Common Ground | Common Ground Bus | **All** components (NodeMCU, Relay Board, Sensor) must share a common GND rail. |

> [!CAUTION]
> **Inductive Load Isolation:** Relay coils draw 70 mA to 100 mA each when energized. Power the relay board `VCC` pin from `VIN` (5V rail) or an external 5V power supply, **never** from the `3V3` pin. Drawing excessive current from `3V3` causes brownout resets and can destroy the onboard linear regulator.

---

## 3. NodeMCU 1.0 (ESP-12E) Pinout Map

```
                           +-------------------+
                           |     [USB PORT]    |
                           +-------------------+
             (ADC 0)   A0 -| [ ]           [ ] |- D0  (GPIO16 / USER / WAKE)
             (Reserved)RSV -| [ ]           [ ] |- D1  (GPIO5  / PUMP RELAY)  [USED]
             (Reserved)RSV -| [ ]           [ ] |- D2  (GPIO4  / VALVE RELAY) [USED]
        (Flash GPIO10) SD3 -| [ ]           [ ] |- D3  (GPIO0  / FLASH KEY)
        (Flash GPIO9)  SD2 -| [ ]           [ ] |- D4  (GPIO2  / ONBOARD LED) [USED]
        (Flash MOSI)   SD1 -| [ ]           [ ] |- 3V3 (3.3V Out)
        (Flash CS)     CMD -| [ ]           [ ] |- GND (Ground)
        (Flash MISO)   SD0 -| [ ]           [ ] |- D5  (GPIO14 / HSCLK)
        (Flash SCLK)   CLK -| [ ]           [ ] |- D6  (GPIO12 / HMISO)
                       GND -| [ ]           [ ] |- D7  (GPIO13 / HMOSI)
                       3V3 -| [ ]           [ ] |- D8  (GPIO15 / HCS)
               (Enable) EN -| [ ]           [ ] |- RX  (GPIO3  / UART0 RX)    [RESERVED]
                (Reset)RST -| [ ]           [ ] |- TX  (GPIO1  / UART0 TX)    [RESERVED]
                       GND -| [ ]           [ ] |- GND (Ground)
              (5V In)  VIN -| [ ]           [ ] |- 3V3 (3.3V Out)
                           +-------------------+
```

### Complete Pin Utilization Matrix

| NodeMCU Pin | ESP8266 GPIO | AgroSense Status | Primary Function | Hardware Boot / Operational Constraints |
|:---|:---|:---|:---|:---|
| **`A0`** | `ADC0` / `TOUT` | **USED** | Soil Moisture Analog In | Analog input only. Range: 0–1.0V at chip, 0–3.3V on NodeMCU. |
| **`D0`** | `GPIO16` | **AVAILABLE** | General IO / Deep Sleep Wake | No PWM / No I2C hardware. Drives HIGH at boot. Connect to RST for deep-sleep wake. |
| **`D1`** | `GPIO5` | **USED** | Pump Relay Output | General GPIO, I2C SCL default. Safe at boot. |
| **`D2`** | `GPIO4` | **USED** | Valve Relay Output | General GPIO, I2C SDA default. Safe at boot. |
| **`D3`** | `GPIO0` | **AVAILABLE** (Caution) | General IO / Flash Button | **Bootstrapping Pin:** Must be `HIGH` on boot. If pulled `LOW`, chip enters UART bootloader. |
| **`D4`** | `GPIO2` | **USED** | Status LED / TXD1 | **Bootstrapping Pin:** Must be `HIGH` on boot. Internal pull-up. Connected to onboard blue LED. |
| **`D5`** | `GPIO14` | **AVAILABLE** | SPI SCK / General IO | Safe at boot. Outputs clock pulse during flash access if configured. |
| **`D6`** | `GPIO12` | **AVAILABLE** | SPI MISO / General IO | Safe at boot. Excellent for DHT11/DHT22 or additional sensors. |
| **`D7`** | `GPIO13` | **AVAILABLE** | SPI MOSI / UART0 CTS | Safe at boot. Excellent for secondary actuators or sensors. |
| **`D8`** | `GPIO15` | **AVAILABLE** (Caution) | SPI CS / UART0 RTS | **Bootstrapping Pin:** Must be `LOW` on boot (pulled down with 10kΩ). Cannot pull high externally at boot. |
| **`TX`** | `GPIO1` | **RESERVED** | UART0 TX (Debug Serial) | Emits boot ROM diagnostic logs at 74880 baud; used for serial monitor at 115200 baud. |
| **`RX`** | `GPIO3` | **RESERVED** | UART0 RX (Serial In) | Reserved for serial flashing and telemetry commands via USB bridge. |
| **`SD0–SD3, CLK, CMD`** | `GPIO6–11` | **RESERVED** (Internal) | SPI Flash Memory Bus | **DO NOT CONNECT.** Directly connected to onboard SPI Flash memory IC. Connecting will crash the ESP8266. |

---

## 4. GPIO Safe Behavior at Boot (Bootstrapping Rules)

The ESP8266 checks specific GPIO levels at startup to determine the execution mode. Connecting external components that pull these pins to incorrect levels will prevent the microcontroller from starting.

```
       +-----------------------------------------------------------+
       |             ESP8266 BOOT MODE STRAPPING LOGIC             |
       +--------------------+-------------------+------------------+
       | Pin                | Required Boot State| Consequence if Inverted|
       +--------------------+-------------------+------------------+
       | D3 (GPIO0)         | HIGH (3.3V)       | Enters UART Flash Mode (No code runs)|
       | D4 (GPIO2)         | HIGH (3.3V)       | Boot fails (Undefined State)        |
       | D8 (GPIO15)        | LOW  (GND)        | Boot fails (Cannot read Flash)       |
       +--------------------+-------------------+------------------+
```

### Strapping Pin Rules & Best Practices

1. **`D3` (`GPIO0`):**
   - **Boot requirement:** Must be `HIGH`.
   - The NodeMCU includes an onboard 10kΩ pull-up resistor to 3.3V.
   - *Design rule:* Do not attach an external switch or low-impedance load that holds D3 LOW on power-up, unless intentionally entering programming mode.
2. **`D4` (`GPIO2`):**
   - **Boot requirement:** Must be `HIGH`.
   - Connected to the onboard blue LED (active-LOW) and pulled `HIGH` internally.
   - *AgroSense implementation:* Firmware initializes D4 as `OUTPUT` and sets it `HIGH` (`LED_OFF`), ensuring safe booting.
3. **`D8` (`GPIO15`):**
   - **Boot requirement:** Must be `LOW`.
   - The NodeMCU includes an onboard 10kΩ pull-down resistor to GND.
   - *Design rule:* **NEVER** connect a pull-up resistor or an active-HIGH sensor directly to D8 without verifying it remains `LOW` during the first 100 ms of power application.

---

## 5. Relay Actuation Logic & Truth Table

AgroSense uses a standard 2-channel 5V optoisolated relay module.

### Relay Truth Table

| Digital Pin State | Firmware Constant | Microcontroller Voltage | Optocoupler LED | Relay Coil Status | Common (COM) to NO Contact | Actuator State |
|:---|:---|:---|:---|:---|:---|:---|
| **`LOW`** | `RELAY_ON` | `0.0V` | Forward Biased (ON) | **Energized (Magnetized)** | **CLOSED (Connected)** | **RUNNING / OPEN** |
| **`HIGH`** | `RELAY_OFF` | `3.3V` | Reverse / Off | **De-energized (Idle)** | **OPEN (Disconnected)** | **STOPPED / CLOSED** |

```
                       ESP8266 NodeMCU          Optoisolated Relay Board
                     +-----------------+         +---------------------+
                     |                 |         |                     |
                     |             VIN +-------->+ VCC (5V)            |
                     |             GND +-------->+ GND (0V)            |
                     |                 |         |                     |
                     |   (GPIO5)    D1 +-------->+ IN1 [Pump Trigger]  |
                     |   (GPIO4)    D2 +-------->+ IN2 [Valve Trigger] |
                     +-----------------+         +----------+----------+
                                                            |
                                        +-------------------+-------------------+
                                        |                                       |
                                  +-----+-----+                           +-----+-----+
                                  | RELAY 1   |                           | RELAY 2   |
                                  | (PUMP)    |                           | (VALVE)   |
                                  | COM   NO  |                           | COM   NO  |
                                  +---+---+---+                           +---+---+---+
                                      |   |                                   |   |
                             [+12V/220V] [Pump Motor]                [+12V/24V] [Solenoid]
```

### Failsafe Boot Protection
In [`esp8266_gateway.ino`](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino#L384-L396), the `setup()` function executes the following initialization sequence before starting Wi-Fi:
```cpp
pinMode(PIN_RELAY_PUMP,  OUTPUT);
pinMode(PIN_RELAY_VALVE, OUTPUT);
pinMode(PIN_LED_STATUS,  OUTPUT);

// Drive relays to SAFE (OFF) immediately upon boot
digitalWrite(PIN_RELAY_PUMP,  RELAY_OFF); // HIGH (3.3V) -> Coil OFF
digitalWrite(PIN_RELAY_VALVE, RELAY_OFF); // HIGH (3.3V) -> Coil OFF
digitalWrite(PIN_LED_STATUS,  LED_OFF);   // HIGH (3.3V) -> LED OFF
```
This guarantees that relays never glitch or trigger unintentionally during microcontroller reboot or power brownouts.

---

## 6. Soil Moisture ADC Reference & Calibration

The ESP8266 has a single analog channel (`A0` / `ADC0`). On the NodeMCU board, an internal resistive voltage divider (220kΩ / 100kΩ) steps down the 0–3.3V pin input to the 0–1.0V range expected by the ESP8266 core silicon.

### ADC Calibration Table

| Raw ADC Value (10-bit) | Physical Soil Condition | Mapped Moisture % | Firmware Identifier / Constant | Voltage on A0 Pin |
|:---|:---|:---|:---|:---|
| **`1023`** | Completely Dry (In Free Air) | **`0.0%`** | `SOIL_DRY_ADC` (Default) | `~3.30V` |
| **`680`** | Moderately Damp Soil | **`51.0%`** | Mid-range reading | `~2.19V` |
| **`350`** | Fully Saturated (In Water Cup) | **`100.0%`** | `SOIL_WET_ADC` (Default) | `~1.13V` |
| **`< 50`** | Sensor Disconnected / Floating | Fallback Simulated | Auto-detected disconnect | `~0.00V` |

### Step-by-Step Sensor Calibration Procedure

> [!NOTE]
> Every soil probe has individual manufacturing variations and soil mineral sensitivities. Follow this calibration procedure prior to deployment:

```
+-----------------------------------------------------------------------------------+
|                           SOIL PROBE CALIBRATION FLOW                             |
+-----------------------------------------------------------------------------------+
  [Step 1] Clean and dry probe blades thoroughly with a cloth.
     │
  [Step 2] Hold probe in open air. Observe Serial Monitor raw ADC.
     │     --> Record this value as SOIL_DRY_ADC (typically 1000 - 1023).
     │
  [Step 3] Submerge probe in a cup of tap water up to the max line (do not submerge electronics).
     │     --> Record this value as SOIL_WET_ADC (typically 320 - 380).
     │
  [Step 4] Update line 129 in esp8266_gateway.ino:
           float mapped = (float)map(rawSoil, SOIL_DRY_ADC, SOIL_WET_ADC, 0, 100);
+-----------------------------------------------------------------------------------+
```

---

## 7. Available Pins for Future Expansion

The following unassigned pins on the NodeMCU can be used for agricultural sensor expansions (e.g., DHT22 temperature/humidity, I2C OLED display, flow meter):

| NodeMCU Pin | GPIO | Recommended Expansion Feature | Protocol / Interface | Wiring & Pull-up Considerations |
|:---|:---|:---|:---|:---|
| **`D5`** | `GPIO14` | Secondary Relay (e.g., Fertilizer Injector) | Digital Output | Safe at boot. Standard 3.3V logic output. |
| **`D6`** | `GPIO12` | DHT22 / DHT11 Air Temp & Humidity Sensor | 1-Wire Digital Bus | Requires 4.7kΩ–10kΩ pull-up to 3.3V. Safe at boot. |
| **`D7`** | `GPIO13` | Water Flow Sensor / Pulse Counter | Hardware Interrupt | Fast interrupt response. 3.3V logic (use divider if 5V pulse). |
| **`D3`** | `GPIO0` | Pushbutton Manual Override Switch | Digital Input (Interrupt) | Must be pulled `HIGH` at boot. Connect switch to GND with 10kΩ pull-up to 3.3V. |
| **`D0`** | `GPIO16` | Deep Sleep Wakeup Trigger | Power Management | Connect `D0` to `RST` to enable low-power sleep cycles. |
| **`D1 / D2`** | `GPIO5 / 4`| I2C Bus (OLED / BME280 / ADS1115 ADC) | I2C (SCL=`D1`, SDA=`D2`) | *Note:* Currently used for relays. If I2C is needed, migrate relays to `D5`/`D7`. |

---

## 8. Hardware Safety & Pre-Power Checklist

Before connecting USB power or applying external DC power to the NodeMCU, verify each item on this checklist:

- [ ] **Common Ground:** Is NodeMCU `GND` connected directly to the Relay Module `GND` and Sensor `GND`?
- [ ] **Relay Power Supply:** Is Relay Module `VCC` connected to `VIN` (5V), and **NOT** to `3V3`?
- [ ] **GPIO Current Limits:** Ensure no GPIO is directly driving a load exceeding **12 mA** (use transistors/optocouplers for all coils and LEDs).
- [ ] **Analog Input Voltage:** Ensure voltage on `A0` does not exceed **3.3V**.
- [ ] **Mains High-Voltage Isolation:** If controlling 220V/110V AC water pumps, verify physical air gaps (>5 mm) between high-voltage relay terminals and low-voltage DC logic wiring.
- [ ] **Strapping Pin Verification:** Ensure `D8` (`GPIO15`) is not pulled HIGH externally during power-up.

---

*AgroSense Documentation Suite — Smart India Hackathon (SIH25015)*
