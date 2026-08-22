import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { DashboardLayout } from "@/components/DashboardLayout";
import { VisionModule } from "@/components/panels/VisionModule";
import { TelemetryPanel } from "@/components/panels/TelemetryPanel";
import { PumpControl } from "@/components/panels/PumpControl";
import { StateOverlay } from "@/components/StateOverlay";
import { DataLotus } from "@/components/DataLotus";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

// ────────────────────────────────────────────────────────────────
// Gallery — DataLotus state showcase (Part 2 deliverable)
// ────────────────────────────────────────────────────────────────

function LotusGallery() {
  return (
    <Card className="border-border/50 bg-zinc-950/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">DataLotus States</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {(["loading", "idle", "error", "offline"] as const).map((state) => (
            <div
              key={state}
              className="rounded-lg border border-border/30 bg-zinc-900/40 p-3 flex flex-col items-center gap-2"
            >
              <DataLotus state={state} size={48} />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                {state}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// StateOverlay gallery
// ────────────────────────────────────────────────────────────────

function OverlayGallery() {
  return (
    <Card className="border-border/50 bg-zinc-950/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Empty State Gallery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["loading", "empty", "error", "disconnected"] as const).map((variant) => (
          <div
            key={variant}
            className="rounded-lg border border-border/30 bg-zinc-900/40 p-2"
          >
            <StateOverlay variant={variant} lotusSize={48} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────────────────────

export function App() {
  return (
    <WebSocketProvider>
      <DashboardLayout
        left={<TelemetryPanel />}
        center={<VisionModule />}
        right={
          <>
            <PumpControl />
            <LotusGallery />
            <OverlayGallery />
          </>
        }
      />
    </WebSocketProvider>
  );
}
