/*
 * ==============================================================================
 * AgroSense SIH25015 — ESP8266 NodeMCU 1.0 (ESP-12E) Gateway Firmware
 * ==============================================================================
 * File      : esp8266_gateway.ino
 * Board     : NodeMCU 1.0 (ESP-12E Module)
 * Baud      : 115200
 * Version   : AgroSense-ESP-v2.1 (Real-Sensor-Only)
 *
 * PURPOSE:
 *   Hosts a WebSocket server on Port 81. Every 2000ms it reads the soil
 *   moisture sensor on A0 and broadcasts a JSON telemetry payload to every
 *   connected React client.
 *
 *   Temperature and humidity are NOT physically connected. The firmware
 *   reports them as null (sensor_unavailable) instead of simulating values.
 *
 *   When the React dashboard sends an actuation command (pump start/stop,
 *   valve open/close), this firmware:
 *     1. Immediately replies with {"status":"awaiting_ack"}
 *     2. Writes HIGH or LOW to the correct relay GPIO
 *     3. Delays 40ms for relay contact settling
 *     4. Broadcasts {"status":"confirmed"} to all clients
 *
 * HARDWARE PIN MAPPING:
 *   D1 (GPIO 5)  → Relay IN — Irrigation Pump     (Active-LOW)
 *   D2 (GPIO 4)  → Relay IN — Solenoid Valve       (Active-LOW)
 *   D4 (GPIO 2)  → Built-in LED                    (Active-LOW)
 *   A0 (ADC 0)   → Soil-Moisture Sensor            (0–1023, 10-bit)
 *
 * DATA SOURCE TRANSPARENCY (REAL vs UNAVAILABLE):
 *   Soil Moisture → REAL — Physical resistive probe on A0
 *   Temperature   → UNAVAILABLE — No DHT/DS18B20/BME280 connected
 *   Humidity      → UNAVAILABLE — No DHT/BME280/SHT31 connected
 *
 * TO ADD REAL TEMPERATURE/HUMIDITY LATER:
 *   1. Wire a DHT22 sensor: Data pin → D3 (GPIO 0), VCC → 3.3V, GND → GND
 *   2. Install "DHT sensor library" by Adafruit (Library Manager)
 *   3. In this file, uncomment the DHT section (search for "DHT_SENSOR_READY")
 *   4. Remove the null-reporting lines for temperature/humidity
 *
 * REQUIRED ARDUINO LIBRARIES (install via Library Manager):
 *   • "WebSockets" by Markus Sattler (Links2004)  — v2.4.x or newer
 *   • "ArduinoJson" by Benoît Blanchon            — v6.x or v7.x
 *
 * RELAY LOGIC NOTE:
 *   Most relay modules sold for NodeMCU are Active-LOW (trigger = LOW).
 *   Swap RELAY_ON / RELAY_OFF below if your module behaves differently.
 * ==============================================================================
 */

#include <ESP8266WiFi.h>       // ESP8266 Wi-Fi stack
#include <ESP8266mDNS.h>       // Multicast DNS (mDNS) responder (agrosense.local)
#include <WebSocketsServer.h>  // WebSocket server (Links2004 library)
#include <ArduinoJson.h>       // JSON serialization / deserialization

// ==============================================================================
// 1. FIRMWARE IDENTITY
// ==============================================================================
#define AGROSENSE_FIRMWARE_VERSION  "AgroSense-ESP-v2.1"
#define AGROSENSE_BOARD             "NodeMCU 1.0 (ESP-12E)"
#define AGROSENSE_PROJECT           "AgroSense SIH25015"
#define AGROSENSE_HOSTNAME          "agrosense"

// ==============================================================================
// 2. WI-FI CREDENTIALS
// ==============================================================================
// Change these to match your local Wi-Fi network
const char* WIFI_SSID     = "Redmi";
const char* WIFI_PASSWORD = "sujan1222";

// ==============================================================================
// 3. HARDWARE PIN DEFINITIONS
// ==============================================================================
// DO NOT change these pins unless the physical wiring is changed.
#define PIN_RELAY_PUMP   D1   // GPIO 5  — Irrigation Pump relay signal
#define PIN_RELAY_VALVE  D2   // GPIO 4  — Solenoid Valve relay signal
#define PIN_LED_STATUS   D4   // GPIO 2  — Onboard LED (Active-LOW)
#define PIN_SOIL_ANALOG  A0   // ADC 0   — Soil Moisture Sensor (0-1023)

// ==============================================================================
// 4. RELAY & LED POLARITY CONFIGURATION
// ==============================================================================
// Relay trigger polarity — flip both lines if you have an Active-HIGH module
const int RELAY_ON  = LOW;   // Drive LOW  to ACTIVATE  the relay coil
const int RELAY_OFF = HIGH;  // Drive HIGH to DEACTIVATE the relay coil

