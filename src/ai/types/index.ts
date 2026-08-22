import type { BoundingBox, DiagnosisResult } from "@/types";

// ─── Execution Mode & Model Truth ───────────────────────────────

export type PerceptionExecutionMode =
  | "neural_onnx"          // Executing real quantized neural network via ONNX Runtime
  | "heuristic_fallback"   // Executing classical CV / photometric heuristics (No weights present)
  | "simulated_benchmark"; // Executing synthetic benchmark frames for offline testing

export interface ModelBackendStatus {
  mode: PerceptionExecutionMode;
  isNeuralModelLoaded: boolean;
  isNeuralClassifierLoaded: boolean;
  isNeuralDetectorLoaded: boolean;
  detectorModelPath: string | null;
  classifierModelPath: string | null;
  detectorExecutionMode: "neural_onnx" | "heuristic";
  classifierExecutionMode: "neural_onnx" | "heuristic";
  executionProvider: "webgpu" | "wasm_simd" | "webgl" | "cpu" | "heuristic_engine";
  inferenceLatencyMs: number;
  lastError: string | null;
}

// ─── Optical & Image Quality Domain ────────────────────────────

export interface OpticalQualityMetrics {
  isAcceptable: boolean;
  brightness: number;          // 0–255 mean luminance
  contrast: number;            // standard deviation of luminance
  blurScore: number;           // Laplacian variance
  exposureStatus: "optimal" | "underexposed" | "overexposed" | "severe_shadow" | "extreme_glare";
  rejectionReason: string | null;
}

// ─── Target Plant Detection & Taxonomic Entities ───────────────

export type DetectedEntityType =
  | "TARGET_CROP_CANOPY"
  | "TARGET_CROP_LEAF"
  | "TARGET_CROP_STEM"
  | "TARGET_CROP_FRUIT"
  | "NON_TARGET_FLORA"       // Weeds, turf, grass, adjacent non-target crops
  | "HARD_NEGATIVE_SOIL"      // Bare ground, mud, clay, gravel
  | "HARD_NEGATIVE_HAND"      // Operator hands, fingers, skin tones
  | "HARD_NEGATIVE_TOOL"      // Hoses, plastic mulch, pruners, stakes
  | "BACKGROUND_NOISE";       // Visual textures, shadows, foreign objects

export interface DetectedPlantInstance {
  id: string;
  entityType: DetectedEntityType;
  isTargetCrop: boolean;
  cropSpecies?: "Tomato" | "Potato" | "Chili" | "Bell Pepper" | "General Crop";
  organType: "leaf" | "stem" | "fruit" | "canopy" | "none";
  confidence: number;          // Raw detector confidence (0-1)
  boundingBox: BoundingBox;   // Normalized coordinates [0, 1]
  structuralScore: number;     // Venation and margin integrity score (0-1)
}

export interface PlantDetectionResult {
  hasTargetPlant: boolean;
  targetInstances: DetectedPlantInstance[];
  suppressedNegatives: DetectedPlantInstance[];
  primaryROI: BoundingBox | null;
  rejectionCode?:
    | "NO_PLANT_IN_FRAME"
    | "SOIL_TEXTURE_REJECTED"
    | "OPERATOR_HAND_REJECTED"
    | "NON_TARGET_WEED_REJECTED"
    | "HARDWARE_TOOL_REJECTED"
    | "POOR_IMAGE_QUALITY"
    | "LOW_STRUCTURAL_CONFIDENCE";
  rejectionMessage?: string;
}

// ─── Plant Validation Domain ────────────────────────────────────

export interface PlantValidationResult {
  isValidated: boolean;
  structuralIntegrityScore: number;  // 0-1 (morphology, venation, contour)
  colorInvariancePassed: boolean;    // Passed desaturation / hue robustness
  isWeedOrGrass: boolean;
  isForeignObject: boolean;
  validationDetails: {
    edgeDensity: number;
    venationCoherence: number;
    chromaRatio: number;
  };
}

// ─── Native ROI Extraction ──────────────────────────────────────

export interface ExtractedROI {
  boundingBox: BoundingBox;
  nativeWidth: number;
  nativeHeight: number;
  imageData?: ImageData;
  aspectRatio: number;
}

// ─── Disease & Pathology Analysis ───────────────────────────────

export type PathologicalCategory =
  | "Healthy Target Crop"
  | "Early Blight (Alternaria solani)"
  | "Late Blight (Phytophthora infestans)"
  | "Powdery Mildew (Oidium neolycopersici)"
  | "Bacterial Spot (Xanthomonas)"
  | "Leaf Mold (Passalora fulva)"
  | "Septoria Leaf Spot"
  | "Nutrient Deficiency (Nitrogen/Potassium)"
  | "Pest Infestation (Aphids/Mites)"
  | "Indeterminate Observation";

export interface PathologyAnalysisResult {
  category: PathologicalCategory;
  rawConfidence: number;      // Softmax probability (0-1)
  severityScore: number;     // 0.0 (negligible) to 1.0 (severe/necrotic)
  lesionCount: number;
  affectedAreaPercentage: number;
  energyScore: number;       // Energy-based OOD metric E(x; T)
}

// ─── Out-Of-Distribution (OOD) Gating ───────────────────────────

export interface OODGateResult {
  isInDistribution: boolean;
  energyScore: number;       // Lower is in-distribution
  mahalanobisDistance: number;
  calibratedConfidence: number; // Temperature-scaled confidence
  uncertaintyType: "aleatoric" | "epistemic" | "none";
}

// ─── Multi-Frame Temporal Consistency ───────────────────────────

export interface TemporalSmootherResult {
  stableLabel: string;
  smoothedConfidence: number;
  isAnomaly: boolean;
  boundingBox: BoundingBox | null;
  isTemporallyConsistent: boolean;
  frameSampleCount: number;
  evidentialBelief: {
    belief: number;
    uncertainty: number;
  };
}

// ─── Unified Perception Pipeline Contract ───────────────────────

export interface PerceptionPipelineExecutionResult {
  // Final reconciled diagnosis compliant with existing UI store
  diagnosis: DiagnosisResult;
  // Execution metadata ensuring model truth
  backendStatus: ModelBackendStatus;
  // Granular stage-by-stage audit trail
  stageMetrics: {
    opticalQuality: OpticalQualityMetrics;
    plantDetection: PlantDetectionResult;
    plantValidation: PlantValidationResult;
    pathology?: PathologyAnalysisResult;
    ood?: OODGateResult;
    temporal: TemporalSmootherResult;
    executionTimeMs: number;
  };
}
