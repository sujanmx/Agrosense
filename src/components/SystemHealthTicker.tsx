import { useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { useAppStore } from "@/store";
import {
  Wifi,
  WifiOff,
  Cloud,
  Loader2,
  Activity,
  Thermometer,
  Droplets,
  Server,
  RefreshCw,
  Zap,
  Info,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ────────────────────────────────────────────────────────────────
// SystemHealthTicker — top-bar status strip & diagnostics modal
// ────────────────────────────────────────────────────────────────

export function SystemHealthTicker() {
  const {
    connectionStatus,
    connectionMode,
    wsUrl,
    espIp,
    latencyMs,
    setManualIp,
    resetToAutoDiscovery,
    reconnect,
    retryCount,
  } = useWebSocket();

  const temperature = useAppStore((s) => s.temperature);
  const humidity = useAppStore((s) => s.humidity);

  const [showDiagModal, setShowDiagModal] = useState(false);
  const [manualIpInput, setManualIpInput] = useState("");

  // Determine badge styling and label according to requirements
  let badgeLabel = "DISCONNECTED";
  let badgeClass = "border-red-500/30 bg-red-500/10 text-red-400";
  let dotClass = "bg-red-500";
  let IconComponent = WifiOff;
  let iconClass = "";

  if (connectionStatus === "CONNECTING") {
    badgeLabel = "CONNECTING...";
    badgeClass = "border-amber-500/30 bg-amber-500/10 text-amber-400";
    dotClass = "bg-amber-400 animate-pulse";
    IconComponent = Loader2;
    iconClass = "animate-spin";
  } else if (connectionStatus === "CONNECTED") {
    if (connectionMode === "LOCAL ESP") {
      badgeLabel = "LOCAL ESP";
      badgeClass = "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";
      dotClass = "bg-emerald-400 animate-pulse";
      IconComponent = Wifi;
    } else if (connectionMode === "CLOUDFLARE") {
      badgeLabel = "CLOUDFLARE";
      badgeClass = "border-sky-500/40 bg-sky-500/15 text-sky-400";
      dotClass = "bg-sky-400 animate-pulse";
      IconComponent = Cloud;
    } else {
      badgeLabel = "CONNECTED";
      badgeClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
      dotClass = "bg-emerald-400";
      IconComponent = Wifi;
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualIpInput.trim()) {
      setManualIp(manualIpInput.trim());
      setManualIpInput("");
      setShowDiagModal(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none">
        {/* Connection mode badge (clickable for diagnostics) */}
        <button
          onClick={() => setShowDiagModal(true)}
          className="focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded-md transition-transform active:scale-95 text-left"
          title="Click to view network diagnostics and IP fallback"
          type="button"
        >
          <Badge
            variant="outline"
            className={`gap-1.5 py-1 px-2.5 font-mono text-[11px] cursor-pointer hover:opacity-90 ${badgeClass}`}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
            <IconComponent className={`h-3 w-3 ${iconClass}`} />
            <span>{badgeLabel}</span>
            {connectionStatus === "CONNECTED" && latencyMs !== null && (
              <span className="opacity-70 text-[10px] ml-0.5 font-sans">
                {latencyMs}ms
              </span>
            )}
          </Badge>
        </button>

        {/* Sensor quick-reads (visible when connected) */}
        {connectionStatus === "CONNECTED" && (
          <>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              <Thermometer className="h-3 w-3 text-orange-400" />
              {temperature !== null ? `${temperature.toFixed(1)}°C` : (
                <span className="text-zinc-600 italic">N/A</span>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              <Droplets className="h-3 w-3 text-blue-400" />
              {humidity !== null ? `${humidity.toFixed(1)}%` : (
                <span className="text-zinc-600 italic">N/A</span>
              )}
            </div>
            <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              <Activity className="h-3 w-3 text-emerald-400" />
              <span>2s interval</span>
            </div>
          </>
        )}
      </div>

      {/* ── Network Diagnostics & IP Fallback Modal ─────────── */}
      {showDiagModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowDiagModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl space-y-4 text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold tracking-wide">
                  AgroSense Network Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setShowDiagModal(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Diagnostic Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                  Connection Mode
                </span>
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
                  {badgeLabel}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                  Latency (RTT)
                </span>
                <span className="font-bold text-zinc-200 flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-400" />
                  {latencyMs !== null ? `${latencyMs} ms` : "Measuring..."}
                </span>
              </div>

              <div className="col-span-2 p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1 overflow-hidden">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                  Active WebSocket URL
                </span>
                <span className="text-zinc-300 text-[11px] truncate block font-mono">
                  {wsUrl}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                  ESP Local IP (Telemetry)
                </span>
                <span className="text-zinc-200 font-bold">
                  {espIp || "Waiting for telemetry..."}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                  mDNS Hostname
                </span>
                <span className="text-zinc-200 font-bold">agrosense.local:81</span>
              </div>

              <div className="col-span-2 p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                  Discovery Cycles / Status
                </span>
                <span className="text-zinc-300 text-[11px] font-mono">
                  {connectionStatus === "CONNECTED"
                    ? "Active & Synchronized"
                    : retryCount > 0
                    ? `Auto-reconnect probe cycle #${retryCount}`
                    : "Probing endpoints..."}
                </span>
              </div>
            </div>

            {/* Manual Local IP Fallback Input */}
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                <Info className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span>Manual Local IP Fallback</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                If your browser does not resolve <code className="text-emerald-400">agrosense.local</code>, enter the ESP8266 DHCP IP directly:
              </p>
              <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="e.g. 192.168.43.150"
                  value={manualIpInput}
                  onChange={(e) => setManualIpInput(e.target.value)}
                  className="flex-1 rounded-md bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-zinc-700 hover:border-emerald-500 hover:text-emerald-400"
                >
                  Connect IP
                </Button>
              </form>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetToAutoDiscovery}
                className="text-xs text-zinc-400 hover:text-emerald-400"
              >
                Reset to Auto-Discovery (mDNS)
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  reconnect();
                  setShowDiagModal(false);
                }}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                Reconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