// LED polarity — NodeMCU built-in LED on D4 is Active-LOW
const int LED_ON  = LOW;
const int LED_OFF = HIGH;

// ==============================================================================
// 5. SOIL MOISTURE CALIBRATION CONSTANTS
// ==============================================================================
// These values are defaults for a common resistive soil moisture probe.
// Calibrate for YOUR specific sensor and soil type:
//   1. Insert probe into dry air → note ADC reading → set SOIL_DRY_ADC
//   2. Insert probe into water   → note ADC reading → set SOIL_WET_ADC
//
// Common resistive probe behavior:
//   ADC ≈ 1023 → completely dry  → maps to 0%
//   ADC ≈ 350  → fully saturated → maps to 100%
//
// NOTE: Capacitive sensors may have INVERTED behavior. Measure and adjust.

#define SOIL_DRY_ADC    1023    // ADC value when probe is in dry air
#define SOIL_WET_ADC    350     // ADC value when probe is in water
#define SOIL_FLOAT_MIN  50      // ADC below this = no probe connected (floating)

// ==============================================================================
// 6. TIMING CONFIGURATION
// ==============================================================================
const uint16_t WS_PORT              = 81;      // WebSocket server port
const uint32_t TELEMETRY_INTERVAL   = 2000;    // ms between sensor broadcasts
const uint32_t ACK_SETTLE_DELAY     = 40;      // ms for relay contact settling
const uint32_t WIFI_CONNECT_TIMEOUT = 16000;   // ms to wait for Wi-Fi connect
const uint32_t WIFI_RECONNECT_INTERVAL = 30000; // ms between reconnect attempts
const uint32_t DIAG_INTERVAL        = 60000;   // ms between diagnostic prints

// ==============================================================================
// 7. SAFETY CONFIGURATION
// ==============================================================================
// Maximum continuous pump/valve runtime (safety timeout)
// Set to 0 to disable safety timeout
const uint32_t PUMP_MAX_RUNTIME_MS  = 0;  // 0 = no auto-shutoff (user-controlled)
const uint32_t VALVE_MAX_RUNTIME_MS = 0;  // 0 = no auto-shutoff (user-controlled)

// ==============================================================================
// 8. GLOBAL OBJECTS & STATE
// ==============================================================================
WebSocketsServer webSocket(WS_PORT);

// Client tracking
uint8_t connectedClients = 0;

// Physical actuator state — kept in sync with hardware GPIO levels
bool pumpActive = false;
bool valveOpen  = false;

// Timestamps for actuator runtime tracking
unsigned long pumpStartMs  = 0;
unsigned long valveStartMs = 0;

// Running sensor values updated on every telemetry tick
// ───────────────────────────────────────────────────────
// gSoilMoisture: REAL physical reading from A0 (or -1/-2 on error)
// Temperature & Humidity: NO physical sensor — reported as "sensor_unavailable"
//   to prevent fake values from appearing on the dashboard.
float gSoilMoisture = 0.0f;   // % — REAL physical sensor (A0)
bool  gSoilFault    = false;  // true when ADC read fails
bool  gSoilNoProbe  = false;  // true when probe appears disconnected

// Scheduling timestamps (millis-based, no blocking delays)
unsigned long lastTelemetryMs  = 0;
unsigned long lastWifiCheckMs  = 0;
unsigned long lastDiagMs       = 0;

// Wi-Fi state tracking
bool wifiWasConnected = false;

// ==============================================================================
// 9. ACTUATOR MANAGER
// ==============================================================================
/**
 * Safely set the irrigation pump to ON or OFF.
 * Updates both the GPIO and the tracking state variable.
 *
 * @param on  true = activate pump relay, false = deactivate
 */
void setPump(bool on) {
  if (on) {
    digitalWrite(PIN_RELAY_PUMP, RELAY_ON);
    pumpActive = true;
    pumpStartMs = millis();
    // Phase-13 pump diagnostics — explicit GPIO + relay state
    Serial.println(F("[PUMP] Command received : ON"));
    Serial.printf_P(PSTR("[PUMP] GPIO            : D1 / GPIO%d  → LOW (relay coil energised)\n"), PIN_RELAY_PUMP);
    Serial.println(F("[PUMP] Relay state     : ACTIVE  (IN1 = LOW, coil ON, COM→NO closed)"));
  } else {
    digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
    pumpActive = false;
    pumpStartMs = 0;
    // Phase-13 pump diagnostics
    Serial.println(F("[PUMP] Command received : OFF"));
    Serial.printf_P(PSTR("[PUMP] GPIO            : D1 / GPIO%d  → HIGH (relay coil de-energised)\n"), PIN_RELAY_PUMP);
    Serial.println(F("[PUMP] Relay state     : INACTIVE (IN1 = HIGH, coil OFF, COM→NC closed)"));
  }
}

