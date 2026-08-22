// ─── Connection & Hardware ─────────────────────────────────────
export type ConnectionStatus =
  | "CONNECTING"   // actively negotiating the TCP/WebSocket handshake
  | "CONNECTED"    // open and receiving telemetry frames
  | "DISCONNECTED" // deliberately closed or hardware went offline
  | "ERROR";       // socket errored before or after being open
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
export interface TelemetryDataPoint {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  timestamp: Date;
}

/** Shape of a single telemetry payload emitted over the WebSocket. */
export interface TelemetryPayload {
  temperature: number;
  humidity: number;
  soilMoisture: number;
}

// ─── AI Inference ──────────────────────────────────────────────

export type InferenceStatus =
  | "idle"
  | "awaiting_permission"
  | "initializing"
  | "analyzing"
  | "active"
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
