import { useRef, useEffect, useCallback, useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import { useAppStore, throttledSetDiagnosis } from "@/store";
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
  Camera,
  CameraOff,
  Scan,
  Play,
  Square,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { PerceptionPipeline, type ModelBackendStatus } from "@/ai";
import type { InferenceStatus } from "@/types";

// ────────────────────────────────────────────────────────────────
// VisionModule — integrated camera + AI perception pipeline
// ────────────────────────────────────────────────────────────────

export function VisionModule() {
  const { connectionStatus } = useWebSocket();
  const inferenceStatus = useAppStore((s) => s.inferenceStatus);
  const setInferenceStatus = useAppStore((s) => s.setInferenceStatus);
  const incrementInferenceCount = useAppStore((s) => s.incrementInferenceCount);
  const resetInference = useAppStore((s) => s.resetInference);

  const cameraRef = useRef<CameraFeedHandle>(null);
  const perceptionPipelineRef = useRef<PerceptionPipeline>(new PerceptionPipeline());
  const inferenceLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraStatus, setCameraStatus] = useState<InferenceStatus>("idle");
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [backendStatus, setBackendStatus] = useState<ModelBackendStatus>({
    mode: "heuristic_fallback",
    isNeuralModelLoaded: false,
    isNeuralClassifierLoaded: false,
    isNeuralDetectorLoaded: false,
    detectorModelPath: null,
    classifierModelPath: null,
    detectorExecutionMode: "heuristic",
    classifierExecutionMode: "heuristic",
    executionProvider: "heuristic_engine",
    inferenceLatencyMs: 3.5,
    lastError: null,
  });

  // Discover and initialize neural backend or fallback on mount
  useEffect(() => {
    perceptionPipelineRef.current.initialize().then((status) => {
      setBackendStatus(status);
    });
  }, []);

  // ── Camera status handler ──────────────────────────────────
  const handleCameraStatus = useCallback(
    (status: InferenceStatus) => {
      setCameraStatus(status);
      setInferenceStatus(status);
    },
    [setInferenceStatus]
  );

  // ── 8-Stage Edge Perception Loop ───────────────────────────
  // Runs real optical gating, plant detection, validation, native ROI extraction,
  // disease classification, OOD gating, and temporal evidential smoothing.
  // The throttledSetDiagnosis call ensures React only
  // re-renders the diagnosis UI ≤2 times per second.
  const startInference = useCallback(() => {
    if (inferenceLoopRef.current) return;

    setInferenceStatus("analyzing");
    console.log("[VisionModule] 🧠 Initializing 8-Stage Cascaded Perception Pipeline...");

    // Brief initialization phase
    setTimeout(() => {
      setInferenceStatus("active");

      // Execution loop at ~30fps
      inferenceLoopRef.current = setInterval(async () => {
        // Raw frame tick
        incrementInferenceCount();

        const videoEl = cameraRef.current?.videoElement;
        if (videoEl && videoEl.readyState >= 2) {
          try {
            const executionResult = await perceptionPipelineRef.current.processFrame(videoEl);

            // THIS IS THE CRITICAL THROTTLE POINT:
            // throttledSetDiagnosis limits Zustand writes (and thus
            // React re-renders) to max 2 per second.
            throttledSetDiagnosis(executionResult.diagnosis);
          } catch (err) {
            console.warn("[VisionModule] Frame perception error:", err);
          }
        }
      }, 33); // ~30fps
    }, 1200);
  }, [setInferenceStatus, incrementInferenceCount]);

  const stopInference = useCallback(() => {
    if (inferenceLoopRef.current) {
      clearInterval(inferenceLoopRef.current);
      inferenceLoopRef.current = null;
    }
    perceptionPipelineRef.current.reset();
    setInferenceStatus("idle");
    console.log("[VisionModule] ⏹ Perception pipeline stopped");
  }, [setInferenceStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inferenceLoopRef.current) {
        clearInterval(inferenceLoopRef.current);
      }
      perceptionPipelineRef.current.reset();
    };
  }, []);

  // ── Determine what to show ─────────────────────────────────
  const showCamera =
    cameraStatus === "active" || inferenceStatus === "active" || inferenceStatus === "analyzing";

  const isGatewayDown = connectionStatus === "DISCONNECTED";

  return (
    <Card className="relative overflow-hidden border-border/50 bg-zinc-950/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">AI Vision Module</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* Overlay toggle */}
            {showCamera && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setOverlayEnabled((v) => !v)}
                aria-label={overlayEnabled ? "Hide AI overlay" : "Show AI overlay"}
                title={overlayEnabled ? "Hide AI overlay" : "Show AI overlay"}
                className="text-muted-foreground hover:text-foreground"
              >
                {overlayEnabled ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            {/* Inference status badge */}
            <Badge
              variant="outline"
              className={`text-[10px] gap-1 ${
                inferenceStatus === "active"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : inferenceStatus === "analyzing"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-zinc-600/30 bg-zinc-800/50 text-zinc-400"
              }`}
            >
              {inferenceStatus === "active" && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <Scan className="h-2.5 w-2.5" />
              {inferenceStatus === "active"
                ? "LIVE"
                : inferenceStatus === "analyzing"
                  ? "ANALYZING"
                  : "STANDBY"}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs">
          Crop disease detection &amp; pest identification
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── Camera viewport ──────────────────────────────── */}
        <div className="relative aspect-video w-full rounded-lg border border-border/30 bg-zinc-900/80 overflow-hidden">
          {/* Subtle scan grid (very low opacity) */}
          {overlayEnabled && showCamera && (
            <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none z-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
          )}

          {/* Camera feed */}
          <CameraFeed
            ref={cameraRef}
            onStatusChange={handleCameraStatus}
            className="absolute inset-0 rounded-lg"
          />

          {/* AI overlay (bounding boxes + diagnosis) — respects toggle */}
          {showCamera && overlayEnabled && <AIOverlay />}

          {/* Overlay OFF indicator (small badge, non-intrusive) */}
          {showCamera && !overlayEnabled && (
            <div className="absolute top-3 right-3 pointer-events-none">
              <Badge
                variant="outline"
                className="text-[9px] gap-1 border-zinc-700/40 bg-zinc-900/70 text-zinc-500 backdrop-blur-sm font-mono"
              >
                <EyeOff className="h-2.5 w-2.5" />
                OVERLAY OFF
              </Badge>
            </div>
          )}

          {/* State overlays for non-camera states */}
          {!showCamera && (
            <>
              {/* Crosshair guides (visible when no camera) */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute top-4 left-4 h-6 w-6 border-l-2 border-t-2 border-emerald-500/20 rounded-tl-sm" />
                <div className="absolute top-4 right-4 h-6 w-6 border-r-2 border-t-2 border-emerald-500/20 rounded-tr-sm" />
                <div className="absolute bottom-4 left-4 h-6 w-6 border-l-2 border-b-2 border-emerald-500/20 rounded-bl-sm" />
                <div className="absolute bottom-4 right-4 h-6 w-6 border-r-2 border-b-2 border-emerald-500/20 rounded-br-sm" />
              </div>

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
              ) : connectionStatus === "CONNECTING" ? (
                <StateOverlay
                  variant="loading"
                  title="Connecting to Gateway"
                  description="Negotiating connection with IoT gateway…"
                />
              ) : (
                <StateOverlay
                  variant="empty"
                  title="Camera Feed"
                  description="Camera not initialized. Click 'Start Analysis' to begin."
                />
              )}
            </>
          )}
        </div>

        {/* ── Controls ─────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {inferenceStatus === "active" || inferenceStatus === "analyzing" ? (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2 text-xs flex-1"
              onClick={() => {
                stopInference();
                resetInference();
              }}
            >
              <Square className="h-3 w-3" />
              Stop Analysis
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs flex-1"
              onClick={startInference}
              disabled={!showCamera}
            >
              <Play className="h-3 w-3" />
              Start Analysis
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => cameraRef.current?.restart()}
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
              stopInference();
              cameraRef.current?.stop();
              setCameraStatus("idle");
              setInferenceStatus("idle");
              resetInference();
            }}
            aria-label="Stop camera"
            title="Stop camera"
          >
            <CameraOff className="h-3 w-3" />
          </Button>
        </div>

        {/* ── Diagnostic Card — AI Observation panel ────────── */}
        {inferenceStatus === "active" && <DiagnosticCard />}

        {/* ── Throttle proof (dev info, progressive disclosure) */}
        {inferenceStatus === "active" && (
          <ThrottleProof backendStatus={backendStatus} />
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// ThrottleProof — shows INF vs RND counts to prove throttling
// ────────────────────────────────────────────────────────────────

function ThrottleProof({ backendStatus }: { backendStatus?: ModelBackendStatus }) {
  const inferenceCount = useAppStore((s) => s.inferenceCount);
  const renderCount = useAppStore((s) => s.renderCount);
  const ratio =
    renderCount > 0 ? (inferenceCount / renderCount).toFixed(1) : "—";

  const isClsNeural = backendStatus?.isNeuralClassifierLoaded ?? false;
  const isDetNeural = backendStatus?.isNeuralDetectorLoaded ?? false;

  return (
    <div className="rounded-md border border-border/30 bg-zinc-900/60 p-2.5 font-mono text-[10px] text-muted-foreground space-y-1.5">
      <div className="flex items-center justify-between pb-1 border-b border-border/20">
        <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400">
          Perception Engine:
        </span>
        <div className="flex items-center gap-1">
          <span
            className={`text-[8px] font-semibold px-1 py-0.5 rounded border ${
              isDetNeural
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
                : "bg-zinc-800 text-amber-300 border-amber-500/20"
            }`}
          >
            DET: {isDetNeural ? "NEURAL" : "HEURISTIC"}
          </span>
          <span
            className={`text-[8px] font-semibold px-1 py-0.5 rounded border ${
              isClsNeural
                ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
                : "bg-zinc-800 text-amber-300 border-amber-500/20"
            }`}
          >
            CLS: {isClsNeural ? "NEURAL ONNX" : "HEURISTIC"}
          </span>
        </div>
      </div>
      <div className="flex justify-between">
        <span>Raw inference frames:</span>
        <span className="text-foreground">{inferenceCount}</span>
      </div>
      <div className="flex justify-between">
        <span>Throttled UI renders:</span>
        <span className="text-emerald-400">{renderCount}</span>
      </div>
      <div className="flex justify-between border-t border-border/20 pt-1">
        <span>Throttle ratio:</span>
        <span className="text-amber-400">{ratio}:1</span>
      </div>
      <p className="text-muted-foreground/60 leading-relaxed pt-0.5 text-[9px]">
        {isClsNeural
          ? "Stage 4 executing ONNX MobileNet pathology classifier with Energy OOD gating."
          : "Operating in heuristic mode until .onnx weights are loaded in /public/models/."}
      </p>
    </div>
  );
}