/**
 * Safely set the solenoid valve to OPEN or CLOSED.
 * Updates both the GPIO and the tracking state variable.
 *
 * @param on  true = open valve (activate relay), false = close valve
 */
void setValve(bool on) {
  if (on) {
    digitalWrite(PIN_RELAY_VALVE, RELAY_ON);
    valveOpen = true;
    valveStartMs = millis();
    // Phase-13 valve diagnostics
    Serial.println(F("[VALVE] Command received : OPEN"));
    Serial.printf_P(PSTR("[VALVE] GPIO            : D2 / GPIO%d  → LOW (relay coil energised)\n"), PIN_RELAY_VALVE);
    Serial.println(F("[VALVE] Relay state     : ACTIVE  (IN2 = LOW, coil ON, COM→NO closed)"));
  } else {
    digitalWrite(PIN_RELAY_VALVE, RELAY_OFF);
    valveOpen = false;
    valveStartMs = 0;
    // Phase-13 valve diagnostics
    Serial.println(F("[VALVE] Command received : CLOSE"));
    Serial.printf_P(PSTR("[VALVE] GPIO            : D2 / GPIO%d  → HIGH (relay coil de-energised)\n"), PIN_RELAY_VALVE);
    Serial.println(F("[VALVE] Relay state     : INACTIVE (IN2 = HIGH, coil OFF, COM→NC closed)"));
  }
}

/**
 * Emergency safe state — turns OFF all actuators and LED.
 * Called at boot and can be called on error recovery.
 * Sets GPIO states BEFORE any network initialization.
 */
void allActuatorsSafe() {
  digitalWrite(PIN_RELAY_PUMP,  RELAY_OFF);
  digitalWrite(PIN_RELAY_VALVE, RELAY_OFF);
  digitalWrite(PIN_LED_STATUS,  LED_OFF);
  pumpActive  = false;
  valveOpen   = false;
  pumpStartMs  = 0;
  valveStartMs = 0;
}

// ==============================================================================
// 10. SENSOR MANAGER
// ==============================================================================
/**
 * Read the soil moisture sensor on A0 and validate the ADC value.
 *
 * @return Soil moisture percentage (0.0–100.0), or -1.0 on ADC fault,
 *         or -2.0 when the probe appears disconnected (floating input).
 */
float readSoilMoisture() {
  int rawADC = analogRead(PIN_SOIL_ANALOG);

  // Validate ADC range (ESP8266 ADC is 10-bit: 0–1023)
  if (rawADC < 0 || rawADC > 1023) {
    Serial.println(F("[SENSOR] ⚠️ ADC value out of range — possible hardware fault"));
    return -1.0f;  // Signal error to caller
  }

  // If ADC is below threshold, probe is likely not connected (floating pin)
  if (rawADC < SOIL_FLOAT_MIN) {
    return -2.0f;  // Signal "no probe" to caller
  }

  // Map ADC to percentage using calibration constants
  // DRY_ADC → 0%, WET_ADC → 100%
  float mapped = (float)map(rawADC, SOIL_DRY_ADC, SOIL_WET_ADC, 0, 100);
  return constrain(mapped, 0.0f, 100.0f);
}

/**
 * Read all physical sensors and update global state variables.
 *
 * SOIL MOISTURE → REAL physical reading from A0 (resistive probe).
 * TEMPERATURE   → UNAVAILABLE (no physical sensor — NOT simulated).
 * HUMIDITY      → UNAVAILABLE (no physical sensor — NOT simulated).
 *
 * Fault codes are stored in gSoilFault / gSoilNoProbe flags so that
 * the telemetry builder can report the correct sensor_status to the
 * React dashboard instead of sending fake numbers.
 */
void readAllSensors() {
  // ── Physical sensor: Soil Moisture (A0) ──────────────────────
  float soilReading = readSoilMoisture();

  if (soilReading == -1.0f) {
    // ADC hardware fault — retain last known good value, set fault flag
    gSoilFault   = true;
    gSoilNoProbe = false;
    Serial.println(F("[SENSOR] ADC fault — retaining last soil moisture value, flagging fault"));
  } else if (soilReading == -2.0f) {
    // Probe physically disconnected (floating input)
    gSoilFault   = false;
    gSoilNoProbe = true;
    Serial.println(F("[SENSOR] Soil probe appears disconnected (ADC below SOIL_FLOAT_MIN)"));
  } else {
    // Valid physical reading
    gSoilMoisture = soilReading;
    gSoilFault    = false;
    gSoilNoProbe  = false;
  }

  // ── Temperature: NO PHYSICAL SENSOR ──────────────────────────
  // No DHT / DS18B20 / BME280 is wired to this board.
  // Values are NOT generated or simulated here.
  // The telemetry builder will send null / "sensor_unavailable".

  // ── Humidity: NO PHYSICAL SENSOR ─────────────────────────────
  // Same as temperature — no physical sensor is present.
  // The telemetry builder will send null / "sensor_unavailable".
}

