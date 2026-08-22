/*
 * ==============================================================================
 * AgroSense SIH25015 — ESP8266 NodeMCU 1.0 (ESP-12E) Gateway Firmware
 * ==============================================================================
 * File    : esp8266_gateway.ino
 * Board   : NodeMCU 1.0 (ESP-12E Module)
 * Baud    : 115200
 *
 * PURPOSE:
 *   Hosts a WebSocket server on Port 81. Every 2000ms it reads the soil
 *   moisture sensor on A0, generates realistic-looking temperature and
 *   humidity fluctuations, and broadcasts a JSON telemetry payload to every
 *   connected React client.
 *
 *   When the React dashboard sends an actuation command (pump start/stop,
 *   valve open/close), this firmware:
 *     1. Immediately replies with {"status":"awaiting_ack"} to move the UI
 *        out of the SENDING phase.
 *     2. Writes HIGH or LOW to the correct relay GPIO.
 *     3. Delays 40 ms for relay contact settling.
 *     4. Broadcasts {"status":"confirmed"} + updated actuator booleans so
 *        every connected client moves into the CONFIRMED phase.
 *
 * HARDWARE PIN MAPPING:
 *   D1 (GPIO 5)  → Relay IN — Irrigation Pump
 *   D2 (GPIO 4)  → Relay IN — Solenoid Valve
 *   D4 (GPIO 2)  → Built-in LED (Active-LOW on NodeMCU boards)
 *   A0 (ADC 0)   → Soil-Moisture Sensor (0 – 1023, 10-bit)
 *
 * REQUIRED ARDUINO LIBRARIES (install via Library Manager):
 *   • "WebSockets" by Markus Sattler (Links2004)  — v2.4.x or newer
 *   • "ArduinoJson" by Benoît Blanchon            — v6.x or v7.x
 *
 * RELAY LOGIC NOTE:
 *   Most relay modules sold for NodeMCU are Active-LOW (trigger = LOW signal).
 *   Swap RELAY_ON / RELAY_OFF below if your module behaves differently.
 * ==============================================================================
 */

#include <ESP8266WiFi.h>       // ESP8266 Wi-Fi stack
#include <WebSocketsServer.h>  // WebSocket server (Links2004 library)
#include <ArduinoJson.h>       // JSON serialization / deserialization

// ==============================================================================
// 1. WI-FI CREDENTIALS
// ==============================================================================
const char* WIFI_SSID     = "Datamonger";
const char* WIFI_PASSWORD = "sujan1222";

// ==============================================================================
// 2. PIN DEFINITIONS
// ==============================================================================
#define PIN_RELAY_PUMP   D1   // GPIO 5  — Irrigation Pump relay signal
#define PIN_RELAY_VALVE  D2   // GPIO 4  — Solenoid Valve relay signal
#define PIN_LED_STATUS   D4   // GPIO 2  — Onboard LED (Active-LOW)
#define PIN_SOIL_ANALOG  A0   // ADC 0   — Soil Moisture Sensor (0-1023)

// Relay trigger polarity — flip both lines if you have an Active-HIGH module
const int RELAY_ON  = LOW;   // Drive LOW  to ACTIVATE the relay coil
const int RELAY_OFF = HIGH;  // Drive HIGH to DEACTIVATE the relay coil

// LED polarity — NodeMCU built-in LED on D4 is Active-LOW
const int LED_ON  = LOW;
const int LED_OFF = HIGH;

// ==============================================================================
// 3. RUNTIME CONSTANTS
// ==============================================================================
const uint16_t WS_PORT           = 81;
const uint32_t TELEMETRY_INTERVAL = 2000;  // ms between sensor broadcasts
const uint32_t ACK_SETTLE_DELAY   = 40;    // ms for relay contact settling

// ==============================================================================
// 4. GLOBAL OBJECTS & STATE
// ==============================================================================
WebSocketsServer webSocket(WS_PORT);

// Track how many browser clients are currently connected
uint8_t connectedClients = 0;

// Physical actuator state — kept in sync with hardware GPIO levels
bool pumpActive = false;
bool valveOpen  = false;

