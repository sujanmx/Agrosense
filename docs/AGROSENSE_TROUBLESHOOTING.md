# AgroSense SIH25015 — Hardware & System Troubleshooting Guide

**System:** AgroSense Precision Command Center (SIH25015)  
**Target Microcontroller:** ESP8266 NodeMCU 1.0 (ESP-12E Module)  
**Firmware:** [`hardware_firmware/esp8266_gateway.ino`](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino)  
**Frontend WebSocket Client:** [`src/providers/WebSocketProvider.tsx`](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/src/providers/WebSocketProvider.tsx)  
**Default Network Architecture:** WebSockets on TCP Port `81` | Station Mode Wi-Fi  

---

> [!IMPORTANT]
> **Beginner's Rule of Hardware Safety**  
> Before disconnecting wires, swapping pins, or probing terminals:
> 1. **ALWAYS disconnect the 220V/110V AC mains power** to the pump or valve before touching relay terminal blocks.
> 2. **ALWAYS disconnect the USB cable** from your computer before modifying wiring on the breadboard or ESP8266 header pins.
> 3. **NEVER connect 5V or 12V directly to any ESP8266 GPIO pin or A0** — ESP8266 pins operate strictly at **3.3V logic** (A0 ADC input maximum rating is **1.0V bare ESP chip / 3.3V on NodeMCU carrier boards with onboard voltage divider**).

---

## Quick Reference Pinout & Logic Table

```
                         ESP8266 NodeMCU 1.0 (ESP-12E)
                              ┌───────────────┐
                     (ADC 0)  │ A0         D0 │  (GPIO 16)
                              │ G          D1 │  (GPIO 5)  --> RELAY 1 (Pump IN)
                              │ VU         D2 │  (GPIO 4)  --> RELAY 2 (Valve IN)
                              │ S3         D3 │  (GPIO 0)  [FLASH Button / Pull-up]
                              │ S2         D4 │  (GPIO 2)  --> Built-in Status LED (Active-LOW)
                              │ S1         3V3│  (3.3V Out)
                              │ SC         GND│  (Ground)
                              │ SO         D5 │  (GPIO 14 - SCK)
                              │ SK         D6 │  (GPIO 12 - MISO)
                              │ GND        D7 │  (GPIO 13 - MOSI)
                              │ 3V3        D8 │  (GPIO 15 - Pull-down)
                              │ EN         RX │  (GPIO 3)
                              │ RST        TX │  (GPIO 1)
                              │ GND        GND│
                              │ VIN        3V3│
                              └───────────────┘
```

| Signal / Actuator | NodeMCU Silk Pin | ESP8266 GPIO | Default State at Boot | Trigger Level (Firmware) |
| :--- | :--- | :--- | :--- | :--- |
| **Irrigation Pump Relay** | `D1` | `GPIO 5` | `HIGH` (Relay OFF) | `LOW` (Active-LOW `RELAY_ON`) |
| **Solenoid Valve Relay** | `D2` | `GPIO 4` | `HIGH` (Relay OFF) | `LOW` (Active-LOW `RELAY_ON`) |
| **Status Indicator LED** | `D4` | `GPIO 2` | `HIGH` (LED OFF) | `LOW` (Active-LOW `LED_ON`) |
| **Soil Moisture Sensor** | `A0` | `ADC 0` | Analog Input (0–1023) | `1023` = Dry (0%), `350` = Wet (100%) |

---

## 1. Master Troubleshooting Table