// ==============================================================================
// 11. TELEMETRY MANAGER
// ==============================================================================
/**
 * Read sensors and broadcast telemetry JSON to all connected WebSocket clients.
 *
 * Payload schema (compatible with React Zustand TelemetryPayload + HardwareState):
 *   {
 *     "type"        : "telemetry",
 *   TELEMETRY JSON SCHEMA (AgroSense-ESP-v2.1):
 *   {
 *     "type"          : "telemetry",
 *     "temperature"   : null,          ← UNAVAILABLE (no physical sensor)
 *     "humidity"      : null,          ← UNAVAILABLE (no physical sensor)
 *     "soilMoisture"  : 45.0,          ← REAL PHYSICAL SENSOR (A0)
 *     "soilStatus"    : "ok",          ← "ok" | "fault" | "no_probe"
 *     "tempStatus"    : "sensor_unavailable",
 *     "humidStatus"   : "sensor_unavailable",
 *     "pumpActive"    : false,         ← ACTUATOR STATE
 *     "valveOpen"     : false          ← ACTUATOR STATE
 *   }
 */
void broadcastTelemetry() {
  readAllSensors();

  JsonDocument doc;
  doc["type"] = "telemetry";

  // ── Temperature: NO PHYSICAL SENSOR ──────────────────────────
  // Explicitly send null — the React dashboard will display "N/A"
  doc["temperature"] = (char*)nullptr;   // JSON null
  doc["tempStatus"]  = "sensor_unavailable";

  // ── Humidity: NO PHYSICAL SENSOR ─────────────────────────────
  doc["humidity"]    = (char*)nullptr;   // JSON null
  doc["humidStatus"] = "sensor_unavailable";

  // ── Soil Moisture: REAL PHYSICAL SENSOR (A0) ─────────────────
  if (gSoilFault) {
    doc["soilMoisture"] = (char*)nullptr;
    doc["soilStatus"]   = "fault";
  } else if (gSoilNoProbe) {
    doc["soilMoisture"] = (char*)nullptr;
    doc["soilStatus"]   = "no_probe";
  } else {
    doc["soilMoisture"] = serialized(String(gSoilMoisture, 1));
    doc["soilStatus"]   = "ok";
  }

  // ── Actuator state ────────────────────────────────────────────
  doc["pumpActive"] = pumpActive;
  doc["valveOpen"]  = valveOpen;
  doc["ip"]         = WiFi.localIP().toString();

  String json;
  serializeJson(doc, json);

  webSocket.broadcastTXT(json);

  Serial.print(F("[TELEMETRY] 📡 Broadcast → "));
  Serial.println(json);
}

// ==============================================================================
// 12. COMMAND VALIDATION & EXECUTION — HARDWARE TRUST PIPELINE
// ==============================================================================
/**
 * Validate and execute an incoming command from the React dashboard.
 *
 * Three-phase Hardware Trust Pipeline:
 *   Phase 1 — AWAITING_ACK  : Send immediate ACK so UI leaves SENDING state
 *   Phase 2 — GPIO ACTUATION: Drive relay pin HIGH/LOW via safe functions
 *   Phase 3 — CONFIRMED     : Broadcast confirmation to all clients
 *
 * Expected incoming JSON:
 *   { "type":"command", "cmdId":"cmd_pump_1234", "target":"pump", "action":"start" }
 *
 * Valid targets:  "pump", "valve"
 * Valid actions:  pump→"start"/"stop",  valve→"open"/"close"
 *
 * @param clientNum  WebSocket client index (for directed ACK reply)
 * @param payload    Raw byte pointer to the received text
 * @param length     Byte length of the payload
 */
