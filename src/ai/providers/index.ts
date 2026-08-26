import type { IPlantAnalysisProvider, ProviderStatus } from "./types";
import { GeminiProvider } from "./GeminiProvider";
import { ONNXProvider } from "./ONNXProvider";

export * from "./types";
export * from "./GeminiProvider";
export * from "./ONNXProvider";

/**
 * Active AI Inference Provider Selection.
 * Production Default: "gemini" (Gemini Vision Cloud Provider)
 * Inactive / Future Switch: "onnx" (Local V2 ONNX Edge Models)
 */
export const ACTIVE_AI_PROVIDER: "gemini" | "onnx" =
  (import.meta.env.VITE_AI_PROVIDER as "gemini" | "onnx") || "gemini";

// Singletons
let geminiInstance: GeminiProvider | null = null;
let onnxInstance: ONNXProvider | null = null;

export function getGeminiProvider(): GeminiProvider {
  if (!geminiInstance) {
    geminiInstance = new GeminiProvider();
  }
  return geminiInstance;
}

export function getONNXProvider(): ONNXProvider {
  if (!onnxInstance) {
    onnxInstance = new ONNXProvider();
  }
  return onnxInstance;
}

/**
 * Returns the currently active AI provider according to centralized configuration.
 */
export function getAIProvider(override?: "gemini" | "onnx"): IPlantAnalysisProvider {
  const target = override || ACTIVE_AI_PROVIDER;
  if (target === "onnx") {
    return getONNXProvider();
  }
  return getGeminiProvider();
}

/**
 * Returns comprehensive status of both primary and secondary providers.
 */
export function getAIArchitectureStatus(): {
  primary: ProviderStatus;
  preserved: ProviderStatus;
  activeProviderName: "gemini" | "onnx";
} {
  const geminiStatus = getGeminiProvider().getStatus();
  const onnxStatus = getONNXProvider().getStatus();

  return {
    primary: geminiStatus,
    preserved: onnxStatus,
    activeProviderName: ACTIVE_AI_PROVIDER,
  };
}