| # | Problem | Possible Cause | What to Check | Solution |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **ESP not detected by computer** | 1. Charge-only USB cable (missing D+/D- data lines).<br>2. Missing USB-to-UART bridge driver.<br>3. Loose USB port / hub.<br>4. Defective NodeMCU board. | 1. Open Windows **Device Manager** → expand **Ports (COM & LPT)**.<br>2. Unplug and replug cable while listening for Windows device connection chime.<br>3. Check if the onboard UART chip says **CH340G**, **CP2102**, or **FT232RL**. | 1. Replace USB cable with a verified **high-speed data cable** (sync & charge).<br>2. Download and install **WCH CH340/CH341** driver or **Silicon Labs CP210x VCP** driver.<br>3. Plug directly into a motherboard USB 2.0/3.0 port instead of an unpowered USB hub. |
| **2** | **Firmware upload failure** (`espcomm_sync failed` or `Timed out waiting for packet header`) | 1. Wrong COM port selected in Arduino IDE.<br>2. Board not in bootloader mode.<br>3. Serial monitor window holding COM port open.<br>4. Faulty baud rate or USB cable.<br>5. Peripherals on GPIO 0 (`D3`) or GPIO 15 (`D8`) pulling boot pins to wrong state. | 1. Check COM port under **Tools → Port**.<br>2. Check if pins `D3` (GPIO 0) or `D8` (GPIO 15) are connected to external loads.<br>3. Check upload speed in **Tools → Upload Speed**. | 1. Select the exact COM port assigned in Device Manager.<br>2. Hold down the physical **FLASH** button on the NodeMCU, click **Upload**, and release the FLASH button when `Connecting......____` appears.<br>3. Close the Serial Monitor or third-party terminal programs (e.g., PuTTY) before uploading.<br>4. Set **Upload Speed** to `115200` (safe) instead of `921600`.<br>5. Temporarily unplug any wires from `D3` and `D8` during flash. |
| **3** | **Wi-Fi connection failure** (`[WIFI] Connection FAILED`) | 1. Incorrect SSID or Wi-Fi Password.<br>2. Attempting to connect to a **5 GHz-only** Wi-Fi network.<br>3. Weak Wi-Fi signal or router distance.<br>4. Enterprise WPA2/802.1X network or captive portal.<br>5. Special characters in Wi-Fi credentials. | 1. Verify lines 47–48 in `esp8266_gateway.ino` (`WIFI_SSID`, `WIFI_PASSWORD`).<br>2. Check router frequency band.<br>3. Observe serial dots `....` during boot. | 1. Update lines 47–48 in `esp8266_gateway.ino` with correct 2.4 GHz credentials.<br>2. Enable **2.4 GHz band** on your router (ESP8266 does not support 5 GHz 802.11ac/ax).<br>3. Move ESP closer to router or use a 2.4 GHz mobile hotspot.<br>4. Avoid enterprise networks with captive login pages; use standard WPA2-PSK (Personal). |
| **4** | **IP address changed** | 1. Router DHCP lease expired and re-assigned a new dynamic IP address.<br>2. NodeMCU power-cycled on a crowded network. | 1. Open Arduino Serial Monitor at 115200 baud and press RST button.<br>2. Check the IP printed on line `[WIFI] 📍 NodeMCU IP address : <IP>`. | 1. Update the React app URL in browser console: `localStorage.setItem("AGROSENSE_WS_URL", "ws://<NEW_IP>:81"); location.reload();`<br>2. Bind the ESP8266 MAC address to a permanent **Static DHCP Reservation** in your router settings. |
| **5** | **WebSocket client cannot connect** (`DISCONNECTED` or connection timeout) | 1. ESP8266 not on the same local subnet as the PC.<br>2. WebSocket server port `81` blocked by firewall or router AP Isolation.<br>3. Wrong IP address configured in frontend.<br>4. ESP8266 crashed or Wi-Fi dropped. | 1. Ping the ESP IP from PC: `ping <ESP_IP>`.<br>2. Test TCP port 81 from PowerShell: `Test-NetConnection -ComputerName <ESP_IP> -Port 81`.<br>3. Inspect browser console for WebSocket connection target. | 1. Ensure PC and ESP8266 are on the **identical 2.4 GHz Wi-Fi SSID**.<br>2. Disable **Access Point (AP) Isolation** / Client Isolation in router settings.<br>3. Allow outbound/inbound TCP port 81 in Windows Defender Firewall.<br>4. Check ESP Serial Monitor to verify `[WS] 🚀 WebSocket server listening on port 81` is active. |
| **6** | **Cloudflare tunnel fails** | 1. `cloudflared` daemon not running on host machine.<br>2. Tunnel pointing to wrong local IP or port (e.g., pointing to port 80 or 3000 instead of 81).<br>3. Outbound UDP/QUIC blocked on host network. | 1. Check command prompt running `cloudflared tunnel`.<br>2. Look for `error="failed to connect to origin"` in tunnel logs.<br>3. Test local access before tunnel testing. | 1. Run the exact tunnel command: `cloudflared tunnel --url http://<ESP_LOCAL_IP>:81`.<br>2. Ensure the local ESP IP and port 81 are reachable locally before starting Cloudflare.<br>3. Add `--protocol http2` if your ISP blocks QUIC/UDP traffic. |
| **7** | **Relay always ON at boot** | 1. Relay module is **Active-LOW**, but firmware left GPIO in high-impedance / floating state.<br>2. GPIO pin used is a bootstrap pin that pulses LOW on power-up.<br>3. Firmware polarity mismatch (`RELAY_ON` / `RELAY_OFF` constants inverted). | 1. Check relay LED status immediately when USB power is plugged in.<br>2. Check lines 59–60 and lines 392–393 in `esp8266_gateway.ino`.<br>3. Check which GPIO is connected to the relay signal wire. | 1. Ensure `setup()` in firmware runs `digitalWrite(PIN_RELAY_PUMP, HIGH)` immediately before or after `pinMode(..., OUTPUT)`.<br>2. In `esp8266_gateway.ino`, verify `const int RELAY_ON = LOW; const int RELAY_OFF = HIGH;`.<br>3. Use **GPIO 5 (`D1`)** and **GPIO 4 (`D2`)** which are clean high-impedance boot pins that do not glitch during reset. |
| **8** | **Relay never turns ON** | 1. Insufficient coil drive voltage (feeding 3.3V to a 5V relay coil without adequate current).<br>2. Inverted trigger logic (Active-HIGH module driven with Active-LOW firmware).<br>3. Missing ground reference between ESP and relay module.<br>4. Blown relay driver transistor/optocoupler. | 1. Measure voltage between Relay `VCC` and `GND` pins with a multimeter (must be ≥ 4.75V).<br>2. Measure voltage on Relay `IN1`/`IN2` pin when command is triggered (should drop from 3.3V to 0V for Active-LOW).<br>3. Check if relay onboard LED turns on when command is received. | 1. Power relay `VCC` from the NodeMCU **`VIN`** pin (when powered via 5V USB) or a dedicated external 5V power supply.<br>2. Connect ESP `GND` directly to Relay `GND` (Common Ground).<br>3. If your relay module is Active-HIGH, invert firmware constants: `RELAY_ON = HIGH; RELAY_OFF = LOW;`. |
| **9** | **Soil sensor always reads 0%** | 1. Sensor probe not submerged or disconnected from A0.<br>2. Sensor VCC or GND wire loose/disconnected.<br>3. Analog mapping range inverted or misconfigured.<br>4. Probe submerged in pure non-conductive distilled liquid or dry air. | 1. Check voltage between Sensor `VCC` and `GND` (must be 3.3V or 5V).<br>2. Check voltage on NodeMCU `A0` pin using multimeter.<br>3. In Serial Monitor, check raw ADC output (is it 1023 in dry air?). | 1. Check wiring: Sensor `VCC` → NodeMCU `3V3`, Sensor `GND` → `GND`, Sensor `AOUT` → `A0`.<br>2. In `readSensors()`, note that raw ADC `1023` is mapped to `0%` (dry) and `350` is mapped to `100%` (saturated).<br>3. Touch wet soil or place probe in damp soil to test response. |
| **10** | **Soil sensor always reads 100%** | 1. Sensor AOUT wire shorted directly to GND.<br>2. Soil sensor probe trace bridge / short circuit.<br>3. Resistive sensor potentiometer on comparator board turned to extreme threshold.<br>4. Sensor connected to DOUT (digital pin) instead of AOUT (analog pin). | 1. Verify you are connected to the **`AOUT`** / **`AO`** pin on the sensor board, NOT `DOUT` / `DO`.<br>2. Measure resistance between probe prongs (should not be 0 Ω).<br>3. Check raw ADC reading in Serial Monitor. | 1. Move jumper wire from `DOUT` to `AOUT`.<br>2. Clean probe prongs to remove metallic bridges, salts, or mineral build-up.<br>3. If using capacitive sensor v1.2, ensure probe is not submerged beyond the white "maximum immersion" line. |
| **11** | **Telemetry not appearing on dashboard** | 1. WebSocket connected but server is not broadcasting payloads.<br>2. `TELEMETRY_INTERVAL` timer blocked by long blocking `delay()` calls.<br>3. Frontend JSON parser failing silently.<br>4. Client connected to wrong WebSocket path. | 1. Open browser devtools (F12) → **Console** and **Network → WS** tab.<br>2. Check ESP Serial Monitor for `[TELEMETRY] 📡 Broadcast → ...` lines every 2000ms. | 1. Verify `esp8266_gateway.ino` loop executes `webSocket.loop()` continuously with zero blocking loops.<br>2. Inspect incoming WebSocket frames in browser devtools: ensure payload contains `type: "telemetry"`.<br>3. Refresh the React browser tab. |
| **12** | **React dashboard cannot connect** | 1. Stale or incorrect URL saved in browser `localStorage`.<br>2. NodeMCU not powered or rebooting in loop.<br>3. CORS/Network blocking in browser extension or VPN. | 1. Check `localStorage.getItem("AGROSENSE_WS_URL")` in browser console.<br>2. Verify whether browser is attempting connection to `ws://` vs `wss://`.<br>3. Check if active VPN is redirecting local subnet traffic. | 1. Set the correct URL: `localStorage.setItem("AGROSENSE_WS_URL", "ws://10.18.37.83:81"); location.reload();`<br>2. Turn off VPN or local ad-blocker extensions that intercept local network traffic.<br>3. Check NodeMCU power and LED status. |
| **13** | **Mixed-content WSS/WS error in browser** (`The page was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'`) | 1. Modern browsers block unencrypted `ws://` connections when the React dashboard is loaded over secure `https://` (e.g., Vercel, Cloudflare Pages, GitHub Pages). | 1. Check the browser address bar: does it start with `https://`?<br>2. Look for red Mixed Content error in DevTools Console. | 1. **Option A (Recommended for Remote):** Tunnel the ESP8266 through Cloudflare to obtain a secure `wss://` endpoint.<br>2. **Option B (Recommended for Local Dev):** Run and open the React dashboard via `http://localhost:5173` or `http://127.0.0.1:5173` (HTTP allows `ws://` connections without mixed-content blocking). |
| **14** | **Cloudflare URL changed after restart** | 1. Free quick tunnels (`cloudflared tunnel --url ...`) generate an ephemeral random subdomain (e.g., `random-subdomain.trycloudflare.com`) on every run. | 1. Check output in terminal where `cloudflared` is running.<br>2. Compare the new URL against the URL stored in the browser. | 1. Copy the newly generated `https://xxxx.trycloudflare.com` URL.<br>2. Convert the protocol prefix to `wss://xxxx.trycloudflare.com`.<br>3. Update React app via console: `localStorage.setItem("AGROSENSE_WS_URL", "wss://xxxx.trycloudflare.com"); location.reload();`<br>4. *Permanent Solution:* Configure a named Cloudflare Tunnel with a fixed custom domain. |
| **15** | **Relay clicks but load doesn't work** | 1. Load wiring wired across wrong terminals (`NC` instead of `NO` or open circuit).<br>2. External power supply for pump/valve is turned off or disconnected.<br>3. Common (`COM`) terminal not connected in series with load power.<br>4. Blown fuse or broken relay mechanical contact. | 1. Listen for the distinct audible mechanical click.<br>2. Measure AC/DC voltage across the load when relay is commanded ON.<br>3. Check continuity between `COM` and `NO` with a multimeter while relay is actuated. | 1. Wire the load in series: Power Source (+) → Relay `COM` → Relay `NO` → Load (+) → Load (-) → Power Source (-).<br>2. Verify the external power source (12V DC adapter or AC supply) is plugged in and functional.<br>3. Replace relay module if contacts click but resistance between `COM` and `NO` remains open/infinite (burned contacts). |
| **16** | **Serial monitor shows garbage characters** (`!␀rl`) | 1. Baud rate mismatch between firmware code and Arduino IDE Serial Monitor.<br>2. Bootloader 74880 baud initial text mixed with 115200 runtime logs. | 1. Check `Serial.begin(...)` in `esp8266_gateway.ino` (line 377: `Serial.begin(115200);`).<br>2. Check dropdown in lower-right corner of Serial Monitor. | 1. Set Arduino Serial Monitor baud rate to **`115200 baud`**.<br>2. Note: A few garbage characters immediately upon pressing RESET are normal (ESP8266 ROM bootloader outputs initial status at 74880 baud before switching to 115200). |
| **17** | **ESP keeps rebooting (WDT reset / Exception 0, 9, 28)** | 1. Software Watchdog Timer (WDT) triggered by blocking `while()` or `delay()` in `loop()`.<br>2. Hardware brownout caused by relay coil drawing current from 3.3V rail.<br>3. Null pointer dereference or JSON buffer overflow.<br>4. Faulty power supply or bad USB cable dropping voltage < 4.5V on VIN. | 1. Check Serial Monitor for `Soft WDT reset` or `Exception (28): epc1=...`.<br>2. Check if reboot happens exactly at the moment the relay triggers.<br>3. Measure 3.3V pin voltage during relay actuation. | 1. Power relay coils from `VIN` or external 5V supply — **never** from the 3.3V pin.<br>2. Ensure `webSocket.loop()` is called on every iteration and `yield()` / `delay(0)` is present in long operations.<br>3. Check `StaticJsonDocument` capacity (firmware uses safe sizes: 256 for telemetry, 384 for command).<br>4. Add a 470µF – 1000µF electrolytic capacitor across 5V and GND power rails. |
| **18** | **LED doesn't turn on when client connects** | 1. LED pin polarity inverted.<br>2. Built-in LED on NodeMCU (`D4` / `GPIO 2`) is Active-LOW.<br>3. Client WebSocket handshake not completing successfully.<br>4. Pin `D4` blown or used by another peripheral. | 1. Check Serial Monitor for `[WS] 🔗 Client #0 connected from ...`.<br>2. Verify line 55 (`#define PIN_LED_STATUS D4`) and lines 63–64 (`LED_ON = LOW; LED_OFF = HIGH;`).<br>3. Check if anything is wired to pin `D4`. | 1. Ensure `esp8266_gateway.ino` keeps `LED_ON = LOW` and `LED_OFF = HIGH`.<br>2. Disconnect external components from `D4` (pin D4 / GPIO 2 must float HIGH at boot).<br>3. Verify client connection in browser DevTools Network tab. |
| **19** | **Commands sent but relay doesn't respond** | 1. Inbound JSON structure does not match expected schema (`target`, `action`).<br>2. Command target or action typo (`"Pump"` instead of `"pump"`).<br>3. WebSocket frame received as binary instead of text.<br>4. Relay GPIO pin mismatch in firmware. | 1. Check Serial Monitor for `[COMMAND] 📥 Received ...` or `[COMMAND] ⚠️ Unknown target`.<br>2. Verify JSON payload sent from frontend.<br>3. Check physical GPIO pin continuity to relay board. | 1. Verify JSON payload matches: `{"type":"command","cmdId":"cmd_123","target":"pump","action":"start"}`.<br>2. Ensure target is strictly lowercase `"pump"` or `"valve"` and action is `"start"`/`"stop"` (pump) or `"open"`/`"close"` (valve).<br>3. Verify physical connection from NodeMCU `D1` to Pump Relay `IN` and `D2` to Valve Relay `IN`. |
| **20** | **Soil moisture readings are unstable/noisy** (jumping ±15% per second) | 1. Electromagnetic interference (EMI) from AC motor / pump wiring running parallel to sensor wire.<br>2. Poor grounding / ground loop.<br>3. Floating ADC pin or corroded resistive sensor prongs.<br>4. High impedance noise on unshielded jumper wires. | 1. Check if noise spikes only when pump motor is running.<br>2. Check physical proximity of sensor wires to 220V/110V AC power cables.<br>3. Measure voltage stability on `A0` with an oscilloscope or multimeter. | 1. Separate sensor signal wires by at least 15 cm (6 inches) from AC mains power cables.<br>2. Add a **0.1 µF (100 nF) ceramic capacitor** between NodeMCU `A0` and `GND`.<br>3. Implement a 10-sample moving average filter in code.<br>4. Upgrade to a **Capacitive Soil Moisture Sensor v1.2** with shielded cabling. |