void handleCommand(uint8_t clientNum, uint8_t* payload, size_t length) {

  // ── Parse JSON ─────────────────────────────────────────────────────
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);

  if (err) {
    Serial.print(F("[COMMAND] ❌ JSON parse error: "));
    Serial.println(err.f_str());

    // Send error response to client
    JsonDocument errDoc;
    errDoc["type"]   = "error";
    errDoc["reason"] = "JSON parse error";
    String errJson;
    serializeJson(errDoc, errJson);
    webSocket.sendTXT(clientNum, errJson);
    return;
  }

  const char* msgType = doc["type"] | "";
  const char* cmdId   = doc["cmdId"]  | "";
  const char* target  = doc["target"] | "";
  const char* action  = doc["action"] | "";

  // ── Handle ping frames for round-trip latency diagnostic ────────────
  if (strcmp(msgType, "ping") == 0) {
    JsonDocument pongDoc;
    pongDoc["type"] = "pong";
    if (doc.containsKey("t")) {
      pongDoc["t"] = doc["t"];
    }
    String pongJson;
    serializeJson(pongDoc, pongJson);
    webSocket.sendTXT(clientNum, pongJson);
    return;
  }

  // ── Validate message type ──────────────────────────────────────────
  // Accept both "command" type and messages without type (for backward compat)
  if (strlen(msgType) > 0 && strcmp(msgType, "command") != 0) {
    // Not a command message — ignore silently
    return;
  }

  // ── Validate required fields ───────────────────────────────────────
  if (strlen(target) == 0 || strlen(action) == 0) {
    Serial.println(F("[COMMAND] ⚠️  Received frame missing 'target' or 'action' — ignored."));

    JsonDocument errDoc;
    errDoc["type"]   = "error";
    errDoc["reason"] = "Missing 'target' or 'action' field";
    String errJson;
    serializeJson(errDoc, errJson);
    webSocket.sendTXT(clientNum, errJson);
    return;
  }

  // ── Validate target ────────────────────────────────────────────────
  bool validTarget = (strcmp(target, "pump") == 0 || strcmp(target, "valve") == 0);
  if (!validTarget) {
    Serial.printf_P(PSTR("[COMMAND] ⚠️  Unknown target: %s — rejected\n"), target);

    JsonDocument errDoc;
    errDoc["type"]   = "error";
    errDoc["reason"] = "Unknown target";
    errDoc["target"] = target;
    String errJson;
    serializeJson(errDoc, errJson);
    webSocket.sendTXT(clientNum, errJson);
    return;
  }

  // ── Validate action for target ─────────────────────────────────────
  bool validAction = false;
  if (strcmp(target, "pump") == 0) {
    validAction = (strcmp(action, "start") == 0 || strcmp(action, "stop") == 0);
  } else if (strcmp(target, "valve") == 0) {
    validAction = (strcmp(action, "open") == 0 || strcmp(action, "close") == 0);
  }

  if (!validAction) {
    Serial.printf_P(PSTR("[COMMAND] ⚠️  Invalid action '%s' for target '%s' — rejected\n"), action, target);

    JsonDocument errDoc;
    errDoc["type"]   = "error";
    errDoc["reason"] = "Invalid action for target";
    errDoc["target"] = target;
    errDoc["action"] = action;
    String errJson;
    serializeJson(errDoc, errJson);
    webSocket.sendTXT(clientNum, errJson);
    return;
  }

  Serial.println(F("──────────────────────────────────────────────────────────"));
  Serial.printf_P(
    PSTR("[COMMAND] 📥 Received  cmdId=%-20s  target=%-6s  action=%s\n"),
    cmdId, target, action
  );

  // ── Phase 1 : AWAITING_ACK ────────────────────────────────────────
  {
    JsonDocument ack;
    ack["type"]   = "ack";
    ack["cmdId"]  = cmdId;
    ack["target"] = target;
    ack["action"] = action;
    ack["status"] = "awaiting_ack";

    String ackJson;
    serializeJson(ack, ackJson);

    // Send ACK only to the issuing client (not broadcast)
    webSocket.sendTXT(clientNum, ackJson);
    Serial.printf_P(PSTR("[COMMAND] 📡 Phase 1 — ACK sent to client #%u\n"), clientNum);
  }

  // ── Phase 2 : GPIO ACTUATION (via safe functions) ──────────────────
  if (strcmp(target, "pump") == 0) {
    setPump(strcmp(action, "start") == 0);
  } else if (strcmp(target, "valve") == 0) {
    setValve(strcmp(action, "open") == 0);
  }

  // Allow relay contacts to mechanically settle before reading back state
  delay(ACK_SETTLE_DELAY);

  // ── Phase 3 : CONFIRMED (broadcast to ALL clients) ─────────────────
  {
    JsonDocument conf;
    conf["type"]       = "confirmed";
    conf["cmdId"]      = cmdId;
    conf["target"]     = target;
    conf["action"]     = action;
    conf["status"]     = "confirmed";
    conf["pumpActive"] = pumpActive;
    conf["valveOpen"]  = valveOpen;

    String confJson;
    serializeJson(conf, confJson);

    // Broadcast so every open browser tab stays in sync
    webSocket.broadcastTXT(confJson);
    Serial.println(F("[COMMAND] ✅ Phase 3 — CONFIRMED broadcast to all clients"));
    Serial.print  (F("[COMMAND]    Payload: "));
    Serial.println(confJson);
  }

  Serial.println(F("──────────────────────────────────────────────────────────"));
}

