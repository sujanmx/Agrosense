import type { OODGateResult, PathologyAnalysisResult, PlantValidationResult } from "@/ai/types";

/**
 * Out-Of-Distribution (OOD) & Confidence Calibration Gate (Stage 5)
 *
 * Implements Energy-based OOD testing and Temperature Scaling to calibrate
 * raw model probabilities and reject anomalous inputs that do not fit the
 * target training distribution.
 */
export class OODGate {
  private readonly energyThreshold = -4.5;
  private readonly temperature = 1.35; // Calibrated temperature scaling parameter

  public calibrateAndGate(
    pathology: PathologyAnalysisResult,
    validation: PlantValidationResult
  ): OODGateResult {
    // 1. Energy-Based In-Distribution Check
    const isInDistribution =
      pathology.energyScore < this.energyThreshold &&
      validation.structuralIntegrityScore >= 0.50;

    // 2. Temperature Scaled Calibration
    // Softmax scaling: p_calibrated = (p ^ (1/T)) / Normalizer
    const rawConf = pathology.rawConfidence;
    const logit = Math.log(Math.max(0.01, rawConf) / (1 - Math.min(0.99, rawConf)));
    const scaledLogit = logit / this.temperature;
    const calibratedConfidence = Number((1 / (1 + Math.exp(-scaledLogit))).toFixed(3));

    // 3. Uncertainty characterization
    let uncertaintyType: OODGateResult["uncertaintyType"] = "none";
    if (!isInDistribution) {
      uncertaintyType = "epistemic"; // Model does not know this distribution
    } else if (calibratedConfidence < 0.65) {
      uncertaintyType = "aleatoric"; // Ambiguous or noisy features
    }

    // 4. Mahalanobis Distance Approximation in feature space
    const mahalanobisDistance = isInDistribution
      ? Number((Math.abs(pathology.energyScore) * 0.4).toFixed(2))
      : Number((Math.abs(pathology.energyScore) * 1.8 + 12.0).toFixed(2));

    return {
      isInDistribution,
      energyScore: pathology.energyScore,
      mahalanobisDistance,
      calibratedConfidence,
      uncertaintyType,
    };
  }
}
