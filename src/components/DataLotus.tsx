import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────
// Geometric lotus SVG — sacred-geometry-inspired wireframe
// ────────────────────────────────────────────────────────────────
//
// Design: 3 concentric rings of petals + center seed.
// All paths use `currentColor` so Tailwind text-color classes
// control the stroke (e.g. text-emerald-500 for healthy).
//
// Animations are driven by className:
//   - "animate-lotus-spin"  → slow rotation (loading)
//   - "animate-lotus-pulse" → subtle glow (connected/idle)
//   - static + opacity      → dimmed (error/disconnected)

export type LotusState = "loading" | "idle" | "error" | "offline";

interface DataLotusProps {
  state?: LotusState;
  size?: number;
  className?: string;
}

// Petal path templates (origin-centered, pointing up along Y-axis)
const PETAL_INNER = "M0,-5 C2.5,-10 3,-18 0,-24 C-3,-18 -2.5,-10 0,-5Z";
const PETAL_MID = "M0,-7 C3.5,-14 4.5,-26 0,-34 C-4.5,-26 -3.5,-14 0,-7Z";
const PETAL_OUTER = "M0,-9 C4.5,-18 5.5,-34 0,-44 C-5.5,-34 -4.5,-18 0,-9Z";

const INNER_ANGLES = [0, 60, 120, 180, 240, 300];
const MID_ANGLES = [30, 90, 150, 210, 270, 330];
const OUTER_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const stateStyles: Record<LotusState, string> = {
  loading: "text-amber-400 animate-lotus-spin",
  idle: "text-emerald-500/70 animate-lotus-pulse",
  error: "text-red-500/50",
  offline: "text-zinc-600/40",
};

export function DataLotus({ state = "idle", size = 96, className }: DataLotusProps) {
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "transition-all duration-700 ease-in-out",
        stateStyles[state],
        className
      )}
      aria-label={`Data Lotus — ${state}`}
    >
      {/* ── Center seed ─────────────────────────── */}
      <circle r="3" strokeWidth="1.2" opacity="0.9" />
      <circle r="1" strokeWidth="0.8" fill="currentColor" opacity="0.6" />

      {/* ── Inner ring — 6 petals ────────────────── */}
      <g strokeWidth="0.8" opacity="0.5">
        {INNER_ANGLES.map((angle) => (
          <path key={`i-${angle}`} d={PETAL_INNER} transform={`rotate(${angle})`} />
        ))}
      </g>

      {/* ── Middle ring — 6 petals (offset 30°) ──── */}
      <g strokeWidth="0.7" opacity="0.7">
        {MID_ANGLES.map((angle) => (
          <path key={`m-${angle}`} d={PETAL_MID} transform={`rotate(${angle})`} />
        ))}
      </g>

      {/* ── Outer ring — 8 petals ────────────────── */}
      <g strokeWidth="0.6" opacity="0.85">
        {OUTER_ANGLES.map((angle) => (
          <path key={`o-${angle}`} d={PETAL_OUTER} transform={`rotate(${angle})`} />
        ))}
      </g>

      {/* ── Geometric accent rings ───────────────── */}
      <circle r="8" strokeWidth="0.3" opacity="0.2" strokeDasharray="2 3" />
      <circle r="26" strokeWidth="0.3" opacity="0.15" strokeDasharray="1.5 4" />
      <circle r="46" strokeWidth="0.25" opacity="0.1" strokeDasharray="1 5" />
    </svg>
  );
}