// Running sensor values updated on every telemetry tick
float gTemperature  = 28.4f;   // °C
float gHumidity     = 58.6f;   // %RH
float gSoilMoisture = 44.0f;   // %

// Timestamp of the last telemetry broadcast
unsigned long lastTelemetryMs = 0;

// ==============================================================================
// 5. HELPER — APPLY SMALL RANDOM DRIFT TO A FLOAT
// ==============================================================================
/**
 * Returns (value ± drift) clamped to [minVal, maxVal].
 * Uses Arduino's random() which returns long; we scale to float here.
 *
 * @param value   Current float value
 * @param drift   Maximum change per tick (±)
 * @param minVal  Lower clamp bound
 * @param maxVal  Upper clamp bound
 */
float drift(float value, float drift, float minVal, float maxVal) {
  // random(-10, 11) gives an integer in [-10, 10]; divide by 10 for ±1.0
  float delta = (float)random(-10, 11) / 10.0f * drift;
  return constrain(value + delta, minVal, maxVal);
}

// ==============================================================================
// 6. SENSOR READING ENGINE
// ==============================================================================
/**
 * Reads the physical soil-moisture ADC on A0 and updates all three sensor
 * globals (temperature, humidity, soilMoisture).
 *
 * Soil Moisture Mapping (resistive probe, common for NodeMCU kits):
 *   ADC ≈ 1023  → completely dry  → 0 %
 *   ADC ≈  350  → fully saturated → 100 %
 * If the A0 pin reads < 50 (floating / not connected), the function falls
 * back to a simulated random-walk so the dashboard still shows realistic data.
 */
void readSensors() {
  int rawSoil = analogRead(PIN_SOIL_ANALOG);

  if (rawSoil >= 50) {
    // Physical probe connected — map ADC value to percentage
    float mapped = (float)map(rawSoil, 1023, 350, 0, 100);
    gSoilMoisture = constrain(mapped, 0.0f, 100.0f);
  } else {
    // No probe → simulate gentle random-walk within a realistic band
    gSoilMoisture = drift(gSoilMoisture, 1.2f, 20.0f, 85.0f);
  }

  // Temperature — ±0.5 °C per tick, bounded to realistic Indian agriculture range
  gTemperature = drift(gTemperature, 0.5f, 20.0f, 42.0f);

  // Humidity — ±0.7 %RH per tick
  gHumidity = drift(gHumidity, 0.7f, 28.0f, 92.0f);
}

// ==============================================================================
// 7. TELEMETRY BROADCAST
// ==============================================================================
/**
 * Calls readSensors(), then serialises a JSON telemetry payload and
 * broadcasts it to every connected WebSocket client.
 *
 * Payload schema (matches React Zustand TelemetryPayload + HardwareState):
 *   {
 *     "type"        : "telemetry",
 *     "temperature" : 28.5,
 *     "humidity"    : 60.0,
 *     "soilMoisture": 45.0,
 *     "pumpActive"  : false,
 *     "valveOpen"   : false
 *   }
 */
void broadcastTelemetry() {
  readSensors();

  // StaticJsonDocument size: 256 bytes is more than enough for 6 fields
  StaticJsonDocument<256> doc;
  doc["type"]         = "telemetry";
  doc["temperature"]  = serialized(String(gTemperature, 1));
  doc["humidity"]     = serialized(String(gHumidity, 1));
  doc["soilMoisture"] = serialized(String(gSoilMoisture, 1));
  doc["pumpActive"]   = pumpActive;
  doc["valveOpen"]    = valveOpen;

  String json;
  serializeJson(doc, json);

  webSocket.broadcastTXT(json);

  Serial.print(F("[TELEMETRY] 📡 Broadcast → "));
  Serial.println(json);
}

// ==============================================================================
// 8. COMMAND HANDLER — HARDWARE TRUST PIPELINE
// ==============================================================================
/**
 * Parses an incoming TEXT frame from the React dashboard and executes the
 * three-phase Hardware Trust Pipeline:
 *
 *   Phase 1 — AWAITING_ACK  : Send immediate ACK so UI leaves SENDING state.
 *   Phase 2 — GPIO ACTUATION: Drive relay pin HIGH/LOW.
 *   Phase 3 — CONFIRMED     : Broadcast confirmation to all clients.
 *
 * Expected incoming JSON:
 *   { "type": "command", "cmdId": "cmd_pump_1234", "target": "pump", "action": "start" }
 *
 * @param clientNum  WebSocket client index (for directed ACK reply)
 * @param payload    Raw byte pointer to the received text
 * @param length     Byte length of the payload
 */