---

## 2. Common Serial Error Messages Explained

The AgroSense gateway firmware outputs structured diagnostic logs at **115200 baud**. When diagnosing issues, keep the Serial Monitor open and compare messages with the table below:

```
==========================================================
  AgroSense SIH25015 — ESP8266 NodeMCU 1.0 Gateway
==========================================================
[INIT] GPIO initialised — all relays OFF, LED OFF
[WIFI] Connecting to SSID: Datamonger ................
[WIFI] ✅ Connected successfully!
[WIFI] 📍 NodeMCU IP address : 10.18.37.83
[WIFI] 🌐 WebSocket URL      : ws://10.18.37.83:81
[WIFI]    ↑ Copy this URL into React or localStorage
[WS]   🚀 WebSocket server listening on port 81
==========================================================
```

### 1. `[WIFI] Connection FAILED — check SSID / password and reboot.`
* **What it means:** The ESP8266 attempted station mode connection for 40 cycles (16 seconds) and failed to obtain an IP lease from the wireless router.
* **Root Causes:**
  - Incorrect Wi-Fi SSID name (case-sensitive) or WPA2 passphrase in firmware.
  - The Wi-Fi network operates strictly on **5.0 GHz** (ESP8266 hardware only has a 2.4 GHz radio).
  - MAC address filtering is active on the router.
  - Router DHCP pool is completely exhausted (no free IP addresses).
