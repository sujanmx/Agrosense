// ─── Canonical Disease Taxonomy Definition ────────────────────────────────────

export type CanonicalDiseaseClass =
  | "00_healthy_target_crop"
  | "01_early_blight"
  | "02_late_blight"
  | "03_powdery_mildew"
  | "04_bacterial_spot"
  | "05_leaf_mold"
  | "06_septoria_leaf_spot"
  | "07_nutrient_deficiency"
  | "08_pest_infestation"
  | "unknown";

export interface TaxonomyEntry {
  id: number;
  classKey: CanonicalDiseaseClass;
  displayName: string;
  scientificName: string | null;
  defaultSeverity: SeverityLevel;
}

export const CANONICAL_TAXONOMY: Record<number, TaxonomyEntry> = {
  0: {
    id: 0,
    classKey: "00_healthy_target_crop",
    displayName: "Healthy Target Crop",
    scientificName: "Solanum lycopersicum",
    defaultSeverity: "none",
  },
  1: {
    id: 1,
    classKey: "01_early_blight",
    displayName: "Early Blight",
    scientificName: "Alternaria solani",
    defaultSeverity: "moderate",
  },
  2: {
    id: 2,
    classKey: "02_late_blight",
    displayName: "Late Blight",
    scientificName: "Phytophthora infestans",
    defaultSeverity: "severe",
  },
  3: {
    id: 3,
    classKey: "03_powdery_mildew",
    displayName: "Powdery Mildew",
    scientificName: "Oidium neolycopersici",
    defaultSeverity: "moderate",
  },
  4: {
    id: 4,
    classKey: "04_bacterial_spot",
    displayName: "Bacterial Spot",
    scientificName: "Xanthomonas spp.",
    defaultSeverity: "moderate",
  },
  5: {
    id: 5,
    classKey: "05_leaf_mold",
    displayName: "Leaf Mold",
    scientificName: "Passalora fulva",
    defaultSeverity: "moderate",
  },
  6: {
    id: 6,
    classKey: "06_septoria_leaf_spot",
    displayName: "Septoria Leaf Spot",
    scientificName: "Septoria lycopersici",
    defaultSeverity: "moderate",
  },
  7: {
    id: 7,
    classKey: "07_nutrient_deficiency",
    displayName: "Nutrient Deficiency",
    scientificName: "Abiotic (N/P/K Deficiency)",
    defaultSeverity: "mild",
  },
  8: {
    id: 8,
    classKey: "08_pest_infestation",
    displayName: "Pest Infestation",
    scientificName: "Arthropod Pests (Aphids/Mites)",
    defaultSeverity: "moderate",
  },
};

// ─── Severity Level Contract ──────────────────────────────────────────────────

export type SeverityLevel = "none" | "mild" | "moderate" | "severe" | "unknown";

// ─── Normalized Bounding Box Contract ─────────────────────────────────────────

export interface NormalizedBoundingBox {
  x: number;      // 0.0 to 1.0 (left)
  y: number;      // 0.0 to 1.0 (top)
  width: number;  // 0.0 to 1.0 (width)
  height: number; // 0.0 to 1.0 (height)
}

// ─── Canonical Plant Analysis Result Contract ─────────────────────────────────

export interface PlantAnalysisResult {
  provider: "gemini" | "onnx";
  plant_detected: boolean;
  leaf_detected: boolean;
  plant_species: string | null;
  disease_class_id: number | null;
  disease_class: string;
  scientific_name: string | null;
  severity: SeverityLevel;
  model_confidence: number; // Normalized AI confidence estimate [0.0, 1.0]
  bounding_box: NormalizedBoundingBox | null;
  visual_evidence: string;
  recommendation: string;
  latency_ms: number;
  error?: string | null;
}

// ─── Provider Interface & Input Types ─────────────────────────────────────────

export interface ImageAnalysisInput {
  dataUrl?: string;
  base64?: string;
  mimeType?: string;
  imageElement?: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
}

export interface ProviderStatus {
  name: "gemini" | "onnx";
  isActive: boolean;
  isReady: boolean;
  statusText: string;
  description: string;
}

export interface IPlantAnalysisProvider {
  readonly name: "gemini" | "onnx";
  readonly isAvailable: boolean;
  initialize(): Promise<boolean>;
  analyzePlant(input: ImageAnalysisInput): Promise<PlantAnalysisResult>;
  getStatus(): ProviderStatus;
}