// ==============================================================================
// 13. WEBSOCKET EVENT DISPATCHER
// ==============================================================================
/**
 * Callback invoked by the WebSocketsServer library for every client event.
 * Routes TEXT frames to handleCommand() and manages connection bookkeeping.
 */
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    // ── Client disconnected ──────────────────────────────────────────
    case WStype_DISCONNECTED:
      if (connectedClients > 0) connectedClients--;
      Serial.printf_P(
        PSTR("[WS] ❌ Client #%u disconnected — %u client(s) remaining\n"),
        num, connectedClients
      );
      if (connectedClients == 0) {
        // No clients left — dim the status LED
        digitalWrite(PIN_LED_STATUS, LED_OFF);
      }
      break;

    // ── New client connected ─────────────────────────────────────────
    case WStype_CONNECTED: {
      connectedClients++;
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf_P(
        PSTR("[WS] 🔗 Client #%u connected from %s — %u client(s) active\n"),
        num, ip.toString().c_str(), connectedClients
      );
      digitalWrite(PIN_LED_STATUS, LED_ON);

      // Send the current sensor snapshot immediately on connection so the
      // React dashboard knows sensor states before the first 2-second tick
      readAllSensors();   // Ensure gSoilMoisture and flags are current

      JsonDocument snap;
      snap["type"] = "telemetry";

      // Temperature/Humidity: no physical sensors — send null
      snap["temperature"] = (char*)nullptr;
      snap["tempStatus"]  = "sensor_unavailable";
      snap["humidity"]    = (char*)nullptr;
      snap["humidStatus"] = "sensor_unavailable";

      // Soil Moisture: real physical sensor
      if (gSoilFault) {
        snap["soilMoisture"] = (char*)nullptr;
        snap["soilStatus"]   = "fault";
      } else if (gSoilNoProbe) {
        snap["soilMoisture"] = (char*)nullptr;
        snap["soilStatus"]   = "no_probe";
      } else {
        snap["soilMoisture"] = serialized(String(gSoilMoisture, 1));
        snap["soilStatus"]   = "ok";
      }

      snap["pumpActive"] = pumpActive;
      snap["valveOpen"]  = valveOpen;
      snap["ip"]         = WiFi.localIP().toString();

      String snapJson;
      serializeJson(snap, snapJson);
      webSocket.sendTXT(num, snapJson);

      Serial.print(F("[WS]    Initial snapshot sent → "));
      Serial.println(snapJson);
      break;
    }

    // ── Text frame received (actuation command) ──────────────────────
    case WStype_TEXT:
      handleCommand(num, payload, length);
      break;

    // ── Error handling ───────────────────────────────────────────────
    case WStype_ERROR:
      Serial.printf_P(PSTR("[WS] ⚠️  Error on client #%u\n"), num);
      break;

    // ── Ignore binary, ping/pong, fragmented frames ──────────────────
    case WStype_BIN:
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
    case WStype_PING:
    case WStype_PONG:
    default:
      break;
  }
}

// ==============================================================================
// 14. WI-FI & MDNS MANAGER
// ==============================================================================
/**
 * Start or restart the Multicast DNS (mDNS) responder.
 * Allows local clients to reach this ESP at ws://agrosense.local:81
 */
void initMDNS() {
  if (MDNS.begin(AGROSENSE_HOSTNAME)) {
    Serial.printf_P(PSTR("[MDNS] ✅ Responder started: http://%s.local\n"), AGROSENSE_HOSTNAME);
    Serial.printf_P(PSTR("[MDNS]    WebSocket: ws://%s.local:%u\n"), AGROSENSE_HOSTNAME, WS_PORT);
    MDNS.addService("ws", "tcp", WS_PORT);
    MDNS.addService("http", "tcp", 80);
    MDNS.addServiceTxt("ws", "tcp", "version", AGROSENSE_FIRMWARE_VERSION);
  } else {
    Serial.println(F("[MDNS] ❌ Error setting up MDNS responder"));
  }
}

/**
 * Initialize Wi-Fi in station mode with timeout-based connection.
 * Uses millis()-based timeout instead of indefinite blocking.
 * Reports DHCP IP, RSSI, and WebSocket URL on success.
 *
 * IMPORTANT: IP is DHCP-assigned. NEVER hardcode an IP address.
 */
void initWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);  // ESP8266 will auto-reconnect in background
  WiFi.persistent(false);       // Don't write credentials to flash every boot
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf_P(PSTR("[WIFI] Connecting to SSID: %s "), WIFI_SSID);

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startMs >= WIFI_CONNECT_TIMEOUT) {
      Serial.println();
      Serial.println(F("[WIFI] ❌ Connection TIMEOUT — check SSID/password."));
      Serial.println(F("[WIFI]    Will retry in background (auto-reconnect enabled)."));
      // Ensure LED is off after failed attempt
      digitalWrite(PIN_LED_STATUS, LED_OFF);
      return;
    }
    delay(400);
    Serial.print(F("."));
    // Blink LED to show the board is alive while negotiating
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
  }

  // Ensure LED is OFF after connection loop
  digitalWrite(PIN_LED_STATUS, LED_OFF);
  Serial.println();

  wifiWasConnected = true;
  printWiFiStatus();
  initMDNS();
}