* **Fix Action:**
  1. Open [`hardware_firmware/esp8266_gateway.ino`](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino) and verify lines 47–48:
     ```cpp
     const char* WIFI_SSID     = "Your_2.4GHz_SSID";
     const char* WIFI_PASSWORD = "Your_Password";
     ```
  2. Verify your router broadcasts a distinct 2.4 GHz SSID.

---

### 2. `[COMMAND] ❌ JSON parse error: <Error_Code>`
* **What it means:** The WebSocket server received a text frame from a client, but `deserializeJson()` in ArduinoJson failed to parse the payload as valid JSON.
* **Common Error Codes:**
  - `InvalidInput`: Malformed JSON string (e.g., missing closing brace `}`, unescaped quotes, or trailing comma).
  - `NoMemory`: Payload exceeds the allocated `StaticJsonDocument<384>` buffer.
  - `IncompleteInput`: Truncated WebSocket frame received over an unstable network.
* **Fix Action:**
  1. Inspect the outbound command payload from the frontend. Verify that payload is serialized with `JSON.stringify()`:
     ```json
     { "type": "command", "cmdId": "cmd_1725015000", "target": "pump", "action": "start" }
     ```
  2. Ensure no non-ASCII control characters or binary frames are sent to the text endpoint.

---

### 3. `[COMMAND] ⚠️ Received frame missing 'target' or 'action' — ignored.`
* **What it means:** The JSON frame was parsed successfully, but the essential command keys `"target"` or `"action"` are empty strings `""`, `null`, or undefined.
* **Root Causes:**
  - Frontend dispatched a generic telemetry or heartbeat ping frame to the command handler.
  - Key names in frontend dispatch function do not match expected keys (`target`, `action`).
