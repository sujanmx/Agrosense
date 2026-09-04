# AgroSense SIH25015 — Cloudflare Tunnel & Remote WebSocket Setup Guide

A complete, beginner-friendly guide for securely exposing the AgroSense ESP8266 local WebSocket server over the Internet using Cloudflare Tunnel (`cloudflared`), enabling remote monitoring and control from the AgroSense React dashboard without port forwarding or firmware credentials.

---

## 1. Architecture Overview

### Connection Chain

```text
┌─────────────────────────────────────────────────────────────┐
│                 React Dashboard (Browser)                   │
│      Running on Laptop, Tablet, Smartphone, or Web Host     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼  WSS (TLS-Encrypted WebSocket)
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge Network                    │
│            wss://<tunnel-subdomain>.trycloudflare.com       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼  Cloudflare Tunnel (Outbound TLS)
┌─────────────────────────────────────────────────────────────┐
│             cloudflared Daemon (Local Machine)              │
│       Running on Laptop / Home Server on the same Wi-Fi     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼  HTTP/WS Proxy (Local Subnet)
┌─────────────────────────────────────────────────────────────┐
│               ESP8266 NodeMCU 1.0 (ESP-12E)                 │
│         Standalone WebSocket Server: ws://192.168.x.y:81    │
│                                                             │
│   ┌──────────────────────┐      ┌───────────────────────┐   │
│   │ D1 (GPIO 5) → Pump   │      │ D2 (GPIO 4) → Valve   │   │
│   └──────────────────────┘      └───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Role | Security / Network Scope |
| :--- | :--- | :--- |
| **React Dashboard** | Web frontend application. Displays telemetry stream, triggers irrigation pump and solenoid valve actuators, and renders agricultural intelligence. | Connects over standard browser WebSocket (`wss://`) using TLS. |
| **Cloudflare Edge** | Cloud reverse-proxy and TLS termination point. Routes traffic globally through Cloudflare's Anycast network. | Provides zero-configuration SSL/TLS certificate and DDoS protection. |
| **`cloudflared` Daemon** | Lightweight command-line daemon running on a computer within the same Local Area Network (LAN) as the ESP8266. | Establishes an *outbound-only* HTTPS/QUIC tunnel to Cloudflare. Requires **no open inbound router ports**. |
| **ESP8266 Gateway** | NodeMCU microcontroller hosting a lightweight WebSocket server on Port `81` via [esp8266_gateway.ino](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino). | Fully isolated from the public Internet; listens strictly on local LAN (`ws://<LOCAL_IP>:81`). |

> [!IMPORTANT]
> **Zero Secrets in Firmware**: The ESP8266 firmware contains **NO Cloudflare credentials, API tokens, or SSL certificates**. It acts strictly as an internal LAN server. Cloudflare handles encryption and tunneling externally.

---

## 2. Prerequisites

Before starting the tunnel setup, ensure you have the following ready:

1. **ESP8266 NodeMCU 1.0 (ESP-12E Module)**:
   - Flashed with [hardware_firmware/esp8266_gateway.ino](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino).
   - Powered and connected to your 2.4 GHz Wi-Fi access point.
2. **ESP8266 Local IP Address**:
   - Identified via Arduino Serial Monitor (115200 baud) or router DHCP client list (e.g., `192.168.1.105` or `10.18.37.83`).
3. **Local WebSocket Confirmed**:
   - Verified that the ESP8266 responds to local WebSocket requests on Port `81` from a browser on the same Wi-Fi.
4. **Host Machine for `cloudflared`**:
   - A PC, laptop, or Raspberry Pi connected to the **exact same Wi-Fi network / subnet** as the ESP8266.
5. **`cloudflared` CLI Installed**:
   - Follow the installation instructions below for your operating system.

### Installing `cloudflared`

