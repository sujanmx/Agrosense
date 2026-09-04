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
  ConnectionMode,
  ConnectionStatus,
  HardwareCommandTarget,
} from "@/types";

// ────────────────────────────────────────────────────────────────
// Configuration & Fallback Hierarchy
// ────────────────────────────────────────────────────────────────
//
// Connection Strategy:
//   1. Try local ESP via mDNS:        ws://agrosense.local:81  (Mode: LOCAL ESP)
//   2. Try manual local IP (if set):  localStorage["AGROSENSE_WS_URL"]
//   3. Try Cloudflare Tunnel (if set): import.meta.env.VITE_CLOUDFLARE_WS_URL / VITE_WS_URL
//   4. Try cached last known IP:      localStorage["AGROSENSE_LAST_KNOWN_IP"]
//   5. Try fallback hardcoded IP:     ws://10.18.37.83:81
//
// If agrosense.local succeeds: uses LOCAL ESP mode directly.
// If local fails: seamlessly fails over to Cloudflare WSS if available.

export const DEFAULT_LOCAL_MDNS_URL = "ws://agrosense.local:81";
export const LOCAL_STORAGE_KEY       = "AGROSENSE_WS_URL";
export const LAST_KNOWN_IP_KEY      = "AGROSENSE_LAST_KNOWN_IP";

const CLOUDFLARE_WS_URL =
  (import.meta.env.VITE_CLOUDFLARE_WS_URL as string | undefined) ||
  (import.meta.env.VITE_WS_URL as string | undefined) ||
  "";

// ── Exponential-backoff & probe constants ─────────────────────
const PROBE_TIMEOUT_MS = 3_000;   // Timeout for individual candidate probe
const PING_INTERVAL_MS = 4_000;   // Interval between latency measurement pings
const BACKOFF_BASE_MS  = 1_000;   // First retry after 1 s
const BACKOFF_MAX_MS   = 20_000;  // Cap retries at 20 s
const BACKOFF_FACTOR   = 2;       // Double each cycle
const BACKOFF_JITTER   = 0.3;     // ±30% random jitter

// ── Helper: Classify Connection Mode from URL ───────────────────
export function classifyConnectionMode(url: string): ConnectionMode {
  if (!url) return "DISCONNECTED";
  const lower = url.toLowerCase();
  if (
    lower.includes("cloudflare") ||
    lower.includes("trycloudflare.com") ||
    (lower.startsWith("wss://") && !lower.includes("192.168.") && !lower.includes("10.") && !lower.includes("local"))
  ) {
    return "CLOUDFLARE";
  }
  if (
    lower.includes("agrosense.local") ||
    lower.includes("192.168.") ||
    lower.includes("10.") ||
    lower.includes("172.") ||
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.startsWith("ws://")
  ) {
    return "LOCAL ESP";
  }
  return "LOCAL ESP";
}

// ────────────────────────────────────────────────────────────────
// Context Value
// ────────────────────────────────────────────────────────────────

interface WebSocketContextValue {
  /** Live socket status: CONNECTING | CONNECTED | DISCONNECTED | ERROR */
  connectionStatus: ConnectionStatus;
  /** Active connection mode: "LOCAL ESP" | "CLOUDFLARE" | "DISCONNECTED" */
  connectionMode: ConnectionMode;
  /** Current WebSocket URL in use / being probed */
  wsUrl: string;
  /** ESP8266 local IP address reported via telemetry (e.g. "192.168.1.100") */
  espIp: string | null;
  /** Live round-trip latency in milliseconds */
  latencyMs: number | null;
  /** Override the target URL (persists in localStorage) */
  setWsUrl: (url: string) => void;
  /** Quick manual IP helper (e.g., "192.168.43.50") */
  setManualIp: (ip: string) => void;
  /** Reset to default automatic mDNS discovery (ws://agrosense.local:81) */
  resetToAutoDiscovery: () => void;
  /** Manually trigger reconnection */
  reconnect: () => void;
  /** Permanently close the socket until reconnect() is called */
  disconnect: () => void;
  /** Retry attempt counter */
  retryCount: number;
  /** Next retry delay in ms */
  nextRetryMs: number;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ────────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────────

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setLocalStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [connectionMode,   setLocalMode]   = useState<ConnectionMode>("DISCONNECTED");
  const [wsUrl,            setWsUrlState]  = useState<string>(() => {
    return (
      (typeof window !== "undefined" && window.localStorage?.getItem(LOCAL_STORAGE_KEY)) ||
      DEFAULT_LOCAL_MDNS_URL
    );
  });
  const [espIp,            setEspIpState]  = useState<string | null>(null);
  const [latencyMs,        setLatencyState]= useState<number | null>(null);
  const [retryCount,       setRetryCount]  = useState(0);
  const [nextRetryMs,      setNextRetryMs] = useState(BACKOFF_BASE_MS);