* **Fix Action:**
  - Ensure all command frames adhere to the AgroSense Command Schema:
    ```typescript
    interface HardwareCommand {
      type: "command";
      cmdId: string;
      target: "pump" | "valve";
      action: "start" | "stop" | "open" | "close";
    }
    ```

---

### 4. `[LOOP] ⚠️ Wi-Fi disconnected — waiting for reconnect...`
* **What it means:** The ESP8266 lost its wireless connection with the router while running in `loop()`. Telemetry broadcasts are temporarily suspended to prevent network socket panics.
* **Behavior:**
  - The onboard LED will toggle every 2 seconds to visually indicate disconnected status.
  - The ESP8266 built-in auto-reconnect engine will continuously attempt background re-association.
* **Fix Action:**
  - Check router stability, physical distance, and 2.4 GHz channel interference.
  - If the router was rebooted, the ESP8266 will automatically reacquire its IP within 10–30 seconds once the Wi-Fi beacon is restored.

---

### 5. `[SENSOR] ADC fault` / Floating ADC Fallback
* **What it means:** When the analog reading on `A0` is `< 50` (near ground/floating), the firmware detects that no physical probe is connected or the analog lead is broken.
* **Firmware Fallback Behavior:**
  - In `esp8266_gateway.ino` lines 127–134:
    ```cpp
    if (rawSoil >= 50) {
      float mapped = (float)map(rawSoil, 1023, 350, 0, 100);
      gSoilMoisture = constrain(mapped, 0.0f, 100.0f);
    } else {
      // No probe -> simulate gentle random-walk within realistic band
      gSoilMoisture = drift(gSoilMoisture, 1.2f, 20.0f, 85.0f);
    }
    ```
* **Fix Action:**
  1. If you intend to use a real physical sensor: Check that sensor `VCC` is receiving 3.3V, `GND` is connected, and `AOUT` is firmly plugged into NodeMCU `A0`.
  2. If you are demonstrating the dashboard without physical soil: The firmware will automatically generate realistic random-walk telemetry (20%–85%) so the UI remains fully functional.

---

## 3. Network Troubleshooting

### Finding the ESP8266 IP Address

#### Method 1: Serial Monitor (Direct & Instant)
1. Connect NodeMCU via USB.
2. Open Arduino IDE → **Tools → Serial Monitor**.
3. Set baud rate to **`115200 baud`**.
4. Press the physical **RST** button on the NodeMCU board.
5. Read line: `[WIFI] 📍 NodeMCU IP address : 192.168.x.x` (or `10.x.x.x`).

#### Method 2: PowerShell Subnet Scan
Open Windows PowerShell and run:
```powershell
# Scan ARP table for connected IoT devices
arp -a | Select-String "192.168."
```

#### Method 3: Router DHCP Client Table
1. Open your browser and navigate to your router admin gateway (e.g., `http://192.168.1.1` or `http://192.168.0.1`).
2. Navigate to **DHCP Clients List** or **Connected Devices**.
3. Look for hostnames: `ESP-XXXXXX`, `NodeMCU`, or MAC addresses starting with Espressif OUI prefixes (`5C:CF:7F`, `84:F3:EB`, `60:01:94`, `EC:FA:BC`).

