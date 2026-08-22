import { useAppStore } from "@/store";
import {
  DiagnosticBadge,
  deriveSeverity,
  deriveConfidenceTier,
  hedgeLabel,
} from "@/components/DiagnosticBadge";
import { Badge } from "@/components/ui/badge";
import { Cpu, BarChart3 } from "lucide-react";

// ────────────────────────────────────────────────────────────────
// AIOverlay — bounding box + diagnostic badge over the video
// ────────────────────────────────────────────────────────────────
//
// Design principles:
//   - Plant remains the visual hero; overlays are restrained
//   - Bounding boxes use normalized coordinates (0–1) for resize safety
//   - Confidence tier affects visual treatment (solid/dashed/dotted)
//   - Labels on bounding boxes are compact and positioned at the top

export function AIOverlay() {
  const diagnosis = useAppStore((s) => s.currentDiagnosis);
  const inferenceCount = useAppStore((s) => s.inferenceCount);
  const renderCount = useAppStore((s) => s.renderCount);
  const inferenceStatus = useAppStore((s) => s.inferenceStatus);

  if (!diagnosis && inferenceStatus !== "active") return null;

  const severity = diagnosis
    ? deriveSeverity(diagnosis.label, diagnosis.confidence)
    : "healthy";

  const tier = diagnosis
    ? deriveConfidenceTier(diagnosis.confidence)
    : "high";

  // Border color based on severity — only for the viewport frame
  const frameBorderColor = {
    healthy: "border-emerald-500/30",
    warning: "border-amber-500/30",
    critical: "border-red-500/40",
  }[severity];

  // Bounding box border — more visible than frame
  const boxBorderColor = {
    healthy: "border-emerald-500/60",
    warning: "border-amber-500/60",
    critical: "border-red-500/70",
  }[severity];

  // Bounding box border style based on confidence tier
  const boxBorderStyle = {
    high: "",
    medium: "",
    low: "border-dashed",
    insufficient: "border-dotted",
  }[tier];

  // Box text color
  const boxTextColor = {
    healthy: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  }[severity];

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* ── Bounding box (if present) ───────────────────────── */}
      {diagnosis?.boundingBox && (
        <div
          className={`absolute border-2 rounded-sm transition-all duration-300 ${boxBorderColor} ${boxBorderStyle}`}
          style={{
            left: `${diagnosis.boundingBox.x * 100}%`,
            top: `${diagnosis.boundingBox.y * 100}%`,
            width: `${diagnosis.boundingBox.width * 100}%`,
            height: `${diagnosis.boundingBox.height * 100}%`,
          }}
        >
          {/* Corner markers */}
          <div className="absolute -top-px -left-px h-3 w-3 border-l-2 border-t-2 border-current rounded-tl-sm" />
          <div className="absolute -top-px -right-px h-3 w-3 border-r-2 border-t-2 border-current rounded-tr-sm" />
          <div className="absolute -bottom-px -left-px h-3 w-3 border-l-2 border-b-2 border-current rounded-bl-sm" />
          <div className="absolute -bottom-px -right-px h-3 w-3 border-r-2 border-b-2 border-current rounded-br-sm" />

          {/* Inline label — anchored to top of bounding box */}
          <div className="absolute -top-6 left-0 flex items-center gap-1">
            <span
              className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-sm backdrop-blur-sm bg-zinc-900/80 ${boxTextColor}`}
            >
              {hedgeLabel(diagnosis.label, tier)}
            </span>
            <span className="text-[8px] font-mono text-muted-foreground bg-zinc-900/70 px-1 py-0.5 rounded-sm backdrop-blur-sm">
              {(diagnosis.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* ── Subtle status border (full viewport) ──────────────
           Only shown for anomaly detections — keeps calm otherwise */}
      {diagnosis?.isAnomaly && (
        <div
          className={`absolute inset-0 border rounded-lg transition-colors duration-500 ${frameBorderColor}`}
        />
      )}

      {/* ── Diagnosis badge (bottom-left) ───────────────────── */}
      {diagnosis && (
        <div className="absolute bottom-3 left-3 pointer-events-auto">
          <DiagnosticBadge
            label={diagnosis.label}
            confidence={diagnosis.confidence}
            severity={severity}
          />
        </div>
      )}

      {/* ── Performance counters (top-right) ────────────────── */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
        <Badge
          variant="outline"
          className="text-[9px] gap-1 border-zinc-700/50 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm font-mono"
        >
          <Cpu className="h-2.5 w-2.5" />
          INF: {inferenceCount}
        </Badge>
        <Badge
          variant="outline"
          className="text-[9px] gap-1 border-zinc-700/50 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm font-mono"
        >
          <BarChart3 className="h-2.5 w-2.5" />
          RND: {renderCount}
        </Badge>
      </div>

      {/* ── Analyzing indicator (top-left) ──────────────────── */}
      {inferenceStatus === "active" && (
        <div className="absolute top-3 left-3">
          <Badge
            variant="outline"
            className="text-[9px] gap-1.5 border-emerald-500/20 bg-zinc-900/70 text-emerald-400 backdrop-blur-sm font-mono"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </Badge>
        </div>
      )}
    </div>
  );
}
