import { QualityGate } from "@/ai/perception/QualityGate";
import { RobustPlantDetector } from "@/ai/perception/PlantDetector";
import { PlantValidator } from "@/ai/perception/PlantValidator";
import { ROIExtractor } from "@/ai/perception/ROIExtractor";
import { EdgeDiseaseClassifier } from "@/ai/disease/DiseaseClassifier";
import { OODGate } from "@/ai/perception/OODGate";
import { TemporalSmoother } from "@/ai/perception/TemporalSmoother";
import { PerceptionEngineManager } from "@/ai/runtime/ModelAdapter";
import type {
  PerceptionPipelineExecutionResult,
  OpticalQualityMetrics,
  PlantDetectionResult,
  PlantValidationResult,
  ModelBackendStatus,
} from "@/ai/types";
import type { DiagnosisResult } from "@/types";

/**
 * Master AI Perception Pipeline Orchestrator (Hardened)
 *
 * Implements the 8-Stage Perception Architecture adhering strictly to:
 * - PRINCIPLE 1: Model Truth (Explicitly surfaces backend status: neural vs heuristic)
 * - PRINCIPLE 3: Strict Separation of Perception Concerns
 * - PRINCIPLE 5: Fail-Closed (Never guesses disease on ambiguous/non-plant frames)
 */
export class PerceptionPipeline {
  private qualityGate: QualityGate;
  private plantDetector: RobustPlantDetector;
  private plantValidator: PlantValidator;
  private roiExtractor: ROIExtractor;
  private diseaseClassifier: EdgeDiseaseClassifier;
  private oodGate: OODGate;
  private temporalSmoother: TemporalSmoother;
  private engineManager: PerceptionEngineManager;

  constructor() {
    this.qualityGate = new QualityGate();
    this.plantDetector = new RobustPlantDetector();
    this.plantValidator = new PlantValidator();
    this.roiExtractor = new ROIExtractor();
    this.diseaseClassifier = new EdgeDiseaseClassifier();
    this.oodGate = new OODGate();
    this.temporalSmoother = new TemporalSmoother();
    this.engineManager = new PerceptionEngineManager();
  }

  public async initialize(): Promise<ModelBackendStatus> {
    return await this.engineManager.initialize();
  }

  public getBackendStatus(): ModelBackendStatus {
    return this.engineManager.getStatus();
  }

