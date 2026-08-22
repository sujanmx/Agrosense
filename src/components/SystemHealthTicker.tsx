import { useWebSocket } from "@/providers/WebSocketProvider";
import { useAppStore } from "@/store";
import {
  Wifi,
  WifiOff,
  Loader2,
  Activity,
  Thermometer,
  Droplets,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ────────────────────────────────────────────────────────────────
// SystemHealthTicker — top-bar status strip
// ────────────────────────────────────────────────────────────────

const connectionConfig: Record<
  import("@/types").ConnectionStatus,
  {
    icon: typeof Loader2;
    label: string;
    badgeClass: string;
    iconClass: string;
    dotClass: string;
  }
> = {
  CONNECTING: {
    icon: Loader2,
    label: "Connecting",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    iconClass: "animate-spin",
    dotClass: "bg-amber-400",
  },
  CONNECTED: {
    icon: Wifi,
    label: "Online",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    iconClass: "",
    dotClass: "bg-emerald-400 animate-pulse",
  },
  DISCONNECTED: {
    icon: WifiOff,
    label: "Offline",
    badgeClass: "border-red-500/30 bg-red-500/10 text-red-400",
    iconClass: "",
    dotClass: "bg-red-500",
  },
  ERROR: {
    icon: WifiOff,
    label: "Error",
    badgeClass: "border-red-600/40 bg-red-600/10 text-red-400",
    iconClass: "",
    dotClass: "bg-red-600 animate-pulse",
  },
};

export function SystemHealthTicker() {
  const { connectionStatus } = useWebSocket();
  const temperature = useAppStore((s) => s.temperature);
  const humidity = useAppStore((s) => s.humidity);

  const conn = connectionConfig[connectionStatus];
  const ConnIcon = conn.icon;

  return (
    <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
      {/* Connection badge */}
      <Badge
        variant="outline"
        className={`gap-1.5 py-1 px-2.5 font-mono text-[11px] ${conn.badgeClass}`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${conn.dotClass}`} />
        <ConnIcon className={`h-3 w-3 ${conn.iconClass}`} />
        {conn.label}
      </Badge>

      {/* Sensor quick-reads (visible when connected) */}
      {connectionStatus === "CONNECTED" && (
        <>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <Thermometer className="h-3 w-3 text-orange-400" />
            {temperature.toFixed(1)}°C
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <Droplets className="h-3 w-3 text-blue-400" />
            {humidity.toFixed(1)}%
          </div>
          <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span>2s interval</span>
          </div>
        </>
      )}
    </div>
  );
}
