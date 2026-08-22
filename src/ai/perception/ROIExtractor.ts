import type { BoundingBox } from "@/types";
import type { ExtractedROI } from "@/ai/types";

/**
 * Plant Region-of-Interest (ROI) Extractor (Stage 3)
 *
 * Extracts high-resolution localized sub-patches from the native camera stream
 * to preserve fine pathological features (lesion margins, fungal mycelia, necrosis)
 * without downsampling blur.
 */
export class ROIExtractor {
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof OffscreenCanvas !== "undefined") {
      this.canvas = new OffscreenCanvas(224, 224);
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    } else if (typeof document !== "undefined") {
      this.canvas = document.createElement("canvas");
      this.canvas.width = 224;
      this.canvas.height = 224;
      this.ctx = (this.canvas as HTMLCanvasElement).getContext("2d", { willReadFrequently: true });
    }
  }

  public extractNativeROI(
    source: HTMLVideoElement | ImageData,
    box: BoundingBox
  ): ExtractedROI {
    const isVideo = "videoWidth" in source;
    const sourceW = isVideo ? (source as HTMLVideoElement).videoWidth || 640 : (source as ImageData).width;
    const sourceH = isVideo ? (source as HTMLVideoElement).videoHeight || 480 : (source as ImageData).height;

    // Apply 5% padding around the bounding box to capture surrounding leaf context
    const padX = box.width * 0.05;
    const padY = box.height * 0.05;

    const clampX = Math.max(0, box.x - padX);
    const clampY = Math.max(0, box.y - padY);
    const clampW = Math.min(1 - clampX, box.width + padX * 2);
    const clampH = Math.min(1 - clampY, box.height + padY * 2);

    const pixelX = Math.round(clampX * sourceW);
    const pixelY = Math.round(clampY * sourceH);
    const pixelW = Math.max(1, Math.round(clampW * sourceW));
    const pixelH = Math.max(1, Math.round(clampH * sourceH));

    let cropImageData: ImageData | undefined;

    if (this.ctx && isVideo && sourceW > 0 && sourceH > 0) {
      try {
        if (this.canvas) {
          this.canvas.width = 224;
          this.canvas.height = 224;
        }
        this.ctx.drawImage(
          source as HTMLVideoElement,
          pixelX,
          pixelY,
          pixelW,
          pixelH,
          0,
          0,
          224,
          224
        );
        cropImageData = this.ctx.getImageData(0, 0, 224, 224);
      } catch (err) {
        // Canvas tainted or not ready
      }
    }

    return {
      boundingBox: {
        x: clampX,
        y: clampY,
        width: clampW,
        height: clampH,
      },
      nativeWidth: pixelW,
      nativeHeight: pixelH,
      imageData: cropImageData,
      aspectRatio: pixelW / pixelH,
    };
  }
}
