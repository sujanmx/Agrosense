import { cn } from "@/lib/utils";
import type { DiagnosisSeverity } from "@/types";
import { ShieldCheck, ShieldAlert, ShieldX, HelpCircle } from "lucide-react";

// ────────────────────────────────────────────────────────────────
// DiagnosticBadge — AI prediction display with confidence tiers
// ────────────────────────────────────────────────────────────────
//
// Rules:
//   1. AI predictions MUST always display a confidence percentage.
//   2. Low-confidence results MUST use hedging language.
//   3. Visual hierarchy must differ across confidence tiers.

interface DiagnosticBadgeProps {
  label: string;
  confidence: number; // 0-1
  severity: DiagnosisSeverity;
  compact?: boolean;
  className?: string;
}

// ── Confidence tier logic ───────────────────────────────────────

export type ConfidenceTier = "high" | "medium" | "low" | "insufficient";

export function deriveConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.60) return "medium";
  if (confidence >= 0.40) return "low";
  return "insufficient";
}

/**
 * Apply hedging language based on confidence tier.
 * High confidence: label as-is.
 * Medium: "Likely {label}".
 * Low: "Possible {label}".
 * Insufficient: "Uncertain — {label}".
 */
export function hedgeLabel(label: string, tier: ConfidenceTier): string {
  // Don't hedge healthy/normal labels or "No Clear Detection"
  const lower = label.toLowerCase();
  if (lower.includes("healthy") || lower.includes("normal") || lower.includes("no clear")) {
    return label;
  }

  switch (tier) {
    case "high":
      return label;
    case "medium":
      return `Likely ${label}`;
    case "low":
      return `Possible ${label}`;
    case "insufficient":
      return `Uncertain — ${label}`;
  }
}

// ── Severity config ─────────────────────────────────────────────

const severityConfig: Record<
  DiagnosisSeverity,
  { bg: string; border: string; text: string; icon: typeof ShieldCheck }
> = {
  healthy: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
    icon: ShieldCheck,
  },
  warning: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-400",
    icon: ShieldAlert,
  },
  critical: {
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-400",
    icon: ShieldX,
  },
};

// ── Confidence tier visual config ───────────────────────────────

const tierConfig: Record<
  ConfidenceTier,
  { borderStyle: string; opacity: string; indicator: string }
> = {
  high: {
    borderStyle: "",
    opacity: "",
    indicator: "",
  },
  medium: {
    borderStyle: "",
    opacity: "opacity-90",
    indicator: "border-dashed",
  },
  low: {
    borderStyle: "border-dashed",
    opacity: "opacity-75",
    indicator: "border-dashed",
  },
  insufficient: {
    borderStyle: "border-dotted",
    opacity: "opacity-60",
    indicator: "border-dotted",
  },
};

// ── Component ───────────────────────────────────────────────────

export function DiagnosticBadge({
  label,
  confidence,
  severity,
  compact = false,
  className,
}: DiagnosticBadgeProps) {
  const config = severityConfig[severity];
  const tier = deriveConfidenceTier(confidence);
  const tierVis = tierConfig[tier];
  const hedged = hedgeLabel(label, tier);
  const Icon = tier === "insufficient" ? HelpCircle : config.icon;
  const pct = (confidence * 100).toFixed(1);

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
          "backdrop-blur-md shadow-lg",
          "transition-all duration-300 ease-out",
          config.bg,
          config.border,
          tierVis.borderStyle,
          tierVis.opacity,
          className
        )}
        role="status"
        aria-label={`${hedged}, ${pct}% confidence`}
      >
        <Icon className={cn("h-3 w-3 shrink-0", config.text)} />
        <span className={cn("text-[10px] font-semibold leading-tight", config.text)}>
          {hedged}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground">
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5",
        "backdrop-blur-md shadow-lg",
        "transition-all duration-300 ease-out",
        config.bg,
        config.border,
        tierVis.borderStyle,
        tierVis.opacity,
        className
      )}
      role="status"
      aria-label={`${hedged}, ${pct}% confidence`}
    >
      <Icon className={cn("h-4 w-4 shrink-0", config.text)} />
      <div className="flex flex-col gap-0">
        <span className={cn("text-xs font-semibold leading-tight", config.text)}>
          {hedged}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground leading-tight">
          {pct}% confidence
        </span>
      </div>
    </div>
  );
}

/**
 * Derive severity from diagnosis label and confidence.
 * Separates confidence level from severity: a high-confidence
 * healthy result is "healthy" severity, not "critical".
 */
export function deriveSeverity(
  label: string,
  confidence: number
): DiagnosisSeverity {
  const lower = label.toLowerCase();

  // Healthy/normal → always healthy severity regardless of confidence
  if (lower.includes("healthy") || lower.includes("normal")) {
    return "healthy";
  }

  // No clear detection → healthy (nothing alarming found)
  if (lower.includes("no clear")) {
    return "healthy";
  }

  // Known severe conditions
  if (
    lower.includes("blight") ||
    lower.includes("rot") ||
    lower.includes("wilt")
  ) {
    return confidence > 0.70 ? "critical" : "warning";
  }

  // Everything else is a warning
  return "warning";
}
