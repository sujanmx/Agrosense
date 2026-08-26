import { useRef, useCallback, useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { useAppStore } from "@/store";
import { CameraFeed, type CameraFeedHandle } from "@/components/CameraFeed";
import { AIOverlay } from "@/components/AIOverlay";
import { DiagnosticCard } from "@/components/DiagnosticCard";
import { StateOverlay } from "@/components/StateOverlay";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CameraOff,
  Scan,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  getAIProvider,
  getAIArchitectureStatus,
  CANONICAL_TAXONOMY,
  type PlantAnalysisResult,
} from "@/ai/providers";
import type { InferenceStatus, DiagnosisResult } from "@/types";

// ────────────────────────────────────────────────────────────────
// VisionModule — Gemini Primary Vision Module (Phase 10)
// ────────────────────────────────────────────────────────────────
//
// Pipeline:
//   Live Camera Preview -> Capture Frame -> POST /api/analyze-plant -> Gemini Vision -> Validated Result
//
// Features:
//   - Gemini Vision as active primary AI provider.
//   - V2 ONNX models preserved and inactive.
//   - Discrete capture → analyze → display flow (protects latency & quota).
//   - Single-active-request lock.
//   - Sample integration test selector and image upload.

export function VisionModule() {
  const { connectionStatus } = useWebSocket();
  const inferenceStatus = useAppStore((s) => s.inferenceStatus);
  const setInferenceStatus = useAppStore((s) => s.setInferenceStatus);
  const incrementInferenceCount = useAppStore((s) => s.incrementInferenceCount);
  const setDiagnosis = useAppStore((s) => s.setDiagnosis);
  const resetInference = useAppStore((s) => s.resetInference);

  const cameraRef = useRef<CameraFeedHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraStatus, setCameraStatus] = useState<InferenceStatus>("idle");
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<PlantAnalysisResult | null>(null);

  const architectureStatus = getAIArchitectureStatus();

  // ── Camera status handler ──────────────────────────────────
  const handleCameraStatus = useCallback(
    (status: InferenceStatus) => {
      setCameraStatus(status);
      if (status === "active" && !capturedSnapshot) {
        setInferenceStatus("ready");
      } else if (status === "permission_denied" || status === "error") {
        setInferenceStatus(status);
      }
    },
    [setInferenceStatus, capturedSnapshot]
  );

  // ── Convert PlantAnalysisResult to Store DiagnosisResult ───
  const mapAnalysisToDiagnosis = useCallback((res: PlantAnalysisResult): DiagnosisResult => {
    let label = "Healthy Target Crop";
    let isAnomaly = false;

    if (!res.plant_detected || !res.leaf_detected || res.disease_class_id === null || res.disease_class === "unknown") {
      label = res.plant_detected ? "Indeterminate Observation" : "No Clear Detection";
      isAnomaly = false;
    } else if (res.disease_class_id === 0) {
      label = "Healthy Target Crop";
      isAnomaly = false;
    } else {
      const taxonomyEntry = CANONICAL_TAXONOMY[res.disease_class_id];
      label = taxonomyEntry ? taxonomyEntry.displayName : res.disease_class;
      isAnomaly = true;
    }

    return {
      label,
      confidence: res.model_confidence,
      isAnomaly,
      boundingBox: res.bounding_box,
      timestamp: new Date(),
      provider: res.provider,
      plantSpecies: res.plant_species,
      diseaseClassId: res.disease_class_id,
      diseaseClass: res.disease_class,
      scientificName: res.scientific_name,
      severity: res.severity,
      visualEvidence: res.visual_evidence,
      recommendation: res.recommendation,
      latencyMs: res.latency_ms,
      plantDetected: res.plant_detected,
      leafDetected: res.leaf_detected,
    };
  }, []);

  // ── Capture & Analyze Camera Frame ────────────────────────
  const captureAndAnalyze = useCallback(async () => {
    if (isAnalyzing) return;

    setAnalysisError(null);
    setIsAnalyzing(true);
    setInferenceStatus("analyzing");
    incrementInferenceCount();

    const videoEl = cameraRef.current?.videoElement;
    if (!videoEl || videoEl.readyState < 2) {
      setAnalysisError("Camera stream not ready. Please wait for camera to activate.");
      setIsAnalyzing(false);
      setInferenceStatus("ready");
      return;
    }

    try {
      // 1. Capture snapshot to canvas
      const canvas = document.createElement("canvas");
      const maxDim = 1024;
      let w = videoEl.videoWidth || 640;
      let h = videoEl.videoHeight || 480;
      if (Math.max(w, h) > maxDim) {
        if (w >= h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas context");
      ctx.drawImage(videoEl, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      setCapturedSnapshot(dataUrl);

      // 2. Dispatch to AI Provider (Gemini Vision)
      const provider = getAIProvider();
      console.log(`[VisionModule] Analyzing frame with provider: ${provider.name}...`);
      const result = await provider.analyzePlant({ dataUrl, mimeType: "image/jpeg" });

      setLastAnalysis(result);
      const diagnosis = mapAnalysisToDiagnosis(result);
      setDiagnosis(diagnosis);

      if (!result.plant_detected) {
        setInferenceStatus("no_plant");
      } else if (result.disease_class_id === null) {
        setInferenceStatus("unknown");
      } else {
        setInferenceStatus("success");
      }
    } catch (err: any) {
      console.error("[VisionModule] Analysis failure:", err);
      const errorMsg = err?.message || "Failed to analyze plant image with Gemini Vision.";
      setAnalysisError(errorMsg);
      setInferenceStatus("error");
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, incrementInferenceCount, setInferenceStatus, setDiagnosis, mapAnalysisToDiagnosis]);

  // ── Handle Custom File Upload or Sample Test ──────────────
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (isAnalyzing) return;
      setAnalysisError(null);
      setIsAnalyzing(true);
      setInferenceStatus("analyzing");
      incrementInferenceCount();

      try {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        setCapturedSnapshot(dataUrl);
        const provider = getAIProvider();
        const result = await provider.analyzePlant({ dataUrl, mimeType: file.type || "image/jpeg" });

        setLastAnalysis(result);
        const diagnosis = mapAnalysisToDiagnosis(result);
        setDiagnosis(diagnosis);

        if (!result.plant_detected) {
          setInferenceStatus("no_plant");
        } else if (result.disease_class_id === null) {
          setInferenceStatus("unknown");
        } else {
          setInferenceStatus("success");
        }
      } catch (err: any) {
        console.error("[VisionModule] Upload analysis error:", err);
        setAnalysisError(err?.message || "Error analyzing uploaded image.");
        setInferenceStatus("error");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [isAnalyzing, incrementInferenceCount, setInferenceStatus, setDiagnosis, mapAnalysisToDiagnosis]
  );

  // ── Return to Live Camera ─────────────────────────────────
  const returnToLiveView = useCallback(() => {
    setCapturedSnapshot(null);
    setAnalysisError(null);
    setInferenceStatus("ready");
    if (cameraRef.current) {
      cameraRef.current.restart();
    }
  }, [setInferenceStatus]);

  const showCamera = cameraStatus === "active" && !capturedSnapshot;
  const isGatewayDown = connectionStatus === "DISCONNECTED";

  return (
    <Card className="relative overflow-hidden border-border/50 bg-zinc-950/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                AI Vision Diagnostics
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  {architectureStatus.activeProviderName.toUpperCase()}
                </span>
              </CardTitle>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Overlay toggle */}
            {(showCamera || capturedSnapshot) && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setOverlayEnabled((v) => !v)}
                aria-label={overlayEnabled ? "Hide AI overlay" : "Show AI overlay"}
                title={overlayEnabled ? "Hide AI overlay" : "Show AI overlay"}
                className="text-muted-foreground hover:text-foreground"
              >
                {overlayEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
            )}

            {/* Inference status badge */}
            <Badge
              variant="outline"
              className={`text-[10px] gap-1 font-mono ${
                inferenceStatus === "analyzing"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300 animate-pulse"
                  : inferenceStatus === "success"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : inferenceStatus === "no_plant" || inferenceStatus === "unknown"
                      ? "border-zinc-500/40 bg-zinc-800/50 text-zinc-300"
                      : inferenceStatus === "error"
                        ? "border-red-500/40 bg-red-500/10 text-red-300"
                        : "border-zinc-600/30 bg-zinc-800/50 text-zinc-400"
              }`}
            >
              {inferenceStatus === "analyzing" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {inferenceStatus === "success" && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
              {inferenceStatus === "analyzing"
                ? "ANALYZING"
                : inferenceStatus === "success"
                  ? "DIAGNOSED"
                  : inferenceStatus === "no_plant"
                    ? "NO PLANT"
                    : inferenceStatus === "ready"
                      ? "LIVE VIEW"
                      : inferenceStatus.toUpperCase()}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Multimodal crop pathology detection &amp; normalized bounding-box localization
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── Viewport: Camera feed OR Captured Snapshot ─────── */}
        <div className="relative aspect-video w-full rounded-lg border border-border/30 bg-zinc-900/80 overflow-hidden">
          {/* Subtle grid */}
          {overlayEnabled && (
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none z-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
          )}

          {/* Live Camera Stream */}
          <CameraFeed
            ref={cameraRef}
            onStatusChange={handleCameraStatus}
            className={`absolute inset-0 rounded-lg ${capturedSnapshot ? "hidden" : "block"}`}
          />

          {/* Captured Snapshot Display */}
          {capturedSnapshot && (
            <img
              src={capturedSnapshot}
              alt="Captured plant frame"
              className="absolute inset-0 w-full h-full object-cover rounded-lg"
            />
          )}

          {/* AI Overlay (Bounding Box + Diagnosis) */}
          {overlayEnabled && (showCamera || capturedSnapshot) && <AIOverlay />}

          {/* Analyzing Loading Veil */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-xs flex flex-col items-center justify-center z-30 space-y-2">
              <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
              <p className="text-xs font-semibold text-foreground tracking-tight">
                Analyzing with Gemini Vision...
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                Multimodal Pathology &amp; Localization
              </p>
            </div>
          )}

          {/* Error Banner */}
          {analysisError && !isAnalyzing && (
            <div className="absolute top-2 left-2 right-2 bg-red-950/90 border border-red-500/40 rounded p-2 z-30 flex items-start gap-2 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] text-red-200">
                <span className="font-semibold">Analysis Failed: </span>
                {analysisError}
              </div>
            </div>
          )}

          {/* State overlays when camera not active & no snapshot */}
          {!showCamera && !capturedSnapshot && (
            <>
              {isGatewayDown ? (
                <StateOverlay
                  variant="disconnected"
                  title="Camera Offline"
                  description="IoT gateway disconnected. No video feed available."
                />
              ) : cameraStatus === "awaiting_permission" ? (
                <StateOverlay
                  variant="loading"
                  title="Awaiting Camera Permission"
                  description="Please allow camera access in your browser to enable AI vision."
                />
              ) : cameraStatus === "permission_denied" ? (
                <StateOverlay
                  variant="error"
                  title="Camera Access Denied"
                  description="Camera permission was denied. Enable it in browser settings to proceed."
                />
              ) : cameraStatus === "error" ? (
                <StateOverlay
                  variant="error"
                  title="Camera Error"
                  description="Could not access camera hardware. Check device connections."
                />
              ) : (
                <StateOverlay
                  variant="empty"
                  title="Camera Feed"
                  description="Initializing camera... Click 'Capture & Analyze' or upload an image."
                />
              )}
            </>
          )}
        </div>

        {/* ── Controls ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {capturedSnapshot ? (
            <Button
              variant="default"
              size="sm"
              className="gap-2 text-xs flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              onClick={returnToLiveView}
              disabled={isAnalyzing}
            >
              <RefreshCw className="h-3 w-3" />
              New Scan / Live View
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="gap-2 text-xs flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-950/50"
              onClick={captureAndAnalyze}
              disabled={isAnalyzing || cameraStatus !== "active"}
            >
              {isAnalyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scan className="h-3.5 w-3.5" />
              )}
              Capture &amp; Analyze Frame
            </Button>
          )}

          {/* Upload custom image button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-border/40"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            title="Upload image for testing"
          >
            <Upload className="h-3 w-3" />
            Upload Sample
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => cameraRef.current?.restart()}
            disabled={isAnalyzing}
            aria-label="Restart camera"
            title="Restart camera"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => {
              cameraRef.current?.stop();
              setCapturedSnapshot(null);
              setCameraStatus("idle");
              setInferenceStatus("idle");
              resetInference();
            }}
            disabled={isAnalyzing}
            aria-label="Stop camera"
            title="Stop camera"
          >
            <CameraOff className="h-3 w-3" />
          </Button>
        </div>

        {/* ── Diagnostic Card: Rich Pathological Evidence ───── */}
        <DiagnosticCard />

        {/* ── Architecture Status Panel (Dev / System Info) ─── */}
        <ArchitectureStatusFooter
          activeProvider={architectureStatus.activeProviderName}
          lastAnalysis={lastAnalysis}
        />
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// ArchitectureStatusFooter — Provider provenance & model status
// ────────────────────────────────────────────────────────────────

function ArchitectureStatusFooter({
  activeProvider,
  lastAnalysis,
}: {
  activeProvider: "gemini" | "onnx";
  lastAnalysis: PlantAnalysisResult | null;
}) {
  return (
    <div className="rounded-md border border-border/30 bg-zinc-900/60 p-2.5 font-mono text-[10px] text-muted-foreground space-y-1.5">
      <div className="flex items-center justify-between pb-1 border-b border-border/20">
        <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-300 flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-emerald-400" />
          Model Architecture &amp; Governance
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-950/80 text-emerald-300 border-emerald-500/40">
            PRIMARY: {activeProvider.toUpperCase()} VISION
          </span>
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded border bg-zinc-800 text-zinc-400 border-zinc-700/40">
            V2 ONNX: PRESERVED / INACTIVE
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-0.5 text-[9px]">
        <div>
          <span className="text-zinc-500">Active Provider: </span>
          <span className="text-emerald-400 font-semibold">{activeProvider === "gemini" ? "Gemini Multimodal Vision (Cloud)" : "ONNX Local Edge"}</span>
        </div>
        <div>
          <span className="text-zinc-500">Own V2 Model: </span>
          <span className="text-zinc-400">classifier_v2 / detector_v2 (Preserved)</span>
        </div>
        {lastAnalysis && (
          <>
            <div>
              <span className="text-zinc-500">Inference Latency: </span>
              <span className="text-amber-400 font-semibold">{lastAnalysis.latency_ms} ms</span>
            </div>
            <div>
              <span className="text-zinc-500">Bounding Box: </span>
              <span className="text-foreground">{lastAnalysis.bounding_box ? "Localized (Normalized)" : "None"}</span>
            </div>
          </>
        )}
      </div>

      <p className="text-muted-foreground/60 leading-relaxed pt-0.5 text-[8.5px] border-t border-border/20">
        Gemini Vision is the active production provider. Local INT8 ONNX models and checkpoints remain verified and preserved in repository for zero-code reactivation.
      </p>
    </div>
  );
}