---

### Verifying WebSocket Port 81 Accessibility

Test whether the ESP8266 TCP port `81` is listening and accessible from your computer using PowerShell:

```powershell
Test-NetConnection -ComputerName 10.18.37.83 -Port 81
```

**Expected Output (Successful Connection):**
```text
ComputerName     : 10.18.37.83
RemoteAddress    : 10.18.37.83
RemotePort       : 81
InterfaceAlias   : Wi-Fi
TcpTestSucceeded : True
```

If `TcpTestSucceeded : False`:
1. ESP8266 is turned off or not on the same Wi-Fi network.
2. Router has **AP Isolation** enabled (blocking device-to-device communication).
3. The IP address changed after reboot.

---

### Router & Firewall Configuration

```
               ┌────────────────────────────────────────────────────────┐
               │                     WIRELESS ROUTER                    │
               │                                                        │
               │   [ 2.4 GHz Radio: ENABLED ]   [ AP Isolation: OFF ]   │
               │   [ Security: WPA2-PSK ]       [ Channel Width: 20MHz] │
               └───────────────┬────────────────────────┬───────────────┘
                               │                        │
                    Wi-Fi 2.4G │             Wi-Fi 2.4G │
                               ▼                        ▼
                      ┌─────────────────┐      ┌─────────────────┐
                      │ ESP8266 NodeMCU │      │ React Computer  │
                      │ Port 81 Server  │      │ Browser Client  │
                      │ 192.168.1.150   │      │ 192.168.1.100   │
                      └─────────────────┘      └─────────────────┘
```

> [!WARNING]
> **Disable "AP Isolation" / "Client Isolation" in Router Settings**  
> Many guest Wi-Fi networks and public routers isolate wireless clients from each other. If AP Isolation is ON, your laptop cannot open a TCP socket to the ESP8266 even though both have Internet access. Ensure your PC and NodeMCU are on a private home or lab network with Client Isolation disabled.

* **Wi-Fi Frequency:** Must be **2.4 GHz** (802.11 b/g/n). If your router uses a combined single SSID for 2.4G and 5G (Band Steering), split them into separate SSIDs (e.g., `MyHome_2.4G` and `MyHome_5G`) or bind the ESP8266 to 2.4 GHz.
* **Channel Bandwidth:** Set 2.4 GHz channel width to **20 MHz** (standard) rather than 40 MHz to minimize packet loss and co-channel interference.
* **Security Protocol:** Use **WPA2-PSK (AES)**. Avoid WPA3-Personal Transition Mode if the ESP8266 fails to associate.

---

### Managing DHCP Lease Changes

If your router changes the ESP8266 IP dynamically, you do **not** need to reflash the firmware or rebuild the React application.

**Runtime Override via Browser DevTools:**
1. Open the AgroSense React Dashboard in your browser.
2. Press **F12** (or `Ctrl + Shift + I`) to open Developer Tools.
3. Switch to the **Console** tab.
4. Execute:
   ```javascript
   localStorage.setItem("AGROSENSE_WS_URL", "ws://192.168.1.150:81");
   location.reload();
   ```
5. The dashboard will immediately connect to the new IP and persist this address across browser refreshes.

---

## 4. Relay Actuation Troubleshooting

### Active-LOW vs. Active-HIGH Relays

The vast majority of hobbyist relay modules (Songle 5V blue relays) sold for Arduino/NodeMCU are **Active-LOW**.

```
Active-LOW Relay Circuit Theory:
                  +5V (VCC)
                     │
                    [R] Current-limiting resistor
                     │
                   ┌─┴─┐
                   │   │ Optical LED (Inside Optocoupler)
                   └──┬┘
                      │
   NodeMCU GPIO ──────┴───> Driving LOW (0V) completes circuit -> LED lights -> Relay ENERGIZES!
                            Driving HIGH (3.3V) stops current -> LED off -> Relay DE-ENERGIZES!
```

| Relay Type | Logic Level `LOW` (0V) | Logic Level `HIGH` (3.3V) | Default Module State |
| :--- | :--- | :--- | :--- |
| **Active-LOW** (Standard) | **RELAY ON** (Energized) | **RELAY OFF** (De-energized) | De-energized when GPIO is HIGH |
| **Active-HIGH** | **RELAY OFF** (De-energized) | **RELAY ON** (Energized) | De-energized when GPIO is LOW |

In `hardware_firmware/esp8266_gateway.ino`:
```cpp
// Relay trigger polarity — flip both lines if you have an Active-HIGH module
const int RELAY_ON  = LOW;   // Drive LOW  to ACTIVATE the relay coil
const int RELAY_OFF = HIGH;  // Drive HIGH to DEACTIVATE the relay coil
```

---

### Testing Relay with a Multimeter

```
                    ┌────────────────────────────┐
                    │      RELAY TERMINAL BLOCK  │
                    │   ┌──────┐┌──────┐┌──────┐ │
                    │   │  NO  ││ COM  ││  NC  │ │
                    │   └──┬───┘└──┬───┘└──┬───┘ │
                    └──────┼───────┼───────┼─────┘
                           │       │       │
                     Normally    Common  Normally
                       Open               Closed
```