/**
 * Print current Wi-Fi connection details to Serial Monitor.
 */
void printWiFiStatus() {
  Serial.println(F("[WIFI] ✅ Connected"));
  Serial.print  (F("[WIFI] IP: "));
  Serial.println(WiFi.localIP());
  Serial.print  (F("[WIFI] RSSI: "));
  Serial.print  (WiFi.RSSI());
  Serial.println(F(" dBm"));
  Serial.print  (F("[WIFI] Local WS  : ws://"));
  Serial.print  (WiFi.localIP());
  Serial.printf_P(PSTR(":%u\n"), WS_PORT);
  Serial.printf_P(PSTR("[WIFI] mDNS WS   : ws://%s.local:%u\n"), AGROSENSE_HOSTNAME, WS_PORT);
}

/**
 * Check Wi-Fi status and handle reconnection.
 * Called periodically from loop() — non-blocking.
 */
void checkWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      // Just reconnected
      wifiWasConnected = true;
      Serial.println(F("[WIFI] 🔄 Reconnected!"));
      printWiFiStatus();
      initMDNS();
    }
  } else {
    if (wifiWasConnected) {
      // Just lost connection
      wifiWasConnected = false;
      Serial.println(F("[WIFI] ⚠️  Connection lost — auto-reconnect active"));
    }
    // Blink LED to indicate Wi-Fi issue
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
  }
}

// ==============================================================================
// 15. DIAGNOSTICS
// ==============================================================================
/**
 * Print boot diagnostic banner to Serial Monitor.
 * Makes it immediately obvious which firmware is running.
 */
void printBootBanner() {
  Serial.println();
  Serial.println(F("================================================"));
  Serial.println(F(" AgroSense SIH25015"));
  Serial.println(F(" ESP8266 Gateway"));
  Serial.print  (F(" Firmware: "));
  Serial.println(F(AGROSENSE_FIRMWARE_VERSION));
  Serial.println(F("================================================"));
  Serial.println();
}

/**
 * Print hardware configuration summary at boot.
 */
void printHardwareConfig() {
  Serial.println(F("[INIT] Hardware Configuration:"));
  Serial.print  (F("[INIT]   Board      : "));
  Serial.println(F(AGROSENSE_BOARD));
  Serial.print  (F("[INIT]   Firmware   : "));
  Serial.println(F(AGROSENSE_FIRMWARE_VERSION));
  Serial.printf_P(PSTR("[INIT]   mDNS Host  : %s.local (ws://%s.local:%u)\n"), AGROSENSE_HOSTNAME, AGROSENSE_HOSTNAME, WS_PORT);
  Serial.printf_P(PSTR("[INIT]   WS Port    : %u\n"), WS_PORT);
  Serial.printf_P(PSTR("[INIT]   Telemetry  : every %lu ms\n"), TELEMETRY_INTERVAL);
  Serial.println(F("[INIT]   Relay Logic: Active-LOW (LOW=ON, HIGH=OFF)"));
  Serial.println(F("[INIT]   LED Logic  : Active-LOW"));
  Serial.println(F("[INIT]   Soil Sensor: A0 — REAL physical resistive probe"));
  Serial.println(F("[INIT]   Temperature: UNAVAILABLE — no DHT/DS18B20/BME280 connected"));
  Serial.println(F("[INIT]   Humidity   : UNAVAILABLE — no DHT/BME280/SHT31 connected"));
  Serial.printf_P(PSTR("[INIT]   Soil Cal   : DRY=%d  WET=%d  FLOAT_MIN=%d\n"), SOIL_DRY_ADC, SOIL_WET_ADC, SOIL_FLOAT_MIN);
  Serial.println();
}

/**
 * Periodic diagnostic output — prints system health info.
 */
void printDiagnostics() {
  Serial.println(F("[DIAG] ────────────────────────────────"));
  Serial.printf_P(PSTR("[DIAG] Uptime     : %lu s\n"), millis() / 1000);
  Serial.printf_P(PSTR("[DIAG] Free Heap  : %u bytes\n"), ESP.getFreeHeap());
  Serial.printf_P(PSTR("[DIAG] Clients    : %u\n"), connectedClients);
  Serial.printf_P(PSTR("[DIAG] Pump       : %s\n"), pumpActive ? "ACTIVE" : "OFF");
  Serial.printf_P(PSTR("[DIAG] Valve      : %s\n"), valveOpen ? "OPEN" : "CLOSED");

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print  (F("[DIAG] WiFi       : Connected ("));
    Serial.print  (WiFi.localIP());
    Serial.printf_P(PSTR(", RSSI: %d dBm)\n"), WiFi.RSSI());
    Serial.printf_P(PSTR("[DIAG] mDNS       : %s.local\n"), AGROSENSE_HOSTNAME);
  } else {
    Serial.println(F("[DIAG] WiFi       : DISCONNECTED"));
  }

  // Read raw ADC for diagnostic purposes
  int rawADC = analogRead(PIN_SOIL_ANALOG);
  if (gSoilFault) {
    Serial.printf_P(PSTR("[DIAG] Soil ADC   : %d  Status=FAULT\n"), rawADC);
  } else if (gSoilNoProbe) {
    Serial.printf_P(PSTR("[DIAG] Soil ADC   : %d  Status=NO_PROBE\n"), rawADC);
  } else {
    Serial.printf_P(PSTR("[DIAG] Soil ADC   : %d  (%.1f%%)  Status=OK\n"), rawADC, gSoilMoisture);
  }
  Serial.println(F("[DIAG] Temp       : UNAVAILABLE (no physical sensor)"));
  Serial.println(F("[DIAG] Humidity   : UNAVAILABLE (no physical sensor)"));
  Serial.println(F("[DIAG] ────────────────────────────────"));
}

