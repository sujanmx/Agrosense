import type { BoundingBox } from "@/types";
import type { TemporalSmootherResult } from "@/ai/types";

interface FrameObservation {
  label: string;
  confidence: number;
  isAnomaly: boolean;
  box: BoundingBox | null;
  timestamp: number;
}

/**
 * Multi-Frame Temporal Bayesian Evidential Consistency Tracker (Stage 6)
 *
 * Accumulates Dirichlet evidence over a rolling temporal window ($W = 8$ frames)
 * with exponential decay to filter out transient optical spikes, sensor noise,
 * and single-frame hallucinations.
 */
export class TemporalSmoother {
  private history: FrameObservation[] = [];
  private readonly maxWindowSize = 8;
  private readonly decayFactor = 0.85;

  public processObservation(
    label: string,
    confidence: number,
    isAnomaly: boolean,
    boundingBox: BoundingBox | null
  ): TemporalSmootherResult {
    const now = Date.now();

    // 1. Append current observation
    this.history.push({
      label,
      confidence,
      isAnomaly,
      box: boundingBox,
      timestamp: now,
    });

    // Keep window bounded
    if (this.history.length > this.maxWindowSize) {
      this.history.shift();
    }

    // 2. Accumulate Bayesian Dirichlet Evidence
    const evidenceMap = new Map<string, number>();
    let totalEvidence = 0;
    let weightedAnomalyScore = 0;
    let smoothedBox: BoundingBox | null = null;
    let boxWeightSum = 0;

    const windowLen = this.history.length;

    for (let i = 0; i < windowLen; i++) {
      const obs = this.history[i];
      const age = windowLen - 1 - i;
      const weight = Math.pow(this.decayFactor, age) * obs.confidence;

      const currentEvidence = evidenceMap.get(obs.label) || 0;
      evidenceMap.set(obs.label, currentEvidence + weight);
      totalEvidence += weight;

      if (obs.isAnomaly) {
        weightedAnomalyScore += weight;
      }

      if (obs.box) {
        if (!smoothedBox) {
          smoothedBox = { ...obs.box };
          boxWeightSum = weight;
        } else {
          // Exponential moving average for bounding box coordinates
          smoothedBox.x = (smoothedBox.x * boxWeightSum + obs.box.x * weight) / (boxWeightSum + weight);
          smoothedBox.y = (smoothedBox.y * boxWeightSum + obs.box.y * weight) / (boxWeightSum + weight);
          smoothedBox.width = (smoothedBox.width * boxWeightSum + obs.box.width * weight) / (boxWeightSum + weight);
          smoothedBox.height = (smoothedBox.height * boxWeightSum + obs.box.height * weight) / (boxWeightSum + weight);
          boxWeightSum += weight;
        }
      }
    }

    // 3. Find majority evidence label
    let maxEvidence = 0;
    let stableLabel = label;

    for (const [candidateLabel, ev] of evidenceMap.entries()) {
      if (ev > maxEvidence) {
        maxEvidence = ev;
        stableLabel = candidateLabel;
      }
    }

    const smoothedConfidence = totalEvidence > 0 ? Number((maxEvidence / totalEvidence).toFixed(3)) : confidence;
    const isTemporallyConsistent = this.history.length >= 3 && smoothedConfidence >= 0.65;
    const finalIsAnomaly = weightedAnomalyScore / Math.max(0.01, totalEvidence) > 0.5;

    // Dirichlet uncertainty: u = K / (S + K)
    const K = 3; // Prior count
    const uncertainty = Number((K / (totalEvidence + K)).toFixed(3));
    const belief = Number((1 - uncertainty).toFixed(3));

    return {
      stableLabel,
      smoothedConfidence,
      isAnomaly: finalIsAnomaly,
      boundingBox: smoothedBox ? {
        x: Number(smoothedBox.x.toFixed(3)),
        y: Number(smoothedBox.y.toFixed(3)),
        width: Number(smoothedBox.width.toFixed(3)),
        height: Number(smoothedBox.height.toFixed(3)),
      } : null,
      isTemporallyConsistent,
      frameSampleCount: this.history.length,
      evidentialBelief: {
        belief,
        uncertainty,
      },
    };
  }

  public reset(): void {
    this.history = [];
  }
}
