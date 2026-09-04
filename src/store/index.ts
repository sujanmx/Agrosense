import { create } from "zustand";
import { throttlePerSecond } from "@/lib/throttle";
import type {
  ConnectionMode,
  ConnectionStatus,
  Device,
  DiagnosisResult,
  HardwareCommand,
  HardwareCommandAction,
  HardwareCommandTarget,
  InferenceStatus,
  ModelStatus,
  SensorStatus,
  TelemetryDataPoint,
  TelemetryPayload,
} from "@/types";

// ────────────────────────────────────────────────────────────────
// Slice interfaces
// ────────────────────────────────────────────────────────────────

export interface AiState {
  modelStatus: ModelStatus;
  inferenceStatus: InferenceStatus;
  currentDiagnosis: DiagnosisResult | null;
  diagnosisHistory: DiagnosisResult[];
  lastPrediction: string | null;
  confidence: number;
  anomalyDetected: boolean;
  inferenceCount: number;
  renderCount: number;
  setModelStatus: (status: ModelStatus) => void;
  setInferenceStatus: (status: InferenceStatus) => void;
  setPrediction: (prediction: string | null, confidence: number) => void;
  setAnomalyDetected: (detected: boolean) => void;
  setDiagnosis: (result: DiagnosisResult) => void;
  incrementInferenceCount: () => void;
  resetInference: () => void;
}

export interface TelemetryState {
  /** null = no physical sensor or not yet received */
  temperature: number | null;
  /** null = no physical sensor or not yet received */
  humidity: number | null;
  /** null = sensor fault, probe disconnected, or not yet received */
  soilMoisture: number | null;
  /** Status strings from ESP firmware */
  tempStatus:  SensorStatus | null;
  humidStatus: SensorStatus | null;
  soilStatus:  SensorStatus | null;
  lastUpdated: Date | null;
  history: TelemetryDataPoint[];
  updateTelemetry: (data: TelemetryPayload) => void;
}

export interface HardwareState {
  connectionStatus: ConnectionStatus;
  connectionMode: ConnectionMode;
  espIp: string | null;
  latencyMs: number | null;
  devices: Device[];
  pumpActive: boolean;
  valveOpen: boolean;
  pendingCommands: Record<HardwareCommandTarget, HardwareCommand | null>;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setEspIp: (ip: string | null) => void;
  setLatencyMs: (ms: number | null) => void;
  setPumpActive: (active: boolean) => void;
  setValveOpen: (open: boolean) => void;
  updateDevice: (id: string, patch: Partial<Omit<Device, "id">>) => void;
  dispatchHardwareCommand: (
    target: HardwareCommandTarget,
    action: HardwareCommandAction
  ) => void;
  clearCommand: (target: HardwareCommandTarget) => void;
  // Injected by WebSocketProvider once socket opens; default is a no-op.
  _sendToHardware: (
    cmdId: string,
    target: HardwareCommandTarget,
    action: HardwareCommandAction
  ) => void;
}

type AppState = AiState & TelemetryState & HardwareState;

const MAX_HISTORY           = 50;
const MAX_DIAGNOSIS_HISTORY = 20;

