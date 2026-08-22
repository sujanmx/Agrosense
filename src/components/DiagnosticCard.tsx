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
  Camera,
} from "lucide-react";
import type { DiagnosisSeverity } from "@/types";

// ────────────────────────────────────────────────────────────────
// DiagnosticCard — AI Observation panel below the camera viewport
// ────────────────────────────────────────────────────────────────
//
// Communicates the full trust pipeline:
//   OBSERVATION → CONFIDENCE → CONTEXT → RECOMMENDATION
//
// This component reads from the Zustand store directly so it
// can correlate AI predictions with environmental telemetry.

// ── Recommendation engine (mock) ────────────────────────────────

interface Recommendation {
  text: string;
  priority: "info" | "action" | "urgent";
}

function getRecommendation(
  label: string,
  confidence: number,
  tier: ConfidenceTier,
  humidity: number,
): Recommendation {
  // Insufficient confidence
  if (tier === "insufficient") {
    return {
      text: "Image quality may be insufficient. Try capturing another image with better lighting.",
      priority: "info",
    };
  }

  // Low confidence
  if (tier === "low") {
    return {
      text: "Capture another image for better accuracy. Ensure the leaf fills the frame.",
      priority: "info",
    };
  }

  const lower = label.toLowerCase();

  // Healthy results
  if (lower.includes("healthy") || lower.includes("normal")) {
    return {
      text: "No intervention needed. Continue monitoring on schedule.",
      priority: "info",
    };
  }

  // No clear detection
  if (lower.includes("no clear")) {
    return {
      text: "No plant material detected. Reposition the camera to capture a clear leaf sample.",
      priority: "info",
    };
  }

  // Disease-specific recommendations
  if (lower.includes("blight")) {
    return {
      text: humidity > 65
        ? "Inspect affected leaves. High humidity may accelerate spread — consider improving ventilation."
        : "Inspect affected leaves. Remove severely damaged foliage and monitor adjacent plants.",
      priority: confidence > 0.80 ? "urgent" : "action",
    };
  }

  if (lower.includes("mildew")) {
    return {
      text: "Inspect leaf surfaces for white powdery coating. Improve air circulation around affected plants.",
      priority: "action",
    };
  }

  if (lower.includes("pest") || lower.includes("aphid")) {
    return {
      text: "Check undersides of leaves for pest colonies. Consider targeted biological or chemical control.",
      priority: "action",
    };
  }

  if (lower.includes("nutrient") || lower.includes("deficiency")) {
    return {
      text: "Review recent soil test results. Adjust fertilization schedule based on deficiency indicators.",
      priority: "action",
    };
  }

  return {
    text: "Inspect the identified area manually to verify this observation.",
    priority: "action",
  };
}

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

// ── Confidence bar ──────────────────────────────────────────────

function ConfidenceBar({ confidence, tier }: { confidence: number; tier: ConfidenceTier }) {
  const barColor = {
    high: "bg-emerald-500",
    medium: "bg-amber-500",
    low: "bg-orange-500",
    insufficient: "bg-zinc-500",
  }[tier];

  const tierLabel = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    insufficient: "Insufficient evidence",
  }[tier];

  return (
    <div className="space-y-1" role="meter" aria-label="AI confidence" aria-valuenow={Math.round(confidence * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          {tierLabel}
        </span>
        <span className="text-[11px] font-mono font-bold text-foreground">
          {(confidence * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${Math.min(100, confidence * 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Priority icon ───────────────────────────────────────────────

function PriorityIcon({ priority }: { priority: "info" | "action" | "urgent" }) {
  switch (priority) {
    case "urgent":
      return <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    case "action":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    case "info":
      return <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />;
  }
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
          <Camera className="h-4 w-4 animate-pulse" />
          <span className="text-xs">Awaiting first observation…</span>
        </div>
      </div>
    );
  }

  const severity = deriveSeverity(diagnosis.label, diagnosis.confidence);
  const tier = deriveConfidenceTier(diagnosis.confidence);
  const hedged = hedgeLabel(diagnosis.label, tier);
  const recommendation = getRecommendation(
    diagnosis.label,
    diagnosis.confidence,
    tier,
    humidity,
  );

  // No clear detection state
  const isNoDetection = diagnosis.label.toLowerCase().includes("no clear");

  // Severity accent
  const accentColor = {
    healthy: "border-l-emerald-500/50",
    warning: "border-l-amber-500/50",
    critical: "border-l-red-500/50",
  }[severity];

  return (
    <div
      className={`rounded-lg border border-border/30 bg-zinc-900/40 border-l-2 ${accentColor} transition-colors duration-300`}
      role="region"
      aria-label="AI Observation"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 flex items-start gap-2.5">
        <SeverityIcon severity={severity} tier={tier} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              AI Observation
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground tracking-tight mt-0.5">
            {isNoDetection ? (
              <span className="flex items-center gap-1.5">
                <ImageOff className="h-3.5 w-3.5 text-zinc-400 inline" />
                No Clear Detection
              </span>
            ) : (
              hedged
            )}
          </p>
        </div>
        {/* Timestamp */}
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60 font-mono shrink-0">
          <Clock className="h-2.5 w-2.5" />
          {diagnosis.timestamp.toLocaleTimeString()}
        </div>
      </div>

      {/* ── Confidence ─────────────────────────────────────── */}
      <div className="px-3 pb-2">
        <ConfidenceBar confidence={diagnosis.confidence} tier={tier} />
      </div>

      {/* ── Environmental context (if telemetry available) ──── */}
      {temperature > 0 && (
        <div className="px-3 pb-2">
          <div className="rounded-md bg-zinc-900/60 border border-border/20 px-2.5 py-1.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
              Environmental context
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
                  <span className="text-amber-400 text-[8px] ml-0.5">▲ HIGH</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recommendation ─────────────────────────────────── */}
      <div className="px-3 pb-3">
        <div className="flex items-start gap-2">
          <PriorityIcon priority={recommendation.priority} />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
              Recommended action
            </p>
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              {recommendation.text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
