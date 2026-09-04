import { useWebSocket } from "@/providers/WebSocketProvider";
import { useAppStore } from "@/store";
import { StateOverlay } from "@/components/StateOverlay";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Droplets, Leaf, Clock, WifiOff } from "lucide-react";
import type { SensorStatus } from "@/types";

// ────────────────────────────────────────────────────────────────
// TelemetryPanel — live sensor readouts (left panel)
// ────────────────────────────────────────────────────────────────

// ── Source label badge ──────────────────────────────────────────
function SourceBadge({ status }: { status: SensorStatus | null }) {
  if (!status || status === "sensor_unavailable") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
        <WifiOff className="h-2.5 w-2.5" />
        SENSOR NOT CONNECTED
      </span>
    );
  }
  if (status === "fault") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider bg-red-950 text-red-400 border border-red-800 rounded px-1.5 py-0.5">
        ⚠ SENSOR FAULT
      </span>
    );
  }
  if (status === "no_probe") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-800 rounded px-1.5 py-0.5">
        ⚠ PROBE DISCONNECTED
      </span>
    );
  }
  // status === "ok"
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800 rounded px-1.5 py-0.5">
      ✓ REAL SENSOR
    </span>
  );
}

// ── Sensor Card ─────────────────────────────────────────────────
interface SensorCardProps {
  icon: React.ReactNode;
  label: string;
  /** Numeric value — null means sensor unavailable */
  value: number | null;
  unit: string;
  accent: string;
  barPercent: number;
  barColor: string;
  status: SensorStatus | null;
}

function SensorCard({
  icon,
  label,
  value,
  unit,
  accent,
  barPercent,
  barColor,
  status,
}: SensorCardProps) {
  const isUnavailable = value === null;

  return (
    <div className="rounded-lg border border-border/40 bg-zinc-900/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </span>
        </div>
        {!isUnavailable && (
          <span className={`text-[10px] font-mono ${accent}`}>{unit}</span>
        )}
      </div>

      {isUnavailable ? (
        <div className="space-y-1">
          <p className="text-lg font-bold tracking-tight text-zinc-500">N/A</p>
          <SourceBadge status={status} />
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {typeof value === "number" ? value.toFixed(1) : "—"}
            </p>
            <SourceBadge status={status} />
          </div>
          {/* Mini bar gauge */}
          <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────
export function TelemetryPanel() {
  const { connectionStatus } = useWebSocket();
  const temperature  = useAppStore((s) => s.temperature);
  const humidity     = useAppStore((s) => s.humidity);
  const soilMoisture = useAppStore((s) => s.soilMoisture);
  const tempStatus   = useAppStore((s) => s.tempStatus);
  const humidStatus  = useAppStore((s) => s.humidStatus);
  const soilStatus   = useAppStore((s) => s.soilStatus);
  const lastUpdated  = useAppStore((s) => s.lastUpdated);
  const historyLength = useAppStore((s) => s.history.length);

  const isLive = connectionStatus === "CONNECTED";

  return (
    <Card className="border-border/50 bg-zinc-950/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Sensor Telemetry</CardTitle>
          <Badge
            variant="outline"
            className={`text-[10px] gap-1 ${
              isLive
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isLive ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
              }`}
            />
            {isLive ? "LIVE" : "IDLE"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {connectionStatus === "DISCONNECTED" ? (
          <StateOverlay variant="disconnected" lotusSize={56} />
        ) : connectionStatus === "CONNECTING" ? (
          <StateOverlay variant="loading" lotusSize={56} />
        ) : (
          <>
            {/* 🌡️ Temperature */}
            <SensorCard
              icon={<Thermometer className="h-3.5 w-3.5 text-orange-400" />}
              label="Temperature"
              value={temperature}
              unit="°C"
              accent="text-orange-400"
              barPercent={temperature !== null ? ((temperature - 15) / 35) * 100 : 0}
              barColor="bg-gradient-to-r from-orange-600 to-orange-400"
              status={tempStatus}
            />

            {/* 💧 Humidity */}
            <SensorCard
              icon={<Droplets className="h-3.5 w-3.5 text-blue-400" />}
              label="Humidity"
              value={humidity}
              unit="%RH"
              accent="text-blue-400"
              barPercent={humidity ?? 0}
              barColor="bg-gradient-to-r from-blue-600 to-blue-400"
              status={humidStatus}
            />

            {/* 🌱 Soil Moisture */}
            <SensorCard
              icon={<Leaf className="h-3.5 w-3.5 text-emerald-400" />}
              label="Soil Moisture"
              value={soilMoisture}
              unit="%"
              accent="text-emerald-400"
              barPercent={soilMoisture ?? 0}
              barColor="bg-gradient-to-r from-emerald-600 to-emerald-400"
              status={soilStatus}
            />

            {/* Footer metadata */}
            <div className="flex items-center justify-between pt-1 border-t border-border/30">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {historyLength}/50 pts
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