export const useAppStore = create<AppState>()((set, get) => ({

  // ── AI slice
  modelStatus:      "idle",
  inferenceStatus:  "idle",
  currentDiagnosis: null,
  diagnosisHistory: [],
  lastPrediction:   null,
  confidence:       0,
  anomalyDetected:  false,
  inferenceCount:   0,
  renderCount:      0,

  setModelStatus:     (status)                 => set({ modelStatus: status }),
  setInferenceStatus: (status)                 => set({ inferenceStatus: status }),
  setPrediction:      (prediction, confidence) => set({ lastPrediction: prediction, confidence }),
  setAnomalyDetected: (detected)               => set({ anomalyDetected: detected }),

  setDiagnosis: (result) =>
    set((state) => ({
      currentDiagnosis: result,
      lastPrediction:   result.label,
      confidence:       result.confidence,
      anomalyDetected:  result.isAnomaly,
      renderCount:      state.renderCount + 1,
      diagnosisHistory: [result, ...state.diagnosisHistory].slice(0, MAX_DIAGNOSIS_HISTORY),
    })),

  incrementInferenceCount: () =>
    set((state) => ({ inferenceCount: state.inferenceCount + 1 })),

  resetInference: () =>
    set({
      inferenceStatus:  "idle",
      currentDiagnosis: null,
      diagnosisHistory: [],
      lastPrediction:   null,
      confidence:       0,
      anomalyDetected:  false,
      inferenceCount:   0,
      renderCount:      0,
    }),

  // ── Telemetry slice
  temperature:  null,
  humidity:     null,
  soilMoisture: null,
  tempStatus:   null,
  humidStatus:  null,
  soilStatus:   null,
  lastUpdated:  null,
  history:      [],

  updateTelemetry: (data) =>
    set((state) => {
      const now   = new Date();
      const point: TelemetryDataPoint = { ...data, timestamp: now };
      const history = [...state.history, point].slice(-MAX_HISTORY);
      return {
        // Preserve null when ESP sends null (sensor unavailable)
        temperature:  data.temperature  !== undefined ? data.temperature  : state.temperature,
        humidity:     data.humidity      !== undefined ? data.humidity      : state.humidity,
        soilMoisture: data.soilMoisture  !== undefined ? data.soilMoisture  : state.soilMoisture,
        tempStatus:   data.tempStatus    ?? state.tempStatus,
        humidStatus:  data.humidStatus   ?? state.humidStatus,
        soilStatus:   data.soilStatus    ?? state.soilStatus,
        lastUpdated:  now,
        history,
      };
    }),

  // ── Hardware slice
  connectionStatus: "DISCONNECTED",
  connectionMode:   "DISCONNECTED",
  espIp:            null,
  latencyMs:        null,
  devices:          [],
  pumpActive:       false,
  valveOpen:        false,
  pendingCommands:  { pump: null, valve: null },

  _sendToHardware: () => {
    console.warn("[Store] _sendToHardware called but no WebSocket is injected.");
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setConnectionMode:   (mode)   => set({ connectionMode: mode }),
  setEspIp:            (ip)     => set({ espIp: ip }),
  setLatencyMs:        (ms)     => set({ latencyMs: ms }),
  setPumpActive:       (active) => set({ pumpActive: active }),
  setValveOpen:        (open)   => set({ valveOpen: open }),

  updateDevice: (id, patch) =>
    set((state) => ({
      devices: state.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),

  clearCommand: (target) =>
    set((state) => ({
      pendingCommands: { ...state.pendingCommands, [target]: null },
    })),

  dispatchHardwareCommand: (target, action) => {
    const commandId = `cmd_${target}_${Date.now()}`;
    const now       = new Date();
    const command: HardwareCommand = {
      id: commandId, target, action,
      status: "sending", issuedAt: now,
      acknowledgedAt: null, confirmedAt: null, failureReason: null,
    };
    set((state) => ({ pendingCommands: { ...state.pendingCommands, [target]: command } }));
    console.log(`[HW] SENDING ${action.toUpperCase()} -> ${target} (${commandId})`);
    try {
      get()._sendToHardware(commandId, target, action);
    } catch {
      set((state) => ({
        pendingCommands: {
          ...state.pendingCommands,
          [target]: { ...command, status: "failed", failureReason: "WebSocket not open" },
        },
      }));
      return;
    }
    setTimeout(() => {
      const cur = useAppStore.getState().pendingCommands[target];
      if (cur?.id === commandId && cur.status !== "confirmed" && cur.status !== "failed") {
        console.warn(`[HW] Command ${commandId} timed out.`);
        set((state) => ({
          pendingCommands: {
            ...state.pendingCommands,
            [target]: { ...command, status: "timeout", failureReason: "ESP8266 did not confirm within 6 s" },
          },
        }));
      }
    }, 6000);
  },
}));

// ────────────────────────────────────────────────────────────────
// Throttled diagnosis setter — limits React re-renders to max 2/s
// ────────────────────────────────────────────────────────────────
export const throttledSetDiagnosis = throttlePerSecond(
  (result: DiagnosisResult) => {
    useAppStore.getState().setDiagnosis(result);
  },
  2
);