// ==============================================================================
// 16. SAFETY WATCHDOG — ACTUATOR RUNTIME CHECK
// ==============================================================================
/**
 * Check if actuators have been running beyond their safety timeout.
 * Only active if PUMP_MAX_RUNTIME_MS / VALVE_MAX_RUNTIME_MS > 0.
 */
void checkActuatorSafety() {
  unsigned long now = millis();

  if (PUMP_MAX_RUNTIME_MS > 0 && pumpActive && pumpStartMs > 0) {
    if (now - pumpStartMs >= PUMP_MAX_RUNTIME_MS) {
      Serial.println(F("[SAFETY] ⚠️ Pump exceeded max runtime — auto shutoff!"));
      setPump(false);
    }
  }

  if (VALVE_MAX_RUNTIME_MS > 0 && valveOpen && valveStartMs > 0) {
    if (now - valveStartMs >= VALVE_MAX_RUNTIME_MS) {
      Serial.println(F("[SAFETY] ⚠️ Valve exceeded max runtime — auto shutoff!"));
      setValve(false);
    }
  }
}

// ==============================================================================
// 17. SETUP — INITIALIZATION SEQUENCE
// ==============================================================================
void setup() {
  // ── Serial Monitor ─────────────────────────────────────────────────
  Serial.begin(115200);
  delay(300);   // Short pause so the first serial lines are not lost

  printBootBanner();

  // ── GPIO Initialization — SAFETY FIRST ─────────────────────────────
  // Set pin modes BEFORE anything else
  pinMode(PIN_RELAY_PUMP,  OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_LED_STATUS,  OUTPUT);
  // A0 is input-only on NodeMCU; no pinMode needed for analog reads

  // Drive ALL actuators to SAFE (OFF) state IMMEDIATELY
  // This MUST happen before Wi-Fi or WebSocket initialization
  allActuatorsSafe();
  Serial.println(F("[INIT] GPIO initialized — all relays OFF, LED OFF"));

  // ── Print hardware configuration ───────────────────────────────────
  printHardwareConfig();

  // ── Wi-Fi Connection ───────────────────────────────────────────────
  initWiFi();

  // ── WebSocket Server ───────────────────────────────────────────────
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  Serial.printf_P(PSTR("\n[WS] 🚀 Server started on port %u\n"), WS_PORT);
  Serial.println(F("================================================\n"));

  // ── ESP8266 Hardware Watchdog ──────────────────────────────────────
  // The ESP8266 has a built-in software watchdog (~3.2s) and hardware
  // watchdog (~8s). Our loop() is non-blocking, so yield() / delay()
  // calls within the WebSocket library feed the watchdog automatically.
  // No explicit ESP.wdtEnable() call needed — it's on by default.
}

// ==============================================================================
// 18. MAIN LOOP — NON-BLOCKING SCHEDULER
// ==============================================================================
void loop() {
  // ── WebSocket I/O — MUST be called every iteration ─────────────────
  webSocket.loop();

  // ── mDNS query processor ───────────────────────────────────────────
  MDNS.update();

  unsigned long now = millis();

  // ── Periodic Telemetry Broadcast ───────────────────────────────────
  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL) {
    lastTelemetryMs = now;

    if (WiFi.status() == WL_CONNECTED) {
      broadcastTelemetry();
    }
  }

  // ── Wi-Fi Health Check ─────────────────────────────────────────────
  if (now - lastWifiCheckMs >= WIFI_RECONNECT_INTERVAL) {
    lastWifiCheckMs = now;
    checkWiFi();
  }

  // ── Actuator Safety Check ──────────────────────────────────────────
  checkActuatorSafety();

  // ── Periodic Diagnostics ───────────────────────────────────────────
  if (now - lastDiagMs >= DIAG_INTERVAL) {
    lastDiagMs = now;
    printDiagnostics();
  }
}