1. **Test Continuity in De-energized State (Relay OFF):**
   - Set multimeter to **Continuity Beep (🔊)** mode.
   - Probe between **`COM`** and **`NC`**: Multimeter MUST **beep** (0 Ω resistance).
   - Probe between **`COM`** and **`NO`**: Multimeter MUST **remain silent** (Open Circuit / `OL`).
2. **Test Continuity in Energized State (Relay ON / Actuated):**
   - Send `pump start` command from dashboard.
   - Probe between **`COM`** and **`NO`**: Multimeter MUST **beep** (0 Ω resistance).
   - Probe between **`COM`** and **`NC`**: Multimeter MUST **remain silent** (`OL`).

---

### Relay Power Supply & Brownout Prevention

> [!CAUTION]
> **Do NOT Power Relay Coils Directly from NodeMCU 3.3V Pin**  
> An activated 5V electromagnetic relay coil draws between **70 mA and 100 mA** of current. The onboard 3.3V Low-Dropout (LDO) regulator on the NodeMCU (AMS1117-3.3) cannot supply high peak coil switching currents alongside the ESP8266 Wi-Fi radio (which peaks at 170–200 mA during transmissions).  
> Attempting to power relays from the 3.3V pin will cause immediate **voltage brownout resets (Watchdog Resets)** whenever a pump or valve command is triggered!

```
                        SAFE POWER WIRING DIAGRAM
                        
  5V USB / 5V Adapter ──────────────┬───────────────> NodeMCU VIN Pin
                                    │
                                    └───────────────> Relay Module VCC Pin
                                    
  Power GND ────────────────────────┬───────────────> NodeMCU GND Pin
                                    │
                                    └───────────────> Relay Module GND Pin (COMMON GROUND)
                                    
  NodeMCU D1 (GPIO 5) ──────────────────────────────> Relay Module IN1 (Pump)
  NodeMCU D2 (GPIO 4) ──────────────────────────────> Relay Module IN2 (Valve)
```

---

## 5. Sensor Troubleshooting & Calibration

### Soil Moisture Sensor Calibration (Resistive & Capacitive)

The ESP8266 has a single 10-bit Analog-to-Digital Converter (**`A0`**) reading values from `0` to `1023`.

```
                    ANALOG ADC CALIBRATION CURVE
 1023 (Dry Air) ──────┐
                      │
                      │
                      │
                      │
  350 (Full Water) ───┴──────────────────────────────>
                      0% (Dry)                     100% (Saturated)
```

#### Calibration Procedure:
1. **Dry Air Reading ($ADC_{dry}$):**
   - Hold the clean probe in dry ambient air (not touching anything).
   - Read the raw ADC value in Serial Monitor. Typical reading: **`1020 – 1023`**.
2. **100% Saturated Water Reading ($ADC_{wet}$):**
   - Submerge the probe into a cup of tap water up to the safe immersion limit.
   - Read the raw ADC value in Serial Monitor. Typical reading: **`340 – 380`** (Nominal: `350`).
3. **Updating Calibration in Firmware:**
   In [`hardware_firmware/esp8266_gateway.ino`](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino) line 129:
   ```cpp
   // Syntax: map(rawValue, rawDry, rawWet, 0, 100)
   float mapped = (float)map(rawSoil, 1023, 350, 0, 100);
   gSoilMoisture = constrain(mapped, 0.0f, 100.0f);
   ```

---

### ADC Noise Reduction & Filtering

If the soil moisture reading fluctuates erratically:
1. **Hardware Filtering:** Solder or insert a **0.1 µF (100 nF) ceramic capacitor** between `A0` and `GND` right at the NodeMCU header pins. This filters out high-frequency RF noise induced by the ESP8266 Wi-Fi transmitter.
2. **Software Filtering (10-Sample Moving Average):**
   ```cpp
   int readFilteredSoilADC() {
     long sum = 0;
     for (int i = 0; i < 10; i++) {
       sum += analogRead(PIN_SOIL_ANALOG);
       delay(5); // brief settling delay
     }
     return (int)(sum / 10);
   }
   ```

---

### Resistive Probe Electrolysis vs. Capacitive Probes

> [!NOTE]
> **Probe Longevity Warning**  
> Low-cost resistive fork probes (two exposed copper traces) undergo rapid **electrolysis corrosion** if DC current flows through them continuously in wet soil, degrading within weeks.  
> **Best Practice:** For field deployments, upgrade to a **Capacitive Soil Moisture Sensor v1.2 / v2.0**. Capacitive sensors have no exposed copper electrodes and measure dielectric permittivity without electrochemical corrosion.

---

## 6. Cloudflare Tunnel Troubleshooting

Cloudflare Tunnels (`cloudflared`) allow you to securely expose the local ESP8266 WebSocket server to the Internet without port forwarding on your router.

```
┌─────────────────┐        Local TCP        ┌──────────────────┐    Encrypted     ┌──────────────────┐    Secure WSS     ┌─────────────────┐
│ ESP8266 NodeMCU │ ──────────────────────> │ Host PC          │ ───────────────> │ Cloudflare Edge  │ ────────────────> │ Remote Browser  │
│ Port 81 Server  │   ws://192.168.1.50:81  │ cloudflared.exe  │    Tunnel        │ trycloudflare.com│   wss://...:443   │ React Dashboard │
└─────────────────┘                         └──────────────────┘                  └──────────────────┘                   └─────────────────┘
```

### 1. Launching the Cloudflare Tunnel
On the PC connected to the same local network as the ESP8266:
```bash
cloudflared tunnel --url http://10.18.37.83:81
```