  const socketRef         = useRef<WebSocket | null>(null);
  const retryTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const candidateIndexRef = useRef(0);
  const retryCountRef     = useRef(0);
  const shouldReconnect   = useRef(true);

  // ── Sync Zustand Store ───────────────────────────────────────
  const setStatus = useCallback((s: ConnectionStatus) => {
    setLocalStatus(s);
    useAppStore.getState().setConnectionStatus(s);
  }, []);

  const setMode = useCallback((m: ConnectionMode) => {
    setLocalMode(m);
    useAppStore.getState().setConnectionMode(m);
  }, []);

  const setIp = useCallback((ip: string | null) => {
    setEspIpState(ip);
    useAppStore.getState().setEspIp(ip);
  }, []);

  const setLatency = useCallback((ms: number | null) => {
    setLatencyState(ms);
    useAppStore.getState().setLatencyMs(ms);
  }, []);

  // ── Compute candidate endpoints in priority order ────────────
  const buildCandidateList = useCallback((): string[] => {
    const list: string[] = [];
    const saved = typeof window !== "undefined" ? window.localStorage?.getItem(LOCAL_STORAGE_KEY) : null;
    const lastIp = typeof window !== "undefined" ? window.localStorage?.getItem(LAST_KNOWN_IP_KEY) : null;

    // 1. Always prioritize mDNS local address
    list.push(DEFAULT_LOCAL_MDNS_URL);

    // 2. If user configured a custom manual URL that is not default mDNS, try it next
    if (saved && saved !== DEFAULT_LOCAL_MDNS_URL && !list.includes(saved)) {
      list.push(saved);
    }

    // 3. If Cloudflare WSS URL is configured, try it next
    if (CLOUDFLARE_WS_URL && !list.includes(CLOUDFLARE_WS_URL)) {
      list.push(CLOUDFLARE_WS_URL);
    }

    // 4. If a previously confirmed local IP was cached from telemetry, try it as fallback
    if (lastIp && !list.includes(lastIp)) {
      list.push(lastIp);
    }

    // 5. Default local fallback IP
    const staticFallback = "ws://10.18.37.83:81";
    if (!list.includes(staticFallback)) {
      list.push(staticFallback);
    }

    return list;
  }, []);

  // ── Compute backoff delay ────────────────────────────────────
  const computeDelay = useCallback((attempt: number): number => {
    const exp     = BACKOFF_BASE_MS * Math.pow(BACKOFF_FACTOR, attempt);
    const capped  = Math.min(exp, BACKOFF_MAX_MS);
    const jitter  = capped * BACKOFF_JITTER * (Math.random() * 2 - 1);
    return Math.round(capped + jitter);
  }, []);

