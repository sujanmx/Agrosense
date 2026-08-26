import type {
  IPlantAnalysisProvider,
  ImageAnalysisInput,
  PlantAnalysisResult,
  ProviderStatus,
  SeverityLevel,
} from "./types";
import { CANONICAL_TAXONOMY } from "./types";
import { ONNXModelAdapter } from "@/ai/runtime/ModelAdapter";
import { QualityGate } from "@/ai/perception/QualityGate";
import { PlantValidator } from "@/ai/perception/PlantValidator";
import { ROIExtractor } from "@/ai/perception/ROIExtractor";
import { OODGate } from "@/ai/perception/OODGate";

/**
 * ONNX V2 Edge Neural Provider (Preserved & Inactive in Phase 10)
 *
 * Encapsulates the local INT8 ONNX Runtime models:
 * - /public/models/detector_v2.onnx
 * - /public/models/classifier_v2.onnx
 * - /public/models/v2_class_mapping.json
 *
 * Retains 100% full compilability and runtime readiness for future reactivation.
 */
export class ONNXProvider implements IPlantAnalysisProvider {
  public readonly name = "onnx" as const;
  public readonly isAvailable = true;

  private adapter: ONNXModelAdapter;
  private qualityGate: QualityGate;
  private plantValidator: PlantValidator;
  private roiExtractor: ROIExtractor;
  private oodGate: OODGate;
  private isInitialized = false;

  constructor() {
    this.adapter = new ONNXModelAdapter();
    this.qualityGate = new QualityGate();
    this.plantValidator = new PlantValidator();
    this.roiExtractor = new ROIExtractor();
    this.oodGate = new OODGate();
  }

  public async initialize(): Promise<boolean> {
    this.isInitialized = await this.adapter.initialize();
    return this.isInitialized;
  }

  public getStatus(): ProviderStatus {
    return {
      name: "onnx",
      isActive: false, // Inactive in Phase 10
      isReady: this.isInitialized,
      statusText: "PRESERVED / INACTIVE",
      description: "V2 Quantized MobileNet Edge ONNX Models (Preserved in repository)",
    };
  }

  /**
   * Converts input to ImageData / Canvas for local ONNX tensor processing.
   */
  private async prepareFrame(input: ImageAnalysisInput): Promise<ImageData> {
    if (input.imageElement) {
      const el = input.imageElement;
      const width = "videoWidth" in el ? el.videoWidth || 640 : (el as HTMLImageElement).naturalWidth || (el as HTMLCanvasElement).width || 640;
      const height = "videoHeight" in el ? el.videoHeight || 480 : (el as HTMLImageElement).naturalHeight || (el as HTMLCanvasElement).height || 480;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Failed to get 2d context for ONNX frame");
      ctx.drawImage(el, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height);
    }

    if (input.dataUrl || input.base64) {
      const src = input.dataUrl || (input.base64?.startsWith("data:") ? input.base64 : `data:${input.mimeType || "image/jpeg"};base64,${input.base64}`);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 480;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return reject(new Error("Failed to get 2d context for image"));
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = (e) => reject(new Error(`Failed to load image for ONNX processing: ${e}`));
        img.src = src;
      });
    }

    throw new Error("No valid image input supplied to ONNXProvider.");
  }

  /**
   * Executes the full local ONNX 8-stage perception pipeline and maps to canonical contract.
   */
  public async analyzePlant(input: ImageAnalysisInput): Promise<PlantAnalysisResult> {
    const startTime = performance.now();

    if (!this.isInitialized) {
      await this.initialize();
    }

    const frameData = await this.prepareFrame(input);

    // Stage 0: Optical Quality Check
    const opticalQuality = this.qualityGate.evaluateFrame(frameData);
    if (!opticalQuality.isAcceptable) {
      return {
        provider: "onnx",
        plant_detected: false,
        leaf_detected: false,
        plant_species: null,
        disease_class_id: null,
        disease_class: "unknown",
        scientific_name: null,
        severity: "none",
        model_confidence: 0.15,
        bounding_box: null,
        visual_evidence: opticalQuality.rejectionReason || "Image quality insufficient for ONNX evaluation.",
        recommendation: "Improve lighting and focus on plant canopy.",
        latency_ms: Math.round(performance.now() - startTime),
      };
    }

    // Stage 1: Detector
    const detResult = await this.adapter.detectTargetPlant(frameData);
    if (!detResult.hasTargetPlant || detResult.targetInstances.length === 0) {
      return {
        provider: "onnx",
        plant_detected: false,
        leaf_detected: false,
        plant_species: null,
        disease_class_id: null,
        disease_class: "unknown",
        scientific_name: null,
        severity: "none",
        model_confidence: 0.18,
        bounding_box: null,
        visual_evidence: detResult.rejectionMessage || "No target plant instance localized by ONNX detector.",
        recommendation: "Ensure plant foliage fills the camera viewfinder.",
        latency_ms: Math.round(performance.now() - startTime),
      };
    }

    const targetInstance = detResult.targetInstances[0];

    // Stage 2: Plant Validator
    const validation = this.plantValidator.validate(targetInstance, frameData);
    if (!validation.isValidated) {
      return {
        provider: "onnx",
        plant_detected: false,
        leaf_detected: false,
        plant_species: null,
        disease_class_id: null,
        disease_class: "unknown",
        scientific_name: null,
        severity: "none",
        model_confidence: 0.20,
        bounding_box: null,
        visual_evidence: "Detected candidate failed structural plant validation.",
        recommendation: "Focus directly on clear target crop leaves.",
        latency_ms: Math.round(performance.now() - startTime),
      };
    }

    // Stage 3: ROI Extraction
    const roi = this.roiExtractor.extractNativeROI(frameData, targetInstance.boundingBox);

    // Stage 4: Classifier
    const pathology = await this.adapter.classifyPathology(roi);

    // Stage 5: OOD Gating
    const ood = this.oodGate.calibrateAndGate(pathology, validation);

    let diseaseClassId: number | null = null;
    let diseaseClass = "unknown";
    let scientificName: string | null = null;
    let severity: SeverityLevel = "unknown";

    // Map predicted string to canonical taxonomy entry
    const entry = Object.values(CANONICAL_TAXONOMY).find(
      (t) => t.displayName.toLowerCase() === pathology.category.toLowerCase() ||
             pathology.category.toLowerCase().includes(t.displayName.toLowerCase())
    );

    if (entry && ood.isInDistribution) {
      diseaseClassId = entry.id;
      diseaseClass = entry.classKey;
      scientificName = entry.scientificName;
      severity = entry.defaultSeverity;
    } else if (pathology.category.toLowerCase().includes("healthy")) {
      diseaseClassId = 0;
      diseaseClass = "00_healthy_target_crop";
      scientificName = "Solanum lycopersicum";
      severity = "none";
    }

    return {
      provider: "onnx",
      plant_detected: true,
      leaf_detected: true,
      plant_species: targetInstance.cropSpecies || "Tomato",
      disease_class_id: diseaseClassId,
      disease_class: diseaseClass,
      scientific_name: scientificName,
      severity,
      model_confidence: Number(ood.calibratedConfidence.toFixed(3)),
      bounding_box: targetInstance.boundingBox,
      visual_evidence: `ONNX local inference: ${pathology.category} (energy: ${pathology.energyScore})`,
      recommendation: diseaseClassId === 0 ? "Crop is healthy. Continue monitoring." : "Inspect affected canopy for symptomatic lesions.",
      latency_ms: Math.round(performance.now() - startTime),
    };
  }
}
