import type { ReactNode } from "react";
import { SystemHealthTicker } from "@/components/SystemHealthTicker";
import { DataLotus } from "@/components/DataLotus";
import { Cpu, Leaf } from "lucide-react";

// ────────────────────────────────────────────────────────────────
// DashboardLayout — responsive application shell
// ────────────────────────────────────────────────────────────────
//
// Structure:
//   ┌─────────────────────────────────────────────┐
//   │  Top Bar  (logo + SystemHealthTicker)       │
//   ├──────────┬────────────────────┬─────────────┤
//   │ Left col │   Center (large)   │  Right col  │  ← Desktop
//   │ Sensors  │   Camera Feed      │  Controls   │
//   └──────────┴────────────────────┴─────────────┘
//
// Mobile: single column, center panel first (order-first).

interface DashboardLayoutProps {
  /** Left sidebar content (sensor telemetry) */
  left?: ReactNode;
  /** Center main content (vision/camera feed) */
  center?: ReactNode;
  /** Right sidebar content (pump/hardware controls) */
  right?: ReactNode;
}

export function DashboardLayout({ left, center, right }: DashboardLayoutProps) {
  return (
    <div className="dark min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Top Navigation Bar ─────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-zinc-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          {/* Logo + title */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <DataLotus state="idle" size={28} className="text-emerald-500/80" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-foreground">
                  AgroSense
                </h1>
              </div>
              <p className="hidden sm:block text-[10px] text-muted-foreground leading-none">
                Smart Agriculture IoT Dashboard
              </p>
            </div>
          </div>

          {/* System health ticker */}
          <div className="flex items-center gap-3">
            <SystemHealthTicker />
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground border-l border-border/40 pl-3">
              <Cpu className="h-3 w-3" />
              <span className="font-mono">ESP32</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Leaf className="h-3 w-3" />
              <span className="font-mono">v1.0.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Grid ─────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-[1400px] p-4 lg:p-6">
        <div
          className="grid gap-4 lg:gap-5
            grid-cols-1
            lg:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)]
            auto-rows-min"
        >
          {/* Center — camera feed (order-first on mobile) */}
          <div className="order-first lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
            {center}
          </div>

          {/* Left — sensor telemetry */}
          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 space-y-4 lg:space-y-5">
            {left}
          </div>

          {/* Right — hardware controls */}
          <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2 space-y-4 lg:space-y-5">
            {right}
          </div>
        </div>
      </main>

      {/* ── Bottom status bar ─────────────────────────────── */}
      <footer className="border-t border-border/30 bg-zinc-950/60">
        <div className="mx-auto flex h-8 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            AI Vision ➔ Telemetry ➔ Hardware Action
          </p>
          <p className="text-[10px] text-muted-foreground/40 font-mono">
            SIH 2025 • Team Dashboard
          </p>
        </div>
      </footer>
    </div>
  );
}