  // ── Clear all background timers ──────────────────────────────
  const clearTimers = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (probeTimerRef.current !== null) {
      clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
    if (pingTimerRef.current !== null) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  // ── Start live ping / latency probe ──────────────────────────
  const startPingInterval = useCallback((ws: WebSocket) => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
        } catch {
          // ignore
        }
      }
    }, PING_INTERVAL_MS);
  }, []);

  // ── Inject / revoke the ws.send wrapper in Zustand store ─────
  const injectSender = useCallback((ws: WebSocket) => {
    useAppStore.setState({
      _sendToHardware: (cmdId, target, action) => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn("[WS] Cannot send — socket not OPEN");
          return;
        }
        const payload = JSON.stringify({ type: "command", cmdId, target, action });
        ws.send(payload);
        console.log("[WS] Sent to hardware:", payload);
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

  // ────────────────────────────────────────────────────────────
  // handleMessage — parses incoming ESP frames
  // ────────────────────────────────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
      console.error("[WS] Non-JSON frame received:", event.data);
      return;
    }

    const store = useAppStore.getState();

    // ── 0. Pong frame (Latency measurement) ───────────────────
    if (data.type === "pong" && typeof data.t === "number") {
      const rtt = Math.max(1, Date.now() - data.t);
      setLatency(rtt);
      return;
    }

    // ── 1. Telemetry broadcast ─────────────────────────────────
    if (
      data.type === "telemetry" ||
      data.temperature !== undefined ||
      data.humidity    !== undefined ||
      data.soilMoisture !== undefined
    ) {
      // Parse sensor values — null means sensor is unavailable
      // (ESP sends JSON null, which JS parses as null)
      const tempVal  = data.temperature  === null ? null : (data.temperature  !== undefined ? Number(data.temperature)  : undefined);
      const humidVal = data.humidity     === null ? null : (data.humidity     !== undefined ? Number(data.humidity)     : undefined);
      const soilVal  = data.soilMoisture === null ? null : (data.soilMoisture !== undefined ? Number(data.soilMoisture) : undefined);

      store.updateTelemetry({
        temperature:  tempVal  !== undefined ? tempVal  : null,
        humidity:     humidVal !== undefined ? humidVal : null,
        soilMoisture: soilVal  !== undefined ? soilVal  : null,
        tempStatus:   (data.tempStatus  as string | undefined) as import("@/types").SensorStatus | undefined,
        humidStatus:  (data.humidStatus as string | undefined) as import("@/types").SensorStatus | undefined,
        soilStatus:   (data.soilStatus  as string | undefined) as import("@/types").SensorStatus | undefined,
        ip: data.ip ? String(data.ip) : undefined,
      });

      // Update IP if received
      if (data.ip && typeof data.ip === "string") {
        setIp(data.ip);
        if (typeof window !== "undefined") {
          window.localStorage?.setItem(LAST_KNOWN_IP_KEY, `ws://${data.ip}:81`);
        }
      }

      // Keep actuator booleans in sync
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
        if (typeof data.pumpActive === "boolean") store.setPumpActive(data.pumpActive);
        if (typeof data.valveOpen  === "boolean") store.setValveOpen(data.valveOpen);

        console.log(`[HW] CONFIRMED: ${target} ${cur.action}`);
        useAppStore.setState((s) => ({
          pendingCommands: {
            ...s.pendingCommands,
            [target]: {
              ...cur,
              status:        "confirmed",
              acknowledgedAt: cur.acknowledgedAt ?? new Date(),
              confirmedAt:   new Date(),
            },
          },
        }));

        setTimeout(() => {
          const latest = useAppStore.getState().pendingCommands[target];
          if (latest?.id === cur.id) store.clearCommand(target);
        }, 3_000);
      }
      return;
    }

    console.debug("[WS] Unrecognised frame:", data);
  }, [setIp, setLatency]);

  // ────────────────────────────────────────────────────────────
  // scheduleRetry — exponential backoff across discovery cycle
  // ────────────────────────────────────────────────────────────
  const scheduleRetry = useCallback(() => {
    clearTimers();
    revokeSender();
    setMode("DISCONNECTED");
    setStatus("DISCONNECTED");

    const attempt = retryCountRef.current;
    const delay   = computeDelay(attempt);

    retryCountRef.current += 1;
    setRetryCount(retryCountRef.current);
    setNextRetryMs(delay);

    console.log(
      `[WS] Auto-discovery retrying in ${(delay / 1000).toFixed(1)}s (cycle attempt ${retryCountRef.current})...`
    );

    retryTimerRef.current = setTimeout(() => {
      if (shouldReconnect.current) {
        candidateIndexRef.current = 0; // Restart from local mDNS candidate
        attemptNextCandidate();
      }
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, computeDelay, revokeSender, setMode, setStatus]);

  // ────────────────────────────────────────────────────────────
  // attemptNextCandidate — probes each candidate endpoint in sequence
  // ────────────────────────────────────────────────────────────
  const attemptNextCandidate = useCallback(() => {
    const candidates = buildCandidateList();
    const index = candidateIndexRef.current;

    if (index >= candidates.length) {
      console.warn("[WS] All discovery candidates exhausted. Scheduling retry cycle...");
      scheduleRetry();
      return;
    }

    const targetUrl = candidates[index];
    setWsUrlState(targetUrl);
    setStatus("CONNECTING");

    console.log(`[WS] Probing candidate [${index + 1}/${candidates.length}]: ${targetUrl}`);

    // Clean up previous socket if any
    if (socketRef.current) {
      socketRef.current.onclose   = null;
      socketRef.current.onerror   = null;
      socketRef.current.onmessage = null;
      socketRef.current.close();
      socketRef.current = null;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(targetUrl);
    } catch (err) {
      console.warn(`[WS] WebSocket creation error on ${targetUrl}:`, err);
      candidateIndexRef.current += 1;
      attemptNextCandidate();
      return;
    }

    socketRef.current = ws;

    // Timeout safety for unresolved mDNS / unreachable endpoints
    probeTimerRef.current = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn(`[WS] Probe timed out on ${targetUrl}. Trying next candidate...`);
        try {
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
        } catch {
          // ignore
        }
        candidateIndexRef.current += 1;
        attemptNextCandidate();
      }
    }, PROBE_TIMEOUT_MS);

    ws.onopen = () => {
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
      const mode = classifyConnectionMode(targetUrl);
      console.log(`[WS] ✅ Connected successfully to ${targetUrl} [Mode: ${mode}]`);

      setStatus("CONNECTED");
      setMode(mode);
      setWsUrlState(targetUrl);

      // Reset backoff on success
      retryCountRef.current = 0;
      setRetryCount(0);
      setNextRetryMs(BACKOFF_BASE_MS);

      injectSender(ws);
      startPingInterval(ws);
    };

    ws.onmessage = handleMessage;

    ws.onerror = (ev) => {
      console.warn(`[WS] Candidate failed (${targetUrl}):`, ev);
    };

    ws.onclose = () => {
      revokeSender();
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);

      if (shouldReconnect.current) {
        // If we were connected and lost connection, try next or cycle
        candidateIndexRef.current += 1;
        if (candidateIndexRef.current < candidates.length) {
          attemptNextCandidate();
        } else {
          scheduleRetry();
        }
      }
    };
  }, [
    buildCandidateList,
    handleMessage,
    injectSender,
    revokeSender,
    scheduleRetry,
    setMode,
    setStatus,
    startPingInterval,
  ]);

  // ── Public APIs ──────────────────────────────────────────────
  const reconnect = useCallback(() => {
    shouldReconnect.current = true;
    retryCountRef.current   = 0;
    candidateIndexRef.current = 0;
    setRetryCount(0);
    setNextRetryMs(BACKOFF_BASE_MS);
    attemptNextCandidate();
  }, [attemptNextCandidate]);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    clearTimers();
    revokeSender();
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus("DISCONNECTED");
    setMode("DISCONNECTED");
    console.log("[WS] Deliberately disconnected.");
  }, [clearTimers, revokeSender, setMode, setStatus]);

  const setWsUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (typeof window !== "undefined") {
      window.localStorage?.setItem(LOCAL_STORAGE_KEY, trimmed);
    }
    setWsUrlState(trimmed);
    shouldReconnect.current = true;
    candidateIndexRef.current = 0;
    retryCountRef.current = 0;
    attemptNextCandidate();
  }, [attemptNextCandidate]);

  const setManualIp = useCallback((ip: string) => {
    const cleanIp = ip.trim().replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/:81$/, "");
    if (!cleanIp) return;
    const constructedUrl = `ws://${cleanIp}:81`;
    setWsUrl(constructedUrl);
  }, [setWsUrl]);

  const resetToAutoDiscovery = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage?.setItem(LOCAL_STORAGE_KEY, DEFAULT_LOCAL_MDNS_URL);
    }
    setWsUrlState(DEFAULT_LOCAL_MDNS_URL);
    shouldReconnect.current = true;
    candidateIndexRef.current = 0;
    retryCountRef.current = 0;
    attemptNextCandidate();
  }, [attemptNextCandidate]);

  // ── Connect on mount ─────────────────────────────────────────
  useEffect(() => {
    shouldReconnect.current = true;
    candidateIndexRef.current = 0;
    attemptNextCandidate();

    return () => {
      shouldReconnect.current = false;
      clearTimers();
      revokeSender();
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WebSocketContext.Provider
      value={{
        connectionStatus,
        connectionMode,
        wsUrl,
        espIp,
        latencyMs,
        setWsUrl,
        setManualIp,
        resetToAutoDiscovery,
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
