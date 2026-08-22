import type { OpticalQualityMetrics } from "@/ai/types";

/**
 * Optical & Image Quality Gate (Stage 0)
 * Evaluates real frame luminance, contrast, and Laplacian blur energy
 * to reject non-viable frames before executing heavy neural layers.
 */
export class QualityGate {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private readonly sampleWidth = 160;
  private readonly sampleHeight = 120;

  constructor() {
    if (typeof OffscreenCanvas !== "undefined") {
      this.canvas = new OffscreenCanvas(this.sampleWidth, this.sampleHeight);
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    } else if (typeof document !== "undefined") {
      this.canvas = document.createElement("canvas");
      this.canvas.width = this.sampleWidth;
      this.canvas.height = this.sampleHeight;
      this.ctx = (this.canvas as HTMLCanvasElement).getContext("2d", { willReadFrequently: true });
    }
  }

  public evaluateFrame(source: HTMLVideoElement | ImageData): OpticalQualityMetrics {
    try {
      let imageData: ImageData;

      if ("data" in source) {
        imageData = source;
      } else if (this.ctx && source.videoWidth > 0 && source.videoHeight > 0) {
        this.ctx.drawImage(source, 0, 0, this.sampleWidth, this.sampleHeight);
        imageData = this.ctx.getImageData(0, 0, this.sampleWidth, this.sampleHeight);
      } else {
        // Fallback if video is not ready yet
        return {
          isAcceptable: true,
          brightness: 128,
          contrast: 45,
          blurScore: 120,
          exposureStatus: "optimal",
          rejectionReason: null,
        };
      }

      const { data, width, height } = imageData;
      const pixelCount = width * height;

      // 1. Luminance & Contrast Calculation (Standard Rec. 601 Luma: Y = 0.299R + 0.587G + 0.114B)
      let sumLuma = 0;
      let sumSqLuma = 0;
      const lumaArray = new Uint8ClampedArray(pixelCount);

      for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        lumaArray[i] = luma;
        sumLuma += luma;
        sumSqLuma += luma * luma;
      }

      const meanLuma = sumLuma / pixelCount;
      const varianceLuma = sumSqLuma / pixelCount - meanLuma * meanLuma;
      const stdDevLuma = Math.sqrt(Math.max(0, varianceLuma));

      // 2. Fast Laplacian Edge Energy (Variance of Laplacian for blur detection)
      // Kernel: [ 0,  1,  0 ]
      //         [ 1, -4,  1 ]
      //         [ 0,  1,  0 ]
      let laplacianSum = 0;
      let laplacianSqSum = 0;
      let laplacianCount = 0;

      for (let y = 1; y < height - 1; y += 2) {
        for (let x = 1; x < width - 1; x += 2) {
          const idx = y * width + x;
          const center = lumaArray[idx];
          const top = lumaArray[idx - width];
          const bottom = lumaArray[idx + width];
          const left = lumaArray[idx - 1];
          const right = lumaArray[idx + 1];

          const lap = top + bottom + left + right - 4 * center;
          laplacianSum += lap;
          laplacianSqSum += lap * lap;
          laplacianCount++;
        }
      }

      const meanLap = laplacianSum / Math.max(1, laplacianCount);
      const blurVariance = laplacianSqSum / Math.max(1, laplacianCount) - meanLap * meanLap;

      // 3. Exposure and Degradation Assessment
      let exposureStatus: OpticalQualityMetrics["exposureStatus"] = "optimal";
      let isAcceptable = true;
      let rejectionReason: string | null = null;

      if (meanLuma < 25) {
        exposureStatus = "underexposed";
        isAcceptable = false;
        rejectionReason = "Extreme underexposure (scene is too dark for optical analysis)";
      } else if (meanLuma > 235) {
        exposureStatus = "overexposed";
        isAcceptable = false;
        rejectionReason = "Sensor saturation / extreme solar glare";
      } else if (stdDevLuma < 12 && meanLuma > 40 && meanLuma < 200) {
        exposureStatus = "severe_shadow";
        isAcceptable = false;
        rejectionReason = "Low scene dynamic range (uniform shadow or occlusion)";
      } else if (blurVariance < 8.0) {
        isAcceptable = false;
        rejectionReason = "Severe motion blur or camera out-of-focus";
      }

      return {
        isAcceptable,
        brightness: Math.round(meanLuma),
        contrast: Math.round(stdDevLuma),
        blurScore: Math.round(blurVariance),
        exposureStatus,
        rejectionReason,
      };
    } catch (err) {
      console.warn("[QualityGate] Evaluation error:", err);
      return {
        isAcceptable: true,
        brightness: 128,
        contrast: 40,
        blurScore: 100,
        exposureStatus: "optimal",
        rejectionReason: null,
      };
    }
  }
}
