// ─── Connection & Hardware ─────────────────────────────────────
export type ConnectionStatus =
  | "CONNECTING"   // actively negotiating the TCP/WebSocket handshake
  | "CONNECTED"    // open and receiving telemetry frames
  | "DISCONNECTED" // deliberately closed or hardware went offline
  | "ERROR";       // socket errored before or after being open

export type ConnectionMode = "LOCAL ESP" | "CLOUDFLARE" | "DISCONNECTED";

export type ModelStatus = "idle" | "loading" | "ready" | "error";
export type DeviceStatus = "online" | "offline";

export interface Device {
  id: string;
  name: string;
  type: string;
  status: DeviceStatus;
  lastSeen: Date;
}

// ─── Telemetry ─────────────────────────────────────────────────

/** Sensor status strings sent by the ESP firmware */
export type SensorStatus =
  | "ok"                  // Physical sensor read successfully
  | "fault"               // ADC or hardware fault
  | "no_probe"            // Probe not connected (floating input)
  | "sensor_unavailable"; // No physical sensor wired to this pin

export interface TelemetryDataPoint {
  /** Degrees Celsius from physical DHT sensor — null if no sensor */
  temperature: number | null;
  /** % Relative Humidity from physical DHT sensor — null if no sensor */
  humidity: number | null;
  /** % Soil moisture from physical resistive probe on A0 — null on fault */
  soilMoisture: number | null;
  tempStatus?:  SensorStatus;
  humidStatus?: SensorStatus;
  soilStatus?:  SensorStatus;
  timestamp: Date;
  ip?: string;
}

/** Shape of a single telemetry payload emitted over the WebSocket. */
export interface TelemetryPayload {
  /** null = no physical sensor connected */
  temperature: number | null;
  /** null = no physical sensor connected */
  humidity: number | null;
  /** null = sensor fault or probe disconnected */
  soilMoisture: number | null;
  tempStatus?:  SensorStatus;
  humidStatus?: SensorStatus;
  soilStatus?:  SensorStatus;
  ip?: string;
}

// ─── AI Inference ──────────────────────────────────────────────

export type InferenceStatus =
  | "idle"
  | "ready"
  | "awaiting_permission"
  | "capturing"
  | "analyzing"
  | "active"
  | "success"
  | "no_plant"
  | "unknown"
  | "error"
  | "permission_denied";

export interface BoundingBox {
  x: number; // 0-1 normalized
  y: number;
  width: number;
  height: number;
}

export interface DiagnosisResult {
  label: string;
  confidence: number; // 0-1
  isAnomaly: boolean;
  boundingBox: BoundingBox | null;
  timestamp: Date;
  // Canonical Phase 10 fields:
  provider?: "gemini" | "onnx";
  plantSpecies?: string | null;
  diseaseClassId?: number | null;
  diseaseClass?: string;
  scientificName?: string | null;
  severity?: "none" | "mild" | "moderate" | "severe" | "unknown";
  visualEvidence?: string;
  recommendation?: string;
  latencyMs?: number;
  plantDetected?: boolean;
  leafDetected?: boolean;
}

/** Severity level derived from the diagnosis */
export type DiagnosisSeverity = "healthy" | "warning" | "critical";

// ─── Hardware Command Pipeline ─────────────────────────────────

/**
 * Lifecycle of a hardware command:
 *
 *  USER INTENT
 *       ↓
 *  SENDING        — command dispatched to controller
 *       ↓
 *  AWAITING_ACK   — waiting for controller acknowledgement
 *       ↓
 *  CONFIRMED      — controller confirmed execution
 *       ↓
 *  (or) FAILED    — controller rejected / timed out
 */
export type HardwareCommandStatus =
  | "idle"
  | "sending"
  | "awaiting_ack"
  | "confirmed"
  | "failed"
  | "timeout";

export type HardwareCommandTarget = "pump" | "valve";
export type HardwareCommandAction = "start" | "stop" | "open" | "close";

export interface HardwareCommand {
  id: string;
  target: HardwareCommandTarget;
  action: HardwareCommandAction;
  status: HardwareCommandStatus;
  issuedAt: Date;
  acknowledgedAt: Date | null;
  confirmedAt: Date | null;
  failureReason: string | null;
}
