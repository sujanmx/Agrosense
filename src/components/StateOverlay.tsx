import { cn } from "@/lib/utils";
import { DataLotus, type LotusState } from "@/components/DataLotus";

// ────────────────────────────────────────────────────────────────
// StateOverlay — beautiful empty/loading/error states
// ────────────────────────────────────────────────────────────────

type OverlayVariant = "loading" | "empty" | "error" | "disconnected";

interface StateOverlayProps {
  variant: OverlayVariant;
  title?: string;
  description?: string;
  className?: string;
  lotusSize?: number;
}

const defaults: Record<OverlayVariant, { title: string; description: string; lotus: LotusState }> = {
  loading: {
    title: "Initializing Module",
    description: "Establishing connection to IoT gateway…",
    lotus: "loading",
  },
  empty: {
    title: "Awaiting Data",
    description: "No telemetry received yet. Sensors are being calibrated.",
    lotus: "idle",
  },
  error: {
    title: "Module Error",
    description: "An unexpected error occurred. Attempting auto-recovery.",
    lotus: "error",
  },
  disconnected: {
    title: "Hardware Offline",
    description: "Connection lost. Check sensor wiring and gateway power.",
    lotus: "offline",
  },
};

export function StateOverlay({
  variant,
  title,
  description,
  className,
  lotusSize = 80,
}: StateOverlayProps) {
  const config = defaults[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-8 px-4 text-center",
        "select-none",
        className
      )}
    >
      <DataLotus state={config.lotus} size={lotusSize} />

      <div className="space-y-1.5 max-w-[240px]">
        <p className="text-sm font-semibold text-foreground/80 tracking-tight">
          {title ?? config.title}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description ?? config.description}
        </p>
      </div>

      {/* Subtle animated dots for loading state */}
      {variant === "loading" && (
        <div className="flex gap-1.5 mt-1">
          <span className="h-1 w-1 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
        </div>
      )}
    </div>
  );
}