  /**
   * Executes the end-to-end perception pipeline on an active camera frame.
   */
  public async processFrame(
    frame: HTMLVideoElement | ImageData
  ): Promise<PerceptionPipelineExecutionResult> {
    const startTime = performance.now();
    const backendStatus = this.engineManager.getStatus();

    // ─────────────────────────────────────────────────────────────
    // STAGE 0: Optical & Image Quality Check (Fail-Closed)
    // ─────────────────────────────────────────────────────────────
    const opticalQuality: OpticalQualityMetrics = this.qualityGate.evaluateFrame(frame);

    if (!opticalQuality.isAcceptable) {
      const smoothed = this.temporalSmoother.processObservation(
        "No Clear Detection",
        0.15,
        false,
        null
      );

      const diagnosis: DiagnosisResult = {
        label: "No Clear Detection",
        confidence: smoothed.smoothedConfidence,
        isAnomaly: false,
        boundingBox: null,
        timestamp: new Date(),
      };

      return {
        diagnosis,
        backendStatus,
        stageMetrics: {
          opticalQuality,
          plantDetection: {
            hasTargetPlant: false,
            targetInstances: [],
            suppressedNegatives: [],
            primaryROI: null,
            rejectionCode: "POOR_IMAGE_QUALITY",
            rejectionMessage: opticalQuality.rejectionReason || "Image quality insufficient",
          },
          plantValidation: {
            isValidated: false,
            structuralIntegrityScore: 0,
            colorInvariancePassed: false,
            isWeedOrGrass: false,
            isForeignObject: false,
            validationDetails: { edgeDensity: 0, venationCoherence: 0, chromaRatio: 0 },
          },
          temporal: smoothed,
          executionTimeMs: performance.now() - startTime,
        },
      };
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: Target Plant & Organ Detection (Hard-Negative Rejection)
    // ─────────────────────────────────────────────────────────────
    const adapter = this.engineManager.getAdapter();
    const plantDetection: PlantDetectionResult =
      adapter && backendStatus.isNeuralDetectorLoaded
        ? await adapter.detectTargetPlant(frame)
        : await this.plantDetector.detect(frame);

    if (!plantDetection.hasTargetPlant || plantDetection.targetInstances.length === 0) {
      const smoothed = this.temporalSmoother.processObservation(
        "No Clear Detection",
        0.18,
        false,
        null
      );

      const diagnosis: DiagnosisResult = {
        label: "No Clear Detection",
        confidence: smoothed.smoothedConfidence,
        isAnomaly: false,
        boundingBox: null,
        timestamp: new Date(),
      };

      return {
        diagnosis,
        backendStatus,
        stageMetrics: {
          opticalQuality,
          plantDetection,
          plantValidation: {
            isValidated: false,
            structuralIntegrityScore: 0,
            colorInvariancePassed: false,
            isWeedOrGrass: false,
            isForeignObject: false,
            validationDetails: { edgeDensity: 0, venationCoherence: 0, chromaRatio: 0 },
          },
          temporal: smoothed,
          executionTimeMs: performance.now() - startTime,
        },
      };
    }

    const primaryTargetInstance = plantDetection.targetInstances[0];

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: Target Plant Validation (Morphology & Weed Gating)
    // ─────────────────────────────────────────────────────────────
    const plantValidation: PlantValidationResult = this.plantValidator.validate(
      primaryTargetInstance,
      frame
    );

    if (!plantValidation.isValidated) {
      const smoothed = this.temporalSmoother.processObservation(
        "No Clear Detection",
        0.20,
        false,
        null
      );

      const diagnosis: DiagnosisResult = {
        label: "No Clear Detection",
        confidence: smoothed.smoothedConfidence,
        isAnomaly: false,
        boundingBox: null,
        timestamp: new Date(),
      };

      return {
        diagnosis,
        backendStatus,
        stageMetrics: {
          opticalQuality,
          plantDetection,
          plantValidation,
          temporal: smoothed,
          executionTimeMs: performance.now() - startTime,
        },
      };
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: Native Resolution ROI Extraction
    // ─────────────────────────────────────────────────────────────
    const nativeROI = this.roiExtractor.extractNativeROI(
      frame,
      primaryTargetInstance.boundingBox
    );

    // ─────────────────────────────────────────────────────────────
    // STAGE 4: Fine-Grained Pathology Analysis
    // ─────────────────────────────────────────────────────────────
    const pathology =
      adapter && backendStatus.isNeuralClassifierLoaded
        ? await adapter.classifyPathology(nativeROI)
        : await this.diseaseClassifier.classify(nativeROI);

    // ─────────────────────────────────────────────────────────────
    // STAGE 5: Confidence Calibration & Out-Of-Distribution Gating
    // ─────────────────────────────────────────────────────────────
    const ood = this.oodGate.calibrateAndGate(pathology, plantValidation);

    // Fail-Closed Logic: If OOD or confidence too low, suppress disease diagnosis
    let candidateLabel: string = pathology.category;
    let isAnomaly = !candidateLabel.toLowerCase().includes("healthy");

    if (!ood.isInDistribution || ood.calibratedConfidence < 0.40) {
      candidateLabel = "Indeterminate Observation";
      isAnomaly = false;
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 6: Multi-Frame Temporal Consistency & Smoothing
    // ─────────────────────────────────────────────────────────────
    const temporal = this.temporalSmoother.processObservation(
      candidateLabel,
      ood.calibratedConfidence,
      isAnomaly,
      primaryTargetInstance.boundingBox
    );

    const diagnosis: DiagnosisResult = {
      label: temporal.stableLabel,
      confidence: temporal.smoothedConfidence,
      isAnomaly: temporal.isAnomaly,
      boundingBox: temporal.boundingBox,
      timestamp: new Date(),
    };

    return {
      diagnosis,
      backendStatus,
      stageMetrics: {
        opticalQuality,
        plantDetection,
        plantValidation,
        pathology,
        ood,
        temporal,
        executionTimeMs: performance.now() - startTime,
      },
    };
  }

  /**
   * Resets internal temporal buffers on stream interruption.
   */
  public reset(): void {
    this.temporalSmoother.reset();
  }
}
