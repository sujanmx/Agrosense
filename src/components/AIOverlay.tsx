import { useAppStore } from "@/store";
import {
  DiagnosticBadge,
  deriveSeverity,
  deriveConfidenceTier,
  hedgeLabel,
} from "@/components/DiagnosticBadge";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BarChart3, Clock } from "lucide-react";

// ────────────────────────────────────────────────────────────────
// AIOverlay — bounding box + diagnostic badge over the video/image
// ────────────────────────────────────────────────────────────────
//
// Rules:
//   - Bounding boxes strictly use validated normalized coordinates [0.0, 1.0]
//   - If provider returned null for boundingBox, NO box is drawn (fail-closed)
//   - Box is explicitly labeled with provider identity ("Gemini Vision" / "ONNX Detector")
//   - Confidence tier controls visual treatment (solid/dashed/dotted)

export function AIOverlay() {
  const diagnosis = useAppStore((s) => s.currentDiagnosis);
  const renderCount = useAppStore((s) => s.renderCount);
  const inferenceStatus = useAppStore((s) => s.inferenceStatus);

  if (!diagnosis && inferenceStatus !== "active" && inferenceStatus !== "success") return null;

  const providerName = diagnosis?.provider === "onnx" ? "ONNX Detector" : "Gemini Vision";

  const severity = diagnosis
    ? (diagnosis.severity === "severe"
        ? "critical"
        : diagnosis.severity === "moderate" || diagnosis.severity === "mild"
          ? "warning"
          : deriveSeverity(diagnosis.label, diagnosis.confidence))
    : "healthy";

  const tier = diagnosis
    ? deriveConfidenceTier(diagnosis.confidence)
    : "high";

  // Border color based on severity
  const frameBorderColor = {
    healthy: "border-emerald-500/30",
    warning: "border-amber-500/30",
    critical: "border-red-500/40",
  }[severity];

  const boxBorderColor = {
    healthy: "border-emerald-500/80",
    warning: "border-amber-500/80",
    critical: "border-red-500/90",
  }[severity];

  const boxBorderStyle = {
    high: "",
    medium: "",
    low: "border-dashed",
    insufficient: "border-dotted",
  }[tier];

  const boxTextColor = {
    healthy: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
  }[severity];

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* ── Bounding box (strictly from provider output; NO fake box) ───────── */}
      {diagnosis?.boundingBox && (
        <div
          className={`absolute border-2 rounded-sm transition-all duration-300 ${boxBorderColor} ${boxBorderStyle} shadow-[0_0_12px_rgba(0,0,0,0.5)]`}
          style={{
            left: `${Math.max(0, Math.min(100, diagnosis.boundingBox.x * 100))}%`,
            top: `${Math.max(0, Math.min(100, diagnosis.boundingBox.y * 100))}%`,
            width: `${Math.max(2, Math.min(100, diagnosis.boundingBox.width * 100))}%`,
            height: `${Math.max(2, Math.min(100, diagnosis.boundingBox.height * 100))}%`,
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
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-md bg-zinc-950/90 border border-border/40 ${boxTextColor}`}
            >
              {providerName}: {hedgeLabel(diagnosis.label, tier)}
            </span>
            <span className="text-[8px] font-mono text-zinc-300 bg-zinc-950/80 px-1 py-0.5 rounded-sm backdrop-blur-md border border-border/30">
              {(diagnosis.confidence * 100).toFixed(1)}% conf
            </span>
          </div>
        </div>
      )}

      {/* ── Subtle status border (full viewport on anomaly) ── */}
      {diagnosis?.isAnomaly && (
        <div
          className={`absolute inset-0 border-2 rounded-lg transition-colors duration-500 ${frameBorderColor} pointer-events-none`}
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

      {/* ── Engine & Latency badge (top-right) ─────────────── */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end pointer-events-auto">
        <Badge
          variant="outline"
          className="text-[9px] gap-1 border-emerald-500/40 bg-zinc-950/90 text-emerald-400 backdrop-blur-md font-mono"
        >
          <Sparkles className="h-2.5 w-2.5" />
          {providerName.toUpperCase()}
        </Badge>
        {diagnosis?.latencyMs !== undefined && diagnosis.latencyMs > 0 && (
          <Badge
            variant="outline"
            className="text-[9px] gap-1 border-zinc-700/50 bg-zinc-950/80 text-zinc-400 backdrop-blur-md font-mono"
          >
            <Clock className="h-2.5 w-2.5" />
            {diagnosis.latencyMs} ms
          </Badge>
        )}
        <Badge
          variant="outline"
          className="text-[9px] gap-1 border-zinc-700/50 bg-zinc-950/80 text-zinc-400 backdrop-blur-md font-mono"
        >
          <BarChart3 className="h-2.5 w-2.5" />
          RND: {renderCount}
        </Badge>
      </div>
    </div>
  );
}