Look for the generated tunnel output:
```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://frosty-pine-8291.trycloudflare.com                                                |
+--------------------------------------------------------------------------------------------+
```

---

### 2. Converting HTTP to Secure WebSocket (`WSS://`)
Cloudflare automatically terminates SSL/TLS at its edge. To connect your React dashboard:
1. Replace `https://` with **`wss://`**.
   - Example: `https://frosty-pine-8291.trycloudflare.com` → `wss://frosty-pine-8291.trycloudflare.com`
2. Open browser console on the AgroSense dashboard and save the URL:
   ```javascript
   localStorage.setItem("AGROSENSE_WS_URL", "wss://frosty-pine-8291.trycloudflare.com");
   location.reload();
   ```

---

### 3. Handling Mixed-Content Security Policies
* **Symptom:** React dashboard hosted on `https://your-domain.vercel.app` shows `Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://10.18.37.83:81'.`
* **Resolution:**
  - Modern web security strictly prohibits plaintext `ws://` connections from an `https://` origin.
  - You MUST use the Cloudflare `wss://` secure tunnel URL when using a hosted HTTPS dashboard, OR run the dashboard locally over `http://localhost:5173`.

---

## 7. Arduino IDE & Toolchain Troubleshooting

### 1. Board Package Configuration
1. Open **Arduino IDE → File → Preferences**.
2. In **Additional Boards Manager URLs**, paste:
   ```text
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. Go to **Tools → Board → Boards Manager**, search for `esp8266`, and ensure **esp8266 by ESP8266 Community** is installed (version 3.0.0 or newer).

---

### 2. IDE Board Settings Checklist

| Setting | Recommended Value | Notes |
| :--- | :--- | :--- |
| **Board** | `NodeMCU 1.0 (ESP-12E Module)` | Standard for all NodeMCU v2 / v3 boards |
| **Upload Speed** | `115200` (or `921600`) | Use `115200` if upload fails with packet errors |
| **CPU Frequency** | `80 MHz` (or `160 MHz`) | 80 MHz standard; 160 MHz for heavier compute |
| **Flash Size** | `4MB (FS:1MB OTA:~1012KB)` | Matches standard ESP-12E 32Mbit flash chip |
| **Port** | `COMx` (Windows) | Check Device Manager for assigned COM port |

---

### 3. USB-to-UART Driver Installation (CH340 vs. CP2102)

Check the small rectangular IC chip near the micro-USB connector on your NodeMCU:

```
    ┌──────────────────────┐          ┌──────────────────────┐
    │       WCH CH340G     │          │   SILICON LABS CP2102│
    │                      │          │                      │
    │  - Flat SOP-16 package│          │  - Square QFN-28 package
    │  - Common on v3 boards│         │  - Common on v2 boards
    └──────────────────────┘          └──────────────────────┘
```

* **CH340G Driver:** Download and run the official WCH installer (`CH341SER.EXE`).
* **CP2102 Driver:** Download and install the Silicon Labs CP210x Universal Windows Driver.
* **Verification:** In Windows **Device Manager**, expand **Ports (COM & LPT)**. You should see `USB-SERIAL CH340 (COM3)` or `Silicon Labs CP210x USB to UART Bridge (COM4)` with **no yellow exclamation mark (!)**.

---

### 4. Required Libraries Checklist

Install via **Arduino IDE → Tools → Manage Libraries**:

1. **`WebSockets` by Markus Sattler (Links2004)**
   - *Search query:* `WebSockets`
   - *Author:* Markus Sattler
   - *Required Version:* `2.4.1` or higher
2. **`ArduinoJson` by Benoît Blanchon**
   - *Search query:* `ArduinoJson`
   - *Author:* Benoît Blanchon
   - *Required Version:* `v6.21.x` or `v7.x`

---

## 8. Complete System Diagnostic Checklist

Before conducting a live demonstration or deploying to the field, verify every check item:

- [ ] **Physical Power:** NodeMCU powered via 5V USB (LED blinks on startup).
- [ ] **Relay Power:** Relay board `VCC` powered from `VIN` (5V rail) and sharing common `GND` with ESP.
- [ ] **Safe Boot Verification:** Neither pump nor valve triggers when USB cable is first inserted.
- [ ] **Wi-Fi Association:** Serial monitor confirms `[WIFI] ✅ Connected successfully!` and prints IP.
- [ ] **WebSocket Server:** Serial monitor confirms `[WS] 🚀 WebSocket server listening on port 81`.
- [ ] **Port 81 Reachability:** `Test-NetConnection -ComputerName <ESP_IP> -Port 81` returns `TcpTestSucceeded : True`.
- [ ] **Frontend Handshake:** Browser dashboard shows **CONNECTED** badge; NodeMCU onboard LED (`D4`) turns ON solid.
- [ ] **Telemetry Stream:** Live Temperature, Humidity, and Soil Moisture values update in UI every 2 seconds.
- [ ] **3-Phase Hardware Trust Cycle:**
  - Clicking **PUMP START** immediately changes UI to `AWAITING ACK`.
  - Relay clicks audibly after ~40ms.
  - UI displays `CONFIRMED` badge.
- [ ] **Fail-Safe Recovery:** Unplugging the NodeMCU causes dashboard to transition to `DISCONNECTED` with exponential backoff retry active; reconnecting restores live telemetry automatically within 2 seconds.
