import type {
  IPlantAnalysisProvider,
  ImageAnalysisInput,
  PlantAnalysisResult,
  ProviderStatus,
} from "./types";

/**
 * Gemini Vision Primary Provider
 * Communicates with the secure server-side endpoint (/api/analyze-plant)
 * to execute Gemini Multimodal Vision inference.
 *
 * Adheres strictly to:
 * - Zero client-side API key exposure.
 * - Single active request lock to prevent duplicate request spam.
 * - Truthful provenance (provider="gemini").
 * - Fail-closed error handling (no silent ONNX fallback).
 */
export class GeminiProvider implements IPlantAnalysisProvider {
  public readonly name = "gemini" as const;
  public readonly isAvailable = true;

  private isAnalyzing = false;
  private endpoint = "/api/analyze-plant";

  public async initialize(): Promise<boolean> {
    // Gemini provider connects via serverless HTTP endpoint
    return true;
  }

  public getStatus(): ProviderStatus {
    return {
      name: "gemini",
      isActive: true,
      isReady: true,
      statusText: "ONLINE (PRIMARY)",
      description: "Gemini Vision Multimodal Cloud Inference Engine",
    };
  }

  /**
   * Converts various image inputs into a clean base64 data URL.
   */
  private extractDataUrl(input: ImageAnalysisInput): { dataUrl: string; mimeType: string } {
    if (input.dataUrl) {
      const mime = input.mimeType || (input.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/)?.[1] ?? "image/jpeg");
      return { dataUrl: input.dataUrl, mimeType: mime };
    }

    if (input.base64) {
      const mime = input.mimeType || "image/jpeg";
      const fullUrl = input.base64.startsWith("data:") ? input.base64 : `data:${mime};base64,${input.base64}`;
      return { dataUrl: fullUrl, mimeType: mime };
    }

    if (input.imageElement) {
      const el = input.imageElement;
      let width = 640;
      let height = 480;

      if ("videoWidth" in el && el.videoWidth > 0) {
        width = el.videoWidth;
        height = el.videoHeight;
      } else if ("naturalWidth" in el && el.naturalWidth > 0) {
        width = el.naturalWidth;
        height = el.naturalHeight;
      } else if ("width" in el && el.width > 0) {
        width = el.width;
        height = el.height;
      }

      // Create offscreen canvas to capture high quality frame
      const canvas = document.createElement("canvas");
      // Scale down if excessive to conserve bandwidth while keeping lesion fidelity (max 1024px)
      const maxDim = 1024;
      let targetW = width;
      let targetH = height;
      if (Math.max(targetW, targetH) > maxDim) {
        if (targetW >= targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to create canvas 2D rendering context for frame capture.");
      }

      ctx.drawImage(el, 0, 0, targetW, targetH);
      const mime = "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, 0.88);
      return { dataUrl, mimeType: mime };
    }

    throw new Error("Invalid image input provided to GeminiProvider.");
  }

  /**
   * Analyzes an image using the server-side Gemini Vision pipeline.
   */
  public async analyzePlant(input: ImageAnalysisInput): Promise<PlantAnalysisResult> {
    if (this.isAnalyzing) {
      throw new Error("An analysis request is already active. Please wait for completion.");
    }

    this.isAnalyzing = true;
    const clientStartTime = performance.now();

    try {
      const { dataUrl, mimeType } = this.extractDataUrl(input);

      console.log(`[GeminiProvider] 🚀 Dispatching frame to ${this.endpoint} (MIME: ${mimeType})...`);

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: dataUrl,
          mimeType,
        }),
      });

      const clientLatency = Math.round(performance.now() - clientStartTime);

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData?.gemini_message) {
            const statusPrefix = errData.gemini_status ? `[${errData.gemini_status}] ` : "";
            errMessage = `${errData.error || "GEMINI_REQUEST_FAILED"}: ${statusPrefix}${errData.gemini_message}`;
          } else if (errData?.message) {
            const statusPrefix = errData.gemini_status ? `[${errData.gemini_status}] ` : "";
            errMessage = `${errData.error || "GEMINI_REQUEST_FAILED"}: ${statusPrefix}${errData.message}`;
          } else if (errData?.error) {
            errMessage = errData.error;
          }
        } catch {
          // ignore
        }
        console.error(`[GeminiProvider] ❌ Request failed: ${errMessage}`);
        throw new Error(errMessage);
      }

      const result: PlantAnalysisResult = await response.json();

      // Ensure provider truth
      result.provider = "gemini";
      if (!result.latency_ms || result.latency_ms <= 0) {
        result.latency_ms = clientLatency;
      }

      console.log(`[GeminiProvider] ✅ Result received (${result.latency_ms}ms):`, {
        plant: result.plant_detected,
        disease: result.disease_class,
        confidence: result.model_confidence,
        box: result.bounding_box,
      });

      return result;
    } catch (err: any) {
      console.error("[GeminiProvider] Analysis error:", err);
      // Strict Fail-Closed: DO NOT secretly fall back to ONNX
      throw err;
    } finally {
      this.isAnalyzing = false;
    }
  }
}
