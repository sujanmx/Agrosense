# AgroSense Local Network & Auto-Connection Guide

This guide explains how the **AgroSense Local Auto-Connection** system works and provides a simple, beginner-friendly step-by-step setup walkthrough to connect your computer/browser directly to the ESP8266 controller without needing Cloudflare or an active internet connection.

---

## 🌟 How It Works (At a Glance)

1. **Both devices on the same Wi-Fi:** Your laptop/phone and the ESP8266 NodeMCU connect to the same Wi-Fi router or mobile hotspot (`Redmi`).
2. **ESP mDNS Broadcast:** The ESP8266 advertises itself on the local network as `agrosense.local` and starts a WebSocket server on **Port 81**.
3. **Automatic Discovery:** When you open the AgroSense web dashboard in your browser, the frontend automatically attempts to connect to `ws://agrosense.local:81`.
4. **Direct High-Speed Link:** As soon as the handshake succeeds, the dashboard switches to **`LOCAL ESP`** mode with ultra-low latency (<10 ms).
5. **Seamless Cloud Fallback:** If you take your laptop away from the local farm Wi-Fi, the frontend automatically falls back to your configured Cloudflare remote tunnel endpoint without breaking any features.

---

## 📋 Step-by-Step Setup Guide

Follow these 7 simple steps to get live telemetry and hardware control:

### Step 1: Turn On Your Hotspot / Wi-Fi
- Enable your mobile hotspot or turn on your local Wi-Fi router with:
  - **SSID:** `Redmi`
  - **Security:** WPA2-PSK (2.4 GHz band recommended for ESP8266)

### Step 2: Connect Your Laptop to the Same Wi-Fi
- On your laptop / PC, go to your Wi-Fi settings and connect to the **`Redmi`** network.

### Step 3: Power Up the ESP8266 Gateway
- Plug the ESP8266 NodeMCU into a 5V USB power adapter or your computer's USB port.
- The onboard status LED will flash briefly while connecting to `Redmi`.
- Once connected, the ESP8266 automatically starts:
  - **mDNS Responder:** `agrosense.local`
  - **WebSocket Server:** `ws://agrosense.local:81`

### Step 4: Open the AgroSense Frontend
- Open your web browser (Chrome, Edge, Firefox, or Safari).
- Navigate to your AgroSense application (e.g. `http://localhost:5173` or your hosted URL).

### Step 5: Frontend Probes `agrosense.local:81`
- You will see the status badge in the top bar show:
  ```text
  🟡 CONNECTING...
  ```
- The browser automatically sends a WebSocket handshake to `ws://agrosense.local:81`.

### Step 6: ESP8266 Accepts the Connection
- The ESP8266 accepts the client connection and immediately sends an initial telemetry snapshot containing:
  - Current soil moisture percentage from physical sensor `A0`
  - Simulated ambient temperature & humidity
  - Real-time pump and solenoid valve relay states
  - Local DHCP IP assigned by the router

### Step 7: Dashboard Shows `LOCAL ESP`
- The top-bar badge turns green and displays:
  ```text
  🟢 LOCAL ESP (8ms)
  ```
- Sensor gauges update every 2 seconds, and actuation buttons (Pump Start/Stop, Valve Open/Close) are fully active!

---

## 🔍 Troubleshooting mDNS (`agrosense.local`)

In most modern operating systems (Windows 10/11 with Bonjour/mDNS, macOS, iOS, Ubuntu/Linux, Android 12+), `agrosense.local` resolves out of the box. 

However, if your browser displays **`DISCONNECTED`** or cannot resolve `agrosense.local`, use the following troubleshooting solutions:

### Solution 1: Use the Built-In Manual Local IP Fallback (Easiest)
1. In the AgroSense dashboard, click on the **Connection Badge** in the top bar (e.g. `DISCONNECTED` or `CONNECTING...`).
2. A **Network Diagnostics** dialog will open.
3. Check the ESP8266's assigned IP from your hotspot connected devices list or Serial Monitor (e.g., `192.168.43.150`).
4. Enter the IP into the **Manual Local IP Fallback** input and click **Connect IP**.
5. The dashboard will instantly connect to `ws://192.168.43.150:81` and save it to `localStorage["AGROSENSE_WS_URL"]` so you never have to re-enter it.

---

### Solution 2: Verify Network Isolation & Hotspot Settings
- **Hotspot AP Isolation:** Some mobile hotspots have "AP Isolation" or "Guest Mode" turned on by default, preventing devices on the same Wi-Fi from talking to each other. Ensure **AP Isolation is disabled**.
- **2.4 GHz vs 5 GHz:** ESP8266 only supports **2.4 GHz** Wi-Fi networks. If your phone or router broadcasts dual-band Wi-Fi, ensure the 2.4 GHz band is enabled.

---

### Solution 3: Windows mDNS Resolver
- On older Windows versions or restrictive corporate networks, mDNS (UDP port 5353) may be blocked.
- To test if your computer can resolve `agrosense.local`, open PowerShell and run:
  ```powershell
  ping agrosense.local
  ```
- If it resolves and returns packets with the ESP's IP (e.g. `192.168.x.x`), mDNS is working correctly. If ping times out, use **Solution 1 (Manual IP Fallback)**.

---

## 🛡️ Security & Privacy Notice

- **Zero Credential Exposure:** Wi-Fi credentials and API keys are stored solely in your local firmware and environment variables; they are never sent over public logs or included in client bundle outputs.
- **Hardware Isolation:** All relay actuation signals (`D1`, `D2`) are verified through a 3-phase hardware trust pipeline (`awaiting_ack` ➔ GPIO switch ➔ `confirmed`), ensuring physical relays never actuate without confirmed state feedback.