#### Windows (PowerShell / Winget)
```powershell
winget install --id Cloudflare.cloudflared
```
*Or download the Windows 64-bit executable from [Cloudflare Releases](https://github.com/cloudflare/cloudflared/releases) and add it to your System `PATH`.*

#### macOS (Homebrew)
```bash
brew install cloudflared
```

#### Linux (Debian / Ubuntu / Raspberry Pi OS)
```bash
# Add Cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare.gpg

# Add repository & install
echo "deb [signed-by=/usr/share/keyrings/cloudflare.gpg] https://pkg.cloudflare.com/cloudflared bullseye main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

Verify installation:
```bash
cloudflared --version
```

---

## 3. Step-by-Step Setup

### Step 1: Obtain the ESP8266 IP Address

1. Connect the ESP8266 to your computer via micro-USB.
2. Open the **Arduino IDE** (or VS Code / PlatformIO).
3. Open the **Serial Monitor** at **115200 baud**.
4. Press the **RST** (Reset) button on the NodeMCU board.
5. Note the assigned IP address in the boot log:

```text
==========================================================
  AgroSense SIH25015 — ESP8266 NodeMCU 1.0 Gateway
==========================================================
[INIT] GPIO initialised — all relays OFF, LED OFF
[WIFI] Connecting to SSID: YourWiFiName ........
[WIFI] ✅ Connected successfully!
[WIFI] 📍 NodeMCU IP address : 192.168.1.105
[WIFI] 🌐 WebSocket URL      : ws://192.168.1.105:81
[WIFI]    ↑ Copy this URL into React or localStorage
[WS]   🚀 WebSocket server listening on port 81
==========================================================
```

> [!NOTE]
> In this guide, replace `192.168.1.105` with your ESP8266's actual local IP address.

---

### Step 2: Test the Local WebSocket in Browser Console

Before setting up the tunnel, verify that your computer can communicate directly with the ESP8266 WebSocket server:

1. Open **Google Chrome**, **Microsoft Edge**, or **Firefox**.
2. Press `F12` (or `Ctrl + Shift + I` / `Cmd + Option + I`) to open Developer Tools.
3. Switch to the **Console** tab.
4. Paste and execute this JavaScript test snippet:

```javascript
let testSocket = new WebSocket('ws://192.168.1.105:81');

testSocket.onopen = () => {
  console.log('✅ Local WebSocket connected successfully to ESP8266!');
};

testSocket.onmessage = (event) => {
  console.log('📡 Telemetry received from ESP8266:', JSON.parse(event.data));
};

testSocket.onerror = (err) => {
  console.error('❌ WebSocket error (check IP and Wi-Fi connection):', err);
};
```

5. Within 2 seconds, you should see telemetry packets streaming:
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
6. Close the test connection:
```javascript
testSocket.close();
```

---

### Step 3: Launch the Cloudflare Quick Tunnel

On the host machine (connected to the same local Wi-Fi), open a terminal or PowerShell prompt and run:

```bash
cloudflared tunnel --url http://192.168.1.105:81
```

> [!IMPORTANT]
> Use `http://` (not `ws://`) in the `cloudflared` CLI argument. Cloudflare automatically handles HTTP upgrade headers for WebSocket connections over HTTP upstream targets.

#### Expected Terminal Output:
```text
2026-08-30T11:40:00Z INF Thank you for trying Cloudflare Tunnel. Doing so, without a Cloudflare account, is a quick way to experiment...
2026-08-30T11:40:02Z INF Requesting new quick tunnel on trycloudflare.com...
2026-08-30T11:40:05Z INF +--------------------------------------------------------------------------------------------+
2026-08-30T11:40:05Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2026-08-30T11:40:05Z INF |  https://temporary-agri-tunnel-example.trycloudflare.com                                   |
2026-08-30T11:40:05Z INF +--------------------------------------------------------------------------------------------+
2026-08-30T11:40:06Z INF Route propagating, please allow up to 30 seconds for network configuration...
2026-08-30T11:40:08Z INF Registered tunnel connection connIndex=0 connection=...
```

---

### Step 4: Convert HTTPS URL to Secure WebSocket (WSS)

Cloudflare outputs an `https://` URL. For WebSocket communication in the React app, transform the protocol prefix:

| Format | URL String |
| :--- | :--- |
| **Cloudflare Output** | `https://temporary-agri-tunnel-example.trycloudflare.com` |
| **Required WSS URL** | `wss://temporary-agri-tunnel-example.trycloudflare.com` |

---

### Step 5: Configure React `localStorage`

1. Open your AgroSense React dashboard in the browser (e.g., `http://localhost:5173` or your production HTTPS URL).
2. Press `F12` to open the browser Developer Tools.
3. Switch to the **Console** tab.
4. Execute the following commands:

```javascript
// 1. Set the runtime WebSocket URL override
localStorage.setItem('AGROSENSE_WS_URL', 'wss://temporary-agri-tunnel-example.trycloudflare.com');

// 2. Reload the application to apply the new connection
location.reload();
```

---

### Step 6: Verify ESP8266 Serial Monitor Logs

Once the page reloads, inspect the ESP8266 Serial Monitor. You will observe the incoming connection negotiated through the Cloudflare proxy:

```text
[WS] [0] Connected from 192.168.1.150 url: /
[WS] Total connected clients: 1
[TELEMETRY] 📡 Broadcast → {"type":"telemetry","temperature":"28.4","humidity":"58.6","soilMoisture":"44.0","pumpActive":false,"valveOpen":false}
```

---

### Step 7: Test Actuation Commands End-to-End

1. In the React dashboard, navigate to the **Hardware / Actuators** control panel.
2. Click **Start Pump** or **Open Solenoid Valve**.
3. Observe the three-phase Hardware Trust Pipeline in the ESP8266 Serial Monitor:

```text
──────────────────────────────────────────────────────────
[COMMAND] 📥 Received  cmdId=cmd_pump_1725000000000  target=pump    action=start
[COMMAND] 📡 Phase 1 — ACK sent to client #0
[HARDWARE] 💧 Pump relay ACTIVATED  (D1 → RELAY_ON)
[COMMAND] 📡 Phase 3 — Confirmed broadcast sent: pump=ON, valve=OFF
──────────────────────────────────────────────────────────
```
4. Verify that the React dashboard switches status from `SENDING` → `AWAITING_ACK` → `CONFIRMED` with a green indicator.

---

## 4. Important Notes

### Quick Tunnels vs. Named Tunnels

```mermaid
graph LR
    subgraph Quick Tunnel (Development)
        A[cloudflared --url ...] --> B[Random *.trycloudflare.com]
        B --> C[URL changes on restart]
    end
    subgraph Named Tunnel (Production)
        D[cloudflared tunnel run] --> E[Custom Domain e.g. ws.agrosense.farm]
        E --> F[Permanent Static URL]
    end
```

* **Quick Tunnel Ephemeral URLs**:
  Quick Tunnels (`--url`) generate a new random URL every time the command is restarted. You must update `AGROSENSE_WS_URL` in `localStorage` whenever you restart `cloudflared`.
* **Permanent / Named Tunnels (Production Setup)**:
  For a permanent URL (e.g., `wss://ws-iot.yourdomain.com`), create a free Cloudflare account, configure a named tunnel via `cloudflared tunnel create agrosense-gateway`, and route it in your Cloudflare DNS dashboard.
* **Network Locality**:
  The ESP8266 does **not** need internet access itself; it only communicates within your local Wi-Fi subnet. However, the machine running `cloudflared` must have an active internet connection to maintain the tunnel to Cloudflare.

---

## 5. React `localStorage` Reference

The AgroSense frontend [WebSocketProvider.tsx](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/src/providers/WebSocketProvider.tsx) resolves the gateway address using a strict priority order:

1. **`localStorage.getItem("AGROSENSE_WS_URL")`** *(Highest Priority — Runtime Override)*
2. **`import.meta.env.VITE_WS_URL`** *(Environment Configuration)*
3. **`ws://10.18.37.83:81`** *(Hardware Fallback Default)*

### Console Helper Commands

#### Set Remote Cloudflare Tunnel URL
```javascript
localStorage.setItem('AGROSENSE_WS_URL', 'wss://YOUR-HOSTNAME.trycloudflare.com');
location.reload();
```

#### Set Local LAN IP (Direct Local Connection)
```javascript
localStorage.setItem('AGROSENSE_WS_URL', 'ws://192.168.1.105:81');
location.reload();
```

#### Inspect Current URL
```javascript
console.log('Current WS URL:', localStorage.getItem('AGROSENSE_WS_URL'));
```

#### Reset to Application Default
```javascript
localStorage.removeItem('AGROSENSE_WS_URL');
location.reload();
```

> [!CAUTION]
> **Security Warning**: Do NOT store Wi-Fi passwords, Gemini API keys, Cloudflare tokens, or private secrets in `localStorage`. Items in `localStorage` are accessible to any script executed within the browser origin. Only store public endpoint URLs such as `AGROSENSE_WS_URL`.

---

## 6. Verifying the Full Chain

Use this checklist to verify that all layers of the communication pipeline are operational:

- [ ] **1. ESP8266 Wi-Fi Link**: Serial Monitor prints `[WIFI] ✅ Connected successfully!` with a valid local IP.
- [ ] **2. Local Port 81 Listening**: Local browser test `new WebSocket('ws://<ESP_IP>:81')` receives telemetry payloads.
- [ ] **3. `cloudflared` Active**: Terminal outputs `Your quick Tunnel has been created!` with a `*.trycloudflare.com` URL.
- [ ] **4. Protocol Conversion**: URL is converted from `https://...` to `wss://...`.
- [ ] **5. `localStorage` Set**: `AGROSENSE_WS_URL` is set in the dashboard browser and the page is refreshed.
- [ ] **6. UI Connection Badge**: React header displays `LIVE / CONNECTED` (Green status).
- [ ] **7. Telemetry Streaming**: Soil moisture, temperature, and humidity charts update every 2000 ms.
- [ ] **8. Actuation Handshake**: Actuating the Pump or Valve clicks the physical relay and updates UI state to `CONFIRMED`.
- [ ] **9. ESP Client Tracking**: ESP8266 Serial Monitor prints `[WS] [0] Connected` and logs incoming commands.

---

## 7. Troubleshooting

| Issue / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **`cloudflared` connection refused** | Incorrect ESP IP or ESP is offline. | 1. Check Serial Monitor for the ESP8266 IP.<br>2. Run `ping <ESP_IP>` from your terminal to verify reachability.<br>3. Ensure both devices are on the same 2.4 GHz Wi-Fi network. |
| **WebSocket handshake failed / 404** | Protocol mismatch or wrong port. | 1. Ensure `cloudflared` points to `http://<ESP_IP>:81` (Port 81, not Port 80).<br>2. Ensure the browser URL starts with `wss://`, not `ws://` or `https://`. |
| **Mixed Content Security Error** | Dashboard is served over HTTPS while attempting insecure `ws://`. | Modern browsers block insecure `ws://` calls from `https://` origins. Setting the tunnel URL with `wss://` completely resolves this. |
| **Dashboard stuck in `CONNECTING`** | Old or expired Cloudflare tunnel URL in `localStorage`. | Quick Tunnel URLs expire when `cloudflared` stops. Re-run `cloudflared`, copy the new URL, and update `localStorage.setItem('AGROSENSE_WS_URL', 'wss://...')`. |
| **Relay does not trigger on command** | Relay trigger polarity inverted or insufficient power. | 1. NodeMCU GPIOs operate at 3.3V. Ensure your relay module triggers reliably at 3.3V logic.<br>2. In [esp8266_gateway.ino](file:///C:/Users/sujan/Downloads/sih2%20-%20Copy/hardware_firmware/esp8266_gateway.ino), swap `RELAY_ON` (`LOW` vs `HIGH`) if your module is Active-HIGH.<br>3. Power relay coils from an external 5V source, sharing a Common Ground (GND) with the ESP. |

> [!TIP]
> To quickly clear browser connection caches when testing tunnels, open Developer Tools (`F12`), right-click the browser **Reload** button, and select **"Empty Cache and Hard Reload"**.

---

## 8. Hardware Pinout & Safety Reference

```text
NodeMCU 1.0 (ESP-12E)
┌─────────────────────────┐
│ [USB]                   │
│                         │
│  D1 (GPIO 5) ───────────┼───► Relay IN 1 (Irrigation Pump)
│  D2 (GPIO 4) ───────────┼───► Relay IN 2 (Solenoid Valve)
│  D4 (GPIO 2) ───────────┼───► Onboard Status LED (Active-LOW)
│  A0 (ADC 0)  ───────────┼───► Soil Moisture Analog Out (0 - 3.3V Max)
│  3V3 / VIN   ───────────┼───► Logic / Power Rails
│  GND         ───────────┼───► Common Ground (Shared with Relay VCC/GND)
└─────────────────────────┘
```

> [!WARNING]
> **GPIO Electrical Limits & Inductive Loads**:
> - ESP8266 GPIO pins are rated for a maximum of **12 mA** current draw at **3.3V**.
> - **NEVER** wire high-current pumps, solenoid coils, or DC motors directly to ESP8266 GPIO pins.
> - Always use an optocoupler-isolated relay module or MOSFET driver with a flyback diode.
> - Power high-power inductive loads (pumps/valves) from a dedicated external power supply, keeping logic and coil power decoupled while maintaining a shared ground.
