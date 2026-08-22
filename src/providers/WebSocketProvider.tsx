import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useAppStore } from "@/store";
import type {
  ConnectionStatus,
  HardwareCommandTarget,
} from "@/types";

// ────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────
//
// Priority order for the WebSocket URL:
//   1. localStorage key  "AGROSENSE_WS_URL"   (runtime override)
//   2. Vite env variable  VITE_WS_URL          (.env file)
//   3. Hardcoded fallback ws://10.18.37.83:81  (your live NodeMCU)
//
// To change IP at runtime without reloading source:
//   localStorage.setItem("AGROSENSE_WS_URL", "ws://192.168.x.y:81");
//   location.reload();

const HARDWARE_WS_URL =
  (typeof window !== "undefined" && window.localStorage?.getItem("AGROSENSE_WS_URL")) ||
  (import.meta.env.VITE_WS_URL as string | undefined) ||
  "ws://10.18.37.83:81";

// ── Exponential-backoff constants ─────────────────────────────
const BACKOFF_BASE_MS  = 1_000;   // first retry after 1 s
const BACKOFF_MAX_MS   = 30_000;  // cap retries at 30 s
const BACKOFF_FACTOR   = 2;       // double each time
const BACKOFF_JITTER   = 0.3;     // ±30% random jitter prevents thundering-herd

// ────────────────────────────────────────────────────────────────
// Context
// ────────────────────────────────────────────────────────────────

interface WebSocketContextValue {
  /** Live socket status — mirrors the Zustand store but available via hook. */
  connectionStatus: ConnectionStatus;
  /** Current WebSocket URL in use. */
  wsUrl: string;
  /** Override the target URL and trigger a fresh connection. */
  setWsUrl: (url: string) => void;
  /** Manually trigger reconnection (resets backoff counter). */
  reconnect: () => void;
  /** Permanently close the socket until reconnect() is called. */
  disconnect: () => void;
  /** Retry attempt counter — useful for showing "Retry 3/∞" in UI. */
  retryCount: number;
  /** Next retry delay in ms — useful for a countdown indicator. */
  nextRetryMs: number;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ────────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────────

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setLocalStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [wsUrl, setWsUrlState]             = useState(HARDWARE_WS_URL);
  const [retryCount,  setRetryCount]        = useState(0);
  const [nextRetryMs, setNextRetryMs]        = useState(BACKOFF_BASE_MS);

  const socketRef         = useRef<WebSocket | null>(null);
  const retryTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef     = useRef(0);        // mutable ref so callbacks see fresh value
  const shouldReconnect   = useRef(true);     // set false on deliberate disconnect()

  // ── Keep Zustand store connectionStatus in sync ─────────────
  const setStatus = useCallback((s: ConnectionStatus) => {
    setLocalStatus(s);
    useAppStore.getState().setConnectionStatus(s);
  }, []);

  // ── Compute next backoff delay with jitter ───────────────────
  const computeDelay = useCallback((attempt: number): number => {
    const exp     = BACKOFF_BASE_MS * Math.pow(BACKOFF_FACTOR, attempt);
    const capped  = Math.min(exp, BACKOFF_MAX_MS);
    const jitter  = capped * BACKOFF_JITTER * (Math.random() * 2 - 1);
    return Math.round(capped + jitter);
  }, []);