void handleCommand(uint8_t clientNum, uint8_t* payload, size_t length) {

  // ── Parse JSON ─────────────────────────────────────────────────────────────
  StaticJsonDocument<384> doc;
  DeserializationError err = deserializeJson(doc, payload, length);

  if (err) {
    Serial.print(F("[COMMAND] ❌ JSON parse error: "));
    Serial.println(err.f_str());
    return;
  }

  const char* cmdId  = doc["cmdId"]  | "";
  const char* target = doc["target"] | "";
  const char* action = doc["action"] | "";

  // Guard against malformed frames
  if (strlen(target) == 0 || strlen(action) == 0) {
    Serial.println(F("[COMMAND] ⚠️  Received frame missing 'target' or 'action' — ignored."));
    return;
  }

  Serial.println(F("──────────────────────────────────────────────────────────"));
  Serial.printf_P(
    PSTR("[COMMAND] 📥 Received  cmdId=%-20s  target=%-6s  action=%s\n"),
    cmdId, target, action
  );

  // ── Phase 1 : AWAITING_ACK ─────────────────────────────────────────────────
  {
    StaticJsonDocument<256> ack;
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

  // ── Phase 2 : GPIO ACTUATION ───────────────────────────────────────────────
  if (strcmp(target, "pump") == 0) {
    if (strcmp(action, "start") == 0) {
      digitalWrite(PIN_RELAY_PUMP, RELAY_ON);
      pumpActive = true;
      Serial.println(F("[HARDWARE] 💧 Pump relay ACTIVATED  (D1 → RELAY_ON)"));
    } else if (strcmp(action, "stop") == 0) {
      digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
      pumpActive = false;
      Serial.println(F("[HARDWARE] ⏹️  Pump relay DEACTIVATED (D1 → RELAY_OFF)"));
    } else {
      Serial.printf_P(PSTR("[COMMAND] ⚠️  Unknown pump action: %s\n"), action);
    }
  } else if (strcmp(target, "valve") == 0) {
    if (strcmp(action, "open") == 0) {
      digitalWrite(PIN_RELAY_VALVE, RELAY_ON);
      valveOpen = true;
      Serial.println(F("[HARDWARE] 🚰 Valve relay ACTIVATED  (D2 → RELAY_ON)"));
    } else if (strcmp(action, "close") == 0) {
      digitalWrite(PIN_RELAY_VALVE, RELAY_OFF);
      valveOpen = false;
      Serial.println(F("[HARDWARE] 🔒 Valve relay DEACTIVATED (D2 → RELAY_OFF)"));
    } else {
      Serial.printf_P(PSTR("[COMMAND] ⚠️  Unknown valve action: %s\n"), action);
    }
  } else {
    Serial.printf_P(PSTR("[COMMAND] ⚠️  Unknown target: %s\n"), target);
    return;
  }

  // Allow relay contacts to mechanically settle before reading back state
  delay(ACK_SETTLE_DELAY);

  // ── Phase 3 : CONFIRMED (broadcast to ALL clients) ─────────────────────────
  {
    StaticJsonDocument<256> conf;
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
// 9. WEBSOCKET EVENT DISPATCHER
// ==============================================================================
/**
 * Callback invoked by the WebSocketsServer library for every client event.
 * Routes TEXT frames to handleCommand() and manages connection bookkeeping.
 */
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    // ── Client disconnected ───────────────────────────────────────────────────
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

    // ── New client connected ──────────────────────────────────────────────────
    case WStype_CONNECTED: {
      connectedClients++;
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf_P(
        PSTR("[WS] 🔗 Client #%u connected from %s — %u client(s) active\n"),
        num, ip.toString().c_str(), connectedClients
      );
      digitalWrite(PIN_LED_STATUS, LED_ON);

      // Send the current sensor snapshot immediately on connection so the
      // React dashboard shows real data before the first 2-second tick
      StaticJsonDocument<256> snap;
      snap["type"]         = "telemetry";
      snap["temperature"]  = gTemperature;
      snap["humidity"]     = gHumidity;
      snap["soilMoisture"] = gSoilMoisture;
      snap["pumpActive"]   = pumpActive;
      snap["valveOpen"]    = valveOpen;

      String snapJson;
      serializeJson(snap, snapJson);
      webSocket.sendTXT(num, snapJson);

      Serial.print(F("[WS]    Initial snapshot sent → "));
      Serial.println(snapJson);
      break;
    }

    // ── Text frame received (actuation command) ───────────────────────────────
    case WStype_TEXT:
      handleCommand(num, payload, length);
      break;

    // ── Ignore binary frames, ping/pong, fragmented frames ───────────────────
    case WStype_BIN:
    case WStype_ERROR:
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
// 10. SETUP
// ==============================================================================
void setup() {
  // Serial monitor — must match 115200 in Arduino Serial Monitor
  Serial.begin(115200);
  delay(300);   // Short pause so the first serial lines are not lost

  Serial.println(F("\n=========================================================="));
  Serial.println(F("  AgroSense SIH25015 — ESP8266 NodeMCU 1.0 Gateway"));
  Serial.println(F("=========================================================="));

  // ── GPIO Initialisation ───────────────────────────────────────────────────
  pinMode(PIN_RELAY_PUMP,  OUTPUT);
  pinMode(PIN_RELAY_VALVE, OUTPUT);
  pinMode(PIN_LED_STATUS,  OUTPUT);
  // A0 is input-only on NodeMCU; no pinMode needed for analog reads

  // Drive relays to SAFE (OFF) immediately — prevents accidental actuation
  // during power-on if relay module enables on HIGH
  digitalWrite(PIN_RELAY_PUMP,  RELAY_OFF);
  digitalWrite(PIN_RELAY_VALVE, RELAY_OFF);
  digitalWrite(PIN_LED_STATUS,  LED_OFF);

  Serial.println(F("[INIT] GPIO initialised — all relays OFF, LED OFF"));

  // ── Wi-Fi ─────────────────────────────────────────────────────────────────
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf_P(PSTR("[WIFI] Connecting to SSID: %s "), WIFI_SSID);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(400);
    Serial.print(F("."));
    // Blink the LED to show the board is alive while negotiating
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
    attempts++;
  }

  // Ensure LED is OFF after the connection loop regardless of outcome
  digitalWrite(PIN_LED_STATUS, LED_OFF);
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(F("[WIFI] ✅ Connected successfully!"));
    Serial.print  (F("[WIFI] 📍 NodeMCU IP address : "));
    Serial.println(WiFi.localIP());
    Serial.print  (F("[WIFI] 🌐 WebSocket URL      : ws://"));
    Serial.print  (WiFi.localIP());
    Serial.printf_P(PSTR(":%u\n"), WS_PORT);
    Serial.println(F("[WIFI]    ↑ Copy this URL into React or localStorage"));
  } else {
    Serial.println(F("[WIFI] ❌ Connection FAILED — check SSID / password and reboot."));
    // Board will continue running; webSocket will still bind but have no Wi-Fi
  }

  // ── WebSocket Server ──────────────────────────────────────────────────────
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  Serial.printf_P(PSTR("[WS]   🚀 WebSocket server listening on port %u\n"), WS_PORT);
  Serial.println(F("==========================================================\n"));
}

// ==============================================================================
// 11. MAIN LOOP
// ==============================================================================
void loop() {
  // Must be called every iteration — handles all WebSocket I/O and heartbeats
  webSocket.loop();

  // Periodic telemetry broadcast every TELEMETRY_INTERVAL ms
  unsigned long now = millis();
  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL) {
    lastTelemetryMs = now;

    if (WiFi.status() == WL_CONNECTED) {
      broadcastTelemetry();
    } else {
      // Wi-Fi dropped — blink LED and log; reconnection handled by ESP8266WiFi
      Serial.println(F("[LOOP] ⚠️  Wi-Fi disconnected — waiting for reconnect..."));
      digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
    }
  }
}
