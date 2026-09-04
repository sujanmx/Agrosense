import { useWebSocket } from "@/providers/WebSocketProvider";
import { useAppStore } from "@/store";
import { StateOverlay } from "@/components/StateOverlay";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Power,
  Pipette,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Send,
  Radio,
} from "lucide-react";
import type { HardwareCommand, HardwareCommandTarget } from "@/types";

// ────────────────────────────────────────────────────────────────
// CommandStatus — shows the live pipeline state for a command
// ────────────────────────────────────────────────────────────────

function CommandStatus({ command }: { command: HardwareCommand | null }) {
  if (!command) return null;

  const phases = {
    sending: {
      icon: Send,
      label: "Command sent…",
      color: "text-amber-400",
      dotColor: "bg-amber-400",
      animate: true,
    },
    awaiting_ack: {
      icon: Radio,
      label: "Waiting for controller…",
      color: "text-blue-400",
      dotColor: "bg-blue-400",
      animate: true,
    },
    confirmed: {
      icon: CheckCircle2,
      label: "Hardware confirmed",
      color: "text-emerald-400",
      dotColor: "bg-emerald-400",
      animate: false,
    },
    failed: {
      icon: Power,
      label: `Failed: ${command.failureReason ?? "Unknown error"}`,
      color: "text-red-400",
      dotColor: "bg-red-400",
      animate: false,
    },
    timeout: {
      icon: Power,
      label: "Controller timed out",
      color: "text-red-400",
      dotColor: "bg-red-500",
      animate: false,
    },
    idle: {
      icon: Power,
      label: "",
      color: "text-zinc-500",
      dotColor: "bg-zinc-500",
      animate: false,
    },
  };

  const phase = phases[command.status];
  const Icon = phase.icon;

  return (
    <div
      className={`flex items-center gap-2 rounded-md border border-border/30 bg-zinc-900/80 px-2.5 py-1.5 text-[10px] font-mono ${phase.color} transition-all duration-300`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${phase.dotColor} ${
          phase.animate ? "animate-pulse" : ""
        }`}
      />
      <Icon className={`h-3 w-3 ${phase.animate ? "animate-spin" : ""}`} />
      <span className="flex-1">{phase.label}</span>
      {command.status !== "idle" && (
        <span className="text-muted-foreground/50 uppercase">
          {command.action}
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// HardwareToggle — single device control with command pipeline
// ────────────────────────────────────────────────────────────────

interface HardwareToggleProps {
  target: HardwareCommandTarget;
  icon: React.ReactNode;
  label: string;
  activeLabel: string;
  inactiveLabel: string;
  activeAction: string;
  inactiveAction: string;
  isActive: boolean;
  isOnline: boolean;
  command: HardwareCommand | null;
  onDispatch: (
    target: HardwareCommandTarget,
    action: "start" | "stop" | "open" | "close"
  ) => void;
}

function HardwareToggle({
  target,
  icon,
  label,
  activeLabel,
  inactiveLabel,
  activeAction,
  inactiveAction,
  isActive,
  isOnline,
  command,
  onDispatch,
}: HardwareToggleProps) {
  const isCommandInFlight =
    command?.status === "sending" || command?.status === "awaiting_ack";

  return (
    <div className="rounded-lg border border-border/40 bg-zinc-900/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span
          className={`text-[10px] font-mono font-bold ${
            isActive ? "text-emerald-400" : "text-zinc-500"
          }`}
        >
          {isActive ? activeLabel : inactiveLabel}
        </span>
      </div>

      <Button
        variant={isActive ? "destructive" : "outline"}
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={() =>
          onDispatch(
            target,
            isActive
              ? (inactiveAction as "stop" | "close")
              : (activeAction as "start" | "open")
          )
        }
        disabled={!isOnline || isCommandInFlight}
      >
        {isCommandInFlight ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isActive ? (
          <ToggleRight className="h-3.5 w-3.5" />
        ) : (
          <ToggleLeft className="h-3.5 w-3.5" />
        )}
        {isCommandInFlight
          ? "Command in progress…"
          : isActive
            // Capitalise the inactiveAction verb (e.g. "stop" → "Stop Pump", "close" → "Close Valve")
            ? `${inactiveAction.charAt(0).toUpperCase()}${inactiveAction.slice(1)} ${label}`
            // Capitalise the activeAction verb (e.g. "start" → "Start Pump", "open" → "Open Valve")
            : `${activeAction.charAt(0).toUpperCase()}${activeAction.slice(1)} ${label}`}
      </Button>

      {/* Command pipeline status */}
      <CommandStatus command={command} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// PumpControl — hardware action panel (right panel)
// ────────────────────────────────────────────────────────────────

export function PumpControl() {
  const { connectionStatus, reconnect } = useWebSocket();
  const pumpActive = useAppStore((s) => s.pumpActive);
  const valveOpen = useAppStore((s) => s.valveOpen);
  const pendingCommands = useAppStore((s) => s.pendingCommands);
  const dispatchHardwareCommand = useAppStore(
    (s) => s.dispatchHardwareCommand
  );

  const isOnline = connectionStatus === "CONNECTED";

  return (
    <Card className="border-border/50 bg-zinc-950/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Hardware Control</CardTitle>
            <CardDescription className="text-xs">
              Pump &amp; valve actuation
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] gap-1 border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
          >
            <Power className="h-2.5 w-2.5" />
            GPIO
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {connectionStatus === "DISCONNECTED" ? (
          <div className="space-y-4">
            <StateOverlay
              variant="disconnected"
              lotusSize={56}
              title="Controls Locked"
              description="Cannot actuate hardware while gateway is offline."
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={reconnect}
            >
              <RefreshCw className="h-3 w-3" />
              Reconnect Gateway
            </Button>
          </div>
        ) : connectionStatus === "CONNECTING" ? (
          <StateOverlay
            variant="loading"
            lotusSize={56}
            title="Authenticating"
            description="Verifying hardware control permissions…"
          />
        ) : (
          <div className="space-y-3">
            {/* Irrigation Pump */}
            <HardwareToggle
              target="pump"
              icon={<Pipette className="h-3.5 w-3.5 text-blue-400" />}
              label="Pump"
              activeLabel="ACTIVE"
              inactiveLabel="STANDBY"
              activeAction="start"
              inactiveAction="stop"
              isActive={pumpActive}
              isOnline={isOnline}
              command={pendingCommands.pump}
              onDispatch={dispatchHardwareCommand}
            />

            {/* Solenoid Valve */}
            <HardwareToggle
              target="valve"
              icon={<Power className="h-3.5 w-3.5 text-amber-400" />}
              label="Valve"
              activeLabel="OPEN"
              inactiveLabel="CLOSED"
              activeAction="open"
              inactiveAction="close"
              isActive={valveOpen}
              isOnline={isOnline}
              command={pendingCommands.valve}
              onDispatch={dispatchHardwareCommand}
            />

            {/* Trust model explanation */}
            <div className="rounded-md border border-border/20 bg-zinc-900/40 p-2.5 space-y-1">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                ⚠ Commands follow the trust pipeline:
              </p>
              <p className="text-[9px] font-mono text-muted-foreground/60 leading-relaxed">
                INTENT → SENT → CONTROLLER ACK → CONFIRMED
              </p>
              <p className="text-[9px] text-muted-foreground/40 leading-relaxed">
                State only updates after hardware confirmation.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
