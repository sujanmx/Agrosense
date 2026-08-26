import { useAppStore } from "@/store";
import {
  deriveSeverity,
  deriveConfidenceTier,
  hedgeLabel,
  type ConfidenceTier,
} from "@/components/DiagnosticBadge";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  HelpCircle,
  Droplets,
  Thermometer,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  Sparkles,
  Info,
} from "lucide-react";
import type { DiagnosisSeverity } from "@/types";

// ────────────────────────────────────────────────────────────────
// DiagnosticCard — Production AI Observation Panel (Phase 10)
// ────────────────────────────────────────────────────────────────
//
// Communicates the full trust pipeline:
//   PROVIDER IDENTITY → OBSERVATION → CONFIDENCE → CONTEXT → EVIDENCE → RECOMMENDATION
//
// Strictly avoids claiming laboratory certainty or experimental accuracy on single frames.

// ── Severity icon ───────────────────────────────────────────────

function SeverityIcon({ severity, tier }: { severity: DiagnosisSeverity; tier: ConfidenceTier }) {
  if (tier === "insufficient") {
    return <HelpCircle className="h-5 w-5 text-zinc-400" />;
  }

  const icons = {
    healthy: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
    warning: <ShieldAlert className="h-5 w-5 text-amber-400" />,
    critical: <ShieldX className="h-5 w-5 text-red-400" />,
  };

  return icons[severity];
}

// ── AI Confidence Estimate Bar ──────────────────────────────────

function ConfidenceBar({ confidence, tier }: { confidence: number; tier: ConfidenceTier }) {
  const barColor = {
    high: "bg-emerald-500",
    medium: "bg-amber-500",
    low: "bg-orange-500",
    insufficient: "bg-zinc-500",
  }[tier];

  const tierLabel = {
    high: "High Confidence",
    medium: "Medium Confidence",
    low: "Low Confidence",
    insufficient: "Insufficient Visual Evidence",
  }[tier];

  return (
    <div className="space-y-1" role="meter" aria-label="AI confidence estimate" aria-valuenow={Math.round(confidence * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          AI Confidence Estimate ({tierLabel})
        </span>
        <span className="text-[11px] font-mono font-bold text-foreground">
          {(confidence * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, confidence * 100))}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────

export function DiagnosticCard() {
  const diagnosis = useAppStore((s) => s.currentDiagnosis);
  const temperature = useAppStore((s) => s.temperature);
  const humidity = useAppStore((s) => s.humidity);

  // No diagnosis yet — show waiting state
  if (!diagnosis) {
    return (
      <div className="rounded-lg border border-border/30 bg-zinc-900/40 p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4 text-emerald-400/60 animate-pulse" />
          <span className="text-xs">Awaiting plant snapshot analysis…</span>
        </div>
      </div>
    );
  }

  const providerName = diagnosis.provider === "onnx" ? "ONNX Edge Model (v2)" : "Gemini Vision (Cloud Primary)";

  const severity: DiagnosisSeverity = diagnosis.severity === "severe"
    ? "critical"
    : diagnosis.severity === "moderate" || diagnosis.severity === "mild"
      ? "warning"
      : deriveSeverity(diagnosis.label, diagnosis.confidence);

  const tier = deriveConfidenceTier(diagnosis.confidence);
  const hedged = hedgeLabel(diagnosis.label, tier);

  // No clear detection state
  const isNoDetection =
    diagnosis.label.toLowerCase().includes("no clear") ||
    diagnosis.label.toLowerCase().includes("unknown") ||
    diagnosis.plantDetected === false;

  // Severity accent
  const accentColor = {
    healthy: "border-l-emerald-500/60",
    warning: "border-l-amber-500/60",
    critical: "border-l-red-500/60",
  }[severity];

  const severityBadgeColor = {
    healthy: "bg-emerald-950/60 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-950/60 text-amber-300 border-amber-500/30",
    critical: "bg-red-950/60 text-red-300 border-red-500/30",
  }[severity];

  return (
    <div
      className={`rounded-lg border border-border/30 bg-zinc-900/40 border-l-4 ${accentColor} transition-colors duration-300 space-y-2.5`}
      role="region"
      aria-label="AI Observation"
    >
      {/* ── Header: Provider Identity + Title ─────────────────────────── */}
      <div className="px-3 pt-3 flex items-start justify-between border-b border-border/20 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400">
                AI Engine:
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                {providerName}
              </span>
            </div>
            {diagnosis.plantSpecies && (
              <span className="text-[11px] text-zinc-300 font-medium">
                Host Crop: {diagnosis.plantSpecies}
              </span>
            )}
          </div>
        </div>

        {/* Timestamp + Latency */}
        <div className="flex flex-col items-end text-[9px] text-muted-foreground/80 font-mono">
          <div className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {diagnosis.timestamp ? new Date(diagnosis.timestamp).toLocaleTimeString() : ""}
          </div>
          {diagnosis.latencyMs !== undefined && (
            <span className="text-[8px] text-zinc-500">
              {diagnosis.latencyMs} ms latency
            </span>
          )}
        </div>
      </div>

      {/* ── Diagnosis Title + Taxonomy ─────────────────────────────────── */}
      <div className="px-3 flex items-start gap-2.5">
        <SeverityIcon severity={severity} tier={tier} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground tracking-tight">
            {isNoDetection ? (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <ImageOff className="h-4 w-4 text-zinc-400 inline" />
                No Clear Plant / Disease Detection
              </span>
            ) : (
              hedged
            )}
          </p>

          {diagnosis.scientificName && (
            <p className="text-[11px] italic text-zinc-400 font-serif mt-0.5">
              {diagnosis.scientificName}
            </p>
          )}

          {diagnosis.diseaseClass && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-border/30">
                Taxonomy: {diagnosis.diseaseClass}
              </span>
              {diagnosis.severity && (
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${severityBadgeColor}`}>
                  Severity: {diagnosis.severity}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Confidence Estimate Bar ───────────────────────────────────── */}
      <div className="px-3">
        <ConfidenceBar confidence={diagnosis.confidence} tier={tier} />
      </div>

      {/* ── Visual Evidence (from Gemini Vision) ───────────────────────── */}
      {diagnosis.visualEvidence && (
        <div className="px-3">
          <div className="rounded-md bg-zinc-950/50 border border-border/20 px-2.5 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Info className="h-3 w-3 text-blue-400 shrink-0" />
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
                Visual Evidence
              </p>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              {diagnosis.visualEvidence}
            </p>
          </div>
        </div>
      )}

      {/* ── Environmental context (if telemetry available) ────────────── */}
      {temperature > 0 && (
        <div className="px-3">
          <div className="rounded-md bg-zinc-900/60 border border-border/20 px-2.5 py-1.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
              Environmental Context
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                <Thermometer className="h-3 w-3 text-orange-400" />
                {temperature.toFixed(1)}°C
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                <Droplets className="h-3 w-3 text-blue-400" />
                {humidity.toFixed(1)}% RH
                {humidity > 70 && (
                  <span className="text-amber-400 text-[8px] ml-0.5">▲ HIGH RISK</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recommendation ───────────────────────────────────────────── */}
      {diagnosis.recommendation && (
        <div className="px-3 pb-3">
          <div className="flex items-start gap-2 rounded-md bg-emerald-950/20 border border-emerald-500/20 p-2">
            {severity === "critical" ? (
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            ) : severity === "warning" ? (
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-emerald-400 uppercase tracking-wider font-medium mb-0.5">
                Pathologist Recommendation
              </p>
              <p className="text-[11px] text-foreground/90 leading-relaxed">
                {diagnosis.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