  // ── Clean up the retry timer ─────────────────────────────────
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ── Inject / revoke the ws.send wrapper in the Zustand store ─
  const injectSender = useCallback((ws: WebSocket) => {
    useAppStore.setState({
      _sendToHardware: (cmdId, target, action) => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn("[WS] Cannot send — socket not OPEN");
          return;
        }
        const payload = JSON.stringify({ type: "command", cmdId, target, action });
        ws.send(payload);
        console.log("[WS] Sent to ESP8266:", payload);
      },
    });
  }, []);

  const revokeSender = useCallback(() => {
    useAppStore.setState({
      _sendToHardware: () => {
        console.warn("[Store] _sendToHardware called but no WebSocket is connected.");
      },
    });
  }, []);

  // ────────────────────────────────────────────────────────────────
  // handleMessage — parses every incoming ESP8266 frame
  // ────────────────────────────────────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
      console.error("[WS] Non-JSON frame received:", event.data);
      return;
    }

    const store = useAppStore.getState();

    // ── 1. Telemetry broadcast ─────────────────────────────────
    if (
      data.type === "telemetry" ||
      data.temperature !== undefined ||
      data.humidity    !== undefined ||
      data.soilMoisture !== undefined
    ) {
      store.updateTelemetry({
        temperature:  Number(data.temperature  ?? 0),
        humidity:     Number(data.humidity     ?? 0),
        soilMoisture: Number(data.soilMoisture ?? 0),
      });
      // Keep actuator booleans in sync (ESP8266 includes them in every telemetry frame)
      if (typeof data.pumpActive === "boolean") store.setPumpActive(data.pumpActive);
      if (typeof data.valveOpen  === "boolean") store.setValveOpen(data.valveOpen);
      return;
    }

    // ── 2. ACK — move command to AWAITING_ACK ─────────────────
    if (data.type === "ack" || data.status === "awaiting_ack") {
      const target  = data.target as HardwareCommandTarget | undefined;
      const cmdId   = data.cmdId  as string | undefined;
      if (!target) return;

      const cur = store.pendingCommands[target];
      if (cur && (!cmdId || cur.id === cmdId)) {
        console.log(`[HW] ACK received: ${target} awaiting_ack`);
        useAppStore.setState((s) => ({
          pendingCommands: {
            ...s.pendingCommands,
            [target]: { ...cur, status: "awaiting_ack", acknowledgedAt: new Date() },
          },
        }));
      }
      return;
    }

    // ── 3. Confirmed — move command to CONFIRMED, apply state ──
    if (data.type === "confirmed" || data.status === "confirmed") {
      const target = data.target as HardwareCommandTarget | undefined;
      const cmdId  = data.cmdId  as string | undefined;
      if (!target) return;

      const cur = store.pendingCommands[target];
      if (cur && (!cmdId || cur.id === cmdId)) {
        // Trust the boolean the firmware broadcasts after actuation
        if (typeof data.pumpActive === "boolean") store.setPumpActive(data.pumpActive);
        if (typeof data.valveOpen  === "boolean") store.setValveOpen(data.valveOpen);

        console.log(`[HW] CONFIRMED: ${target} ${cur.action}`);
        useAppStore.setState((s) => ({
          pendingCommands: {
            ...s.pendingCommands,
            [target]: {
              ...cur,
              status:      "confirmed",
              acknowledgedAt: cur.acknowledgedAt ?? new Date(),
              confirmedAt: new Date(),
            },
          },
        }));

        // Auto-clear the confirmed badge after 3 s
        setTimeout(() => {
          const latest = useAppStore.getState().pendingCommands[target];
          if (latest?.id === cur.id) store.clearCommand(target);
        }, 3_000);
      }
      return;
    }

    console.debug("[WS] Unrecognised frame:", data);
  }, []);

  // ────────────────────────────────────────────────────────────────
  // connect — open a new WebSocket and wire all event handlers
  // ────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    // Tear down any existing socket cleanly
    if (socketRef.current) {
      socketRef.current.onclose   = null; // prevent onclose from scheduling another retry
      socketRef.current.onerror   = null;
      socketRef.current.onmessage = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    clearRetryTimer();
    revokeSender();
    setStatus("CONNECTING");

    const url = wsUrl; // capture current URL in closure
    console.log(`[WS] Connecting to ${url} (attempt ${retryCountRef.current + 1})`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error("[WS] WebSocket constructor threw:", err);
      setStatus("ERROR");
      scheduleRetry();
      return;
    }

    socketRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to ESP8266 at ${url}`);
      setStatus("CONNECTED");
      // Reset backoff on successful connection
      retryCountRef.current = 0;
      setRetryCount(0);
      setNextRetryMs(BACKOFF_BASE_MS);
      injectSender(ws);
    };

    ws.onmessage = handleMessage;

    ws.onerror = (ev) => {
      // onerror fires before onclose — log but let onclose handle retry
      console.warn("[WS] Socket error:", ev);
      setStatus("ERROR");
    };

    ws.onclose = (ev) => {
      console.log(`[WS] Socket closed (code=${ev.code}, reason="${ev.reason ?? ""}").`);
      revokeSender();
      if (shouldReconnect.current) {
        setStatus("DISCONNECTED");
        scheduleRetry();
      }
    };
  }, [wsUrl, clearRetryTimer, revokeSender, injectSender, handleMessage, setStatus]); // eslint-disable-line

  // ────────────────────────────────────────────────────────────────
  // scheduleRetry — exponential backoff with jitter
  // ────────────────────────────────────────────────────────────────
  const scheduleRetry = useCallback(() => {
    const attempt = retryCountRef.current;
    const delay   = computeDelay(attempt);

    retryCountRef.current += 1;
    setRetryCount(retryCountRef.current);
    setNextRetryMs(delay);

    console.log(
      `[WS] Reconnecting in ${(delay / 1000).toFixed(1)} s ` +
      `(attempt ${retryCountRef.current}, backoff ×${BACKOFF_FACTOR})`
    );

    retryTimerRef.current = setTimeout(() => {
      if (shouldReconnect.current) connect();
    }, delay);
  }, [computeDelay, connect]);

  // ── Public API ───────────────────────────────────────────────
  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    clearRetryTimer();
    revokeSender();
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus("DISCONNECTED");
    console.log("[WS] Deliberately disconnected.");
  }, [clearRetryTimer, revokeSender, setStatus]);

  const reconnect = useCallback(() => {
    shouldReconnect.current = true;
    retryCountRef.current   = 0;
    setRetryCount(0);
    setNextRetryMs(BACKOFF_BASE_MS);
    connect();
  }, [connect]);

  const setWsUrl = useCallback((url: string) => {
    setWsUrlState(url);
    if (typeof window !== "undefined") {
      window.localStorage?.setItem("AGROSENSE_WS_URL", url);
    }
    // Reconnect immediately with new URL
    shouldReconnect.current = true;
    retryCountRef.current   = 0;
  }, []);

  // ── Connect on mount / when wsUrl changes ────────────────────
  useEffect(() => {
    shouldReconnect.current = true;
    connect();
    return () => {
      shouldReconnect.current = false;
      clearRetryTimer();
      revokeSender();
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  return (
    <WebSocketContext.Provider
      value={{
        connectionStatus,
        wsUrl,
        setWsUrl,
        reconnect,
        disconnect,
        retryCount,
        nextRetryMs,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocket must be used within <WebSocketProvider>");
  return ctx;
}
