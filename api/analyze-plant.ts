// ─── Server-Side Gemini Vision Plant Analysis Route ───────────────────────────
// Compatible with Vercel Serverless Functions and Vite local development server.
//
// SECURITY MANIFEST:
// - GEMINI_API_KEY is accessed strictly server-side.
// - Browser clients NEVER receive or have access to credentials.
// - Strict input validation & output schema sanitization.
// ─────────────────────────────────────────────────────────────────────────────

interface NormalizedBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GeminiRawResponse {
  plant_detected?: boolean;
  leaf_detected?: boolean;
  plant_species?: string | null;
  disease_class_id?: number | null;
  disease_class?: string | null;
  scientific_name?: string | null;
  severity?: "none" | "mild" | "moderate" | "severe" | "unknown";
  model_confidence?: number;
  bounding_box?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null;
  visual_evidence?: string;
  recommendation?: string;
}

interface PlantAnalysisResult {
  provider: "gemini";
  plant_detected: boolean;
  leaf_detected: boolean;
  plant_species: string | null;
  disease_class_id: number | null;
  disease_class: string;
  scientific_name: string | null;
  severity: "none" | "mild" | "moderate" | "severe" | "unknown";
  model_confidence: number;
  bounding_box: NormalizedBoundingBox | null;
  visual_evidence: string;
  recommendation: string;
  latency_ms: number;
  error?: string | null;
}

const CANONICAL_CLASS_MAP: Record<number, { key: string; scientificName: string }> = {
  0: { key: "00_healthy_target_crop", scientificName: "Solanum lycopersicum" },
  1: { key: "01_early_blight", scientificName: "Alternaria solani" },
  2: { key: "02_late_blight", scientificName: "Phytophthora infestans" },
  3: { key: "03_powdery_mildew", scientificName: "Oidium neolycopersici" },
  4: { key: "04_bacterial_spot", scientificName: "Xanthomonas spp." },
  5: { key: "05_leaf_mold", scientificName: "Passalora fulva" },
  6: { key: "06_septoria_leaf_spot", scientificName: "Septoria lycopersici" },
  7: { key: "07_nutrient_deficiency", scientificName: "Abiotic (N/P/K Deficiency)" },
  8: { key: "08_pest_infestation", scientificName: "Arthropod Pests (Aphids/Mites)" },
};

const VALID_SEVERITIES = new Set(["none", "mild", "moderate", "severe", "unknown"]);
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const GEMINI_SYSTEM_INSTRUCTION = `You are an expert plant pathologist and agricultural computer-vision system.
Your task is to analyze agricultural plant images with extreme scientific precision and honesty.

GUIDELINES:
1. Analyze ONLY the supplied image. Do not invent or assume features not visible.
2. Check if a plant is present ('plant_detected') and if leaf/foliage is visible ('leaf_detected').
3. If no plant or leaf is detected (e.g. human hand, bare soil, tools, non-plant objects):
   - set plant_detected: false, leaf_detected: false
   - set plant_species: null, disease_class_id: null, disease_class: "unknown"
   - set scientific_name: null, severity: "none", bounding_box: null
   - provide honest visual_evidence (e.g. "No plant or leaf detected in the frame.")
4. If a plant/leaf is present, identify species when possible (e.g. "Tomato", "Potato", "Bell Pepper", etc.).
5. Classify the condition strictly against the project's canonical disease taxonomy:
   - ID 0: "00_healthy_target_crop" (Healthy tissue, no lesions or pathology)
   - ID 1: "01_early_blight" (Alternaria solani: dark concentric ring target spots)
   - ID 2: "02_late_blight" (Phytophthora infestans: water-soaked dark lesions, pale halos)
   - ID 3: "03_powdery_mildew" (Oidium neolycopersici: powdery white patches on leaf surface)
   - ID 4: "04_bacterial_spot" (Xanthomonas: small dark water-soaked spots, yellow halo)
   - ID 5: "05_leaf_mold" (Passalora fulva: pale green/yellow chlorotic blotches with olive mold)
   - ID 6: "06_septoria_leaf_spot" (Septoria lycopersici: small circular spots with gray centers & dark borders)
   - ID 7: "07_nutrient_deficiency" (Interveinal chlorosis, generalized yellowing, purpling)
   - ID 8: "08_pest_infestation" (Aphids, mites, stippling, webbing, insect feeding holes)
   - If uncertain or unable to diagnose: set disease_class_id: null, disease_class: "unknown".
6. Severity MUST be strictly one of: "none", "mild", "moderate", "severe", "unknown".
7. Model confidence MUST be a realistic float between 0.0 and 1.0 reflecting visual clarity and certainty.
8. Bounding box MUST represent the primary region of interest or symptomatic leaf:
   - Normalized coordinates: x (left), y (top), width, height each in [0.0, 1.0].
   - If no plant/leaf is detected or no localized symptom can be framed, return null. NEVER invent fake coordinates.
9. Visual evidence: 1-2 concise factual sentences describing specific visible diagnostic markers.
10. Recommendation: Practical, actionable agricultural guidance.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    plant_detected: { type: "BOOLEAN" },
    leaf_detected: { type: "BOOLEAN" },
    plant_species: { type: "STRING", nullable: true },
    disease_class_id: { type: "INTEGER", nullable: true },
    disease_class: { type: "STRING" },
    scientific_name: { type: "STRING", nullable: true },
    severity: { type: "STRING", enum: ["none", "mild", "moderate", "severe", "unknown"] },
    model_confidence: { type: "NUMBER" },
    bounding_box: {
      type: "OBJECT",
      nullable: true,
      properties: {
        x: { type: "NUMBER" },
        y: { type: "NUMBER" },
        width: { type: "NUMBER" },
        height: { type: "NUMBER" },
      },
      required: ["x", "y", "width", "height"],
    },
    visual_evidence: { type: "STRING" },
    recommendation: { type: "STRING" },
  },
  required: [
    "plant_detected",
    "leaf_detected",
    "disease_class",
    "severity",
    "model_confidence",
    "visual_evidence",
    "recommendation",
  ],
};

/**
 * Validates and sanitizes the raw Gemini response into the canonical result contract.
 */
function sanitizeGeminiResult(raw: GeminiRawResponse, latencyMs: number): PlantAnalysisResult {
  const plantDetected = Boolean(raw.plant_detected);
  const leafDetected = Boolean(raw.leaf_detected);

  let diseaseClassId: number | null = null;
  let diseaseClass = "unknown";
  let scientificName: string | null = raw.scientific_name || null;

  if (typeof raw.disease_class_id === "number" && raw.disease_class_id >= 0 && raw.disease_class_id <= 8) {
    diseaseClassId = raw.disease_class_id;
    const mapping = CANONICAL_CLASS_MAP[diseaseClassId];
    diseaseClass = mapping.key;
    if (!scientificName && mapping.scientificName) {
      scientificName = mapping.scientificName;
    }
  } else if (raw.disease_class && raw.disease_class !== "unknown") {
    // Attempt reverse lookup if class string matches
    const entry = Object.entries(CANONICAL_CLASS_MAP).find(([, v]) => v.key === raw.disease_class);
    if (entry) {
      diseaseClassId = Number(entry[0]);
      diseaseClass = entry[1].key;
      if (!scientificName) scientificName = entry[1].scientificName;
    }
  }

  let severity: "none" | "mild" | "moderate" | "severe" | "unknown" = "unknown";
  if (raw.severity && VALID_SEVERITIES.has(raw.severity)) {
    severity = raw.severity;
  } else if (!plantDetected || diseaseClassId === 0) {
    severity = "none";
  }

  let confidence = typeof raw.model_confidence === "number" ? raw.model_confidence : 0.5;
  confidence = Math.max(0.0, Math.min(1.0, confidence));

  let boundingBox: NormalizedBoundingBox | null = null;
  if (raw.bounding_box && typeof raw.bounding_box === "object") {
    let { x, y, width, height } = raw.bounding_box;
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof width === "number" &&
      typeof height === "number" &&
      !isNaN(x) && !isNaN(y) && !isNaN(width) && !isNaN(height)
    ) {
      // Clamp harmless boundary floating point errors
      x = Math.max(0.0, Math.min(1.0, Number(x.toFixed(4))));
      y = Math.max(0.0, Math.min(1.0, Number(y.toFixed(4))));
      width = Math.max(0.0, Math.min(1.0 - x, Number(width.toFixed(4))));
      height = Math.max(0.0, Math.min(1.0 - y, Number(height.toFixed(4))));

      if (width > 0.01 && height > 0.01) {
        boundingBox = { x, y, width, height };
      }
    }
  }

  return {
    provider: "gemini",
    plant_detected: plantDetected,
    leaf_detected: leafDetected,
    plant_species: raw.plant_species || (plantDetected ? "Tomato" : null),
    disease_class_id: diseaseClassId,
    disease_class: diseaseClass,
    scientific_name: scientificName,
    severity,
    model_confidence: Number(confidence.toFixed(3)),
    bounding_box: boundingBox,
    visual_evidence: raw.visual_evidence || (plantDetected ? "Plant foliage analyzed." : "No plant detected."),
    recommendation: raw.recommendation || (diseaseClassId === 0 ? "Maintain standard crop monitoring." : "Inspect crop condition."),
    latency_ms: Math.round(latencyMs),
  };
}

import { GoogleGenAI, Type } from "@google/genai";

/**
 * Normalizes model identifier to ensure strict canonical string without redundant prefixes.
 */
export function normalizeModelName(rawModel?: string): string {
  if (!rawModel) return "gemini-2.5-flash";
  let m = rawModel.trim();
  while (m.toLowerCase().startsWith("models/")) {
    m = m.substring(7).trim();
  }
  m = m.replace(/:[a-zA-Z0-9_-]+$/, "").trim();
  return m || "gemini-2.5-flash";
}

/**
 * Diagnostics logger for server-side troubleshooting (NEVER logs keys or image payloads)
 */
function logSafeDiagnostics(info: {
  provider: string;
  model: string;
  sdkVersion: string;
  apiVersion: string;
  endpoint: string;
  httpStatus?: number | string;
  geminiErrorStatus?: string;
  geminiErrorMessage?: string;
  diagnosticId?: string;
}) {
  if (info.diagnosticId) console.log(`[AI-DIAGNOSTIC] Diagnostic ID:      ${info.diagnosticId}`);
  console.log(`[AI-DIAGNOSTIC] Provider:           ${info.provider}`);
  console.log(`[AI-DIAGNOSTIC] Model:              ${info.model}`);
  console.log(`[AI-DIAGNOSTIC] SDK Version:        ${info.sdkVersion}`);
  console.log(`[AI-DIAGNOSTIC] API Version:        ${info.apiVersion}`);
  console.log(`[AI-DIAGNOSTIC] Endpoint:           ${info.endpoint}`);
  if (info.httpStatus !== undefined) {
    console.log(`[AI-DIAGNOSTIC] HTTP Status:        ${info.httpStatus}`);
  }
  if (info.geminiErrorStatus) {
    console.log(`[AI-DIAGNOSTIC] Gemini Error Status:${info.geminiErrorStatus}`);
  }
  if (info.geminiErrorMessage) {
    console.log(`[AI-DIAGNOSTIC] Gemini Error Msg:   ${info.geminiErrorMessage}`);
  }
}

/**
 * Extracts and sanitizes error details from any caught error.
 */
export function extractSanitizedGeminiError(err: any): {
  httpStatus: number;
  geminiStatus: string;
  geminiMessage: string;
} {
  let httpStatus = typeof err?.status === "number" ? err.status : (typeof err?.statusCode === "number" ? err.statusCode : 500);
  let geminiStatus = err?.name || "ERROR";
  let rawMessage = err?.message || "Unknown error during Gemini processing";

  // Check if message is a JSON error payload from Google GenAI SDK
  if (typeof rawMessage === "string" && rawMessage.trim().startsWith("{") && rawMessage.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(rawMessage.trim());
      if (parsed?.error) {
        if (typeof parsed.error.code === "number") httpStatus = parsed.error.code;
        if (typeof parsed.error.status === "string") geminiStatus = parsed.error.status;
        if (typeof parsed.error.message === "string") rawMessage = parsed.error.message;
      }
    } catch {
      // Keep raw string
    }
  }

  // Handle specific known error scenarios
  const lowerMsg = rawMessage.toLowerCase();
  if (lowerMsg.includes("gemini_api_key is not configured") || lowerMsg.includes("api key is not configured")) {
    httpStatus = 500;
    geminiStatus = "MISSING_API_KEY";
  } else if (
    lowerMsg.includes("api key not valid") ||
    lowerMsg.includes("invalid key") ||
    lowerMsg.includes("api_key_invalid") ||
    lowerMsg.includes("api key expired")
  ) {
    httpStatus = 400;
    geminiStatus = "API_KEY_INVALID";
  } else if (lowerMsg.includes("not found for api version") || lowerMsg.includes("404") || lowerMsg.includes("model not found")) {
    httpStatus = 404;
    geminiStatus = "MODEL_NOT_FOUND";
  } else if (lowerMsg.includes("resource_exhausted") || httpStatus === 429 || lowerMsg.includes("quota")) {
    httpStatus = 429;
    geminiStatus = "RATE_LIMIT_EXCEEDED";
  } else if (lowerMsg.includes("permission_denied") || httpStatus === 403) {
    httpStatus = 403;
    geminiStatus = "PERMISSION_DENIED";
  }

  // Strict sanitization - NEVER leak keys or credentials
  const sanitizedMessage = String(rawMessage)
    .replace(/AIzaSy[a-zA-Z0-9_-]+/g, "REDACTED")
    .replace(/key=[^& \t\r\n\]\)]+/gi, "key=REDACTED")
    .replace(/Bearer [a-zA-Z0-9._-]+/gi, "Bearer REDACTED");

  return {
    httpStatus,
    geminiStatus,
    geminiMessage: sanitizedMessage,
  };
}

/**
 * Executes Gemini Vision inference with robust structured output.
 */
export async function executeGeminiVision(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<PlantAnalysisResult> {
  const startTime = performance.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in server environment.");
  }

  // Sanitize model identifier to prevent 404 from accidental duplicate 'models/' prefix or whitespace
  const model = normalizeModelName(process.env.GEMINI_MODEL);

  // Clean base64 string
  let cleanBase64 = imageBase64;
  if (imageBase64.includes(",")) {
    const parts = imageBase64.split(",");
    cleanBase64 = parts[1] || parts[0];
  }
  cleanBase64 = cleanBase64.replace(/\s+/g, "");

  const safeEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  logSafeDiagnostics({
    provider: "gemini",
    model,
    sdkVersion: "2.19.0",
    apiVersion: "v1beta",
    endpoint: safeEndpoint,
  });

  // Attempt 1: Official Google GenAI SDK
  try {
    const ai = new GoogleGenAI({ apiKey });

    const sdkSchema = {
      type: Type.OBJECT,
      properties: {
        plant_detected: { type: Type.BOOLEAN },
        leaf_detected: { type: Type.BOOLEAN },
        plant_species: { type: Type.STRING, nullable: true },
        disease_class_id: { type: Type.INTEGER, nullable: true },
        disease_class: { type: Type.STRING },
        scientific_name: { type: Type.STRING, nullable: true },
        severity: { type: Type.STRING, enum: ["none", "mild", "moderate", "severe", "unknown"] },
        model_confidence: { type: Type.NUMBER },
        bounding_box: {
          type: Type.OBJECT,
          nullable: true,
          properties: {
            x: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
            width: { type: Type.NUMBER },
            height: { type: Type.NUMBER },
          },
          required: ["x", "y", "width", "height"],
        },
        visual_evidence: { type: Type.STRING },
        recommendation: { type: Type.STRING },
      },
      required: [
        "plant_detected",
        "leaf_detected",
        "disease_class",
        "severity",
        "model_confidence",
        "visual_evidence",
        "recommendation",
      ],
    };

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Analyze this agricultural plant image carefully. Detect any target crop, leaf, pathology, or non-plant elements, and output strict structured JSON following the specified schema.",
            },
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: sdkSchema,
        temperature: 0.1,
      },
    });

    const latencyMs = performance.now() - startTime;
    const rawText = typeof response.text === "string" ? response.text : (response as any).text?.();

    if (!rawText) {
      throw new Error("Empty or malformed candidate response received from Gemini Vision.");
    }

    logSafeDiagnostics({
      provider: "gemini",
      model,
      sdkVersion: "2.19.0",
      apiVersion: "v1beta",
      endpoint: safeEndpoint,
      httpStatus: 200,
    });

    let parsedJson: GeminiRawResponse;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (err) {
      console.error("[AI] Failed to parse Gemini response as JSON:", rawText);
      throw new Error("Gemini Vision returned an unparseable structured response.");
    }

    return sanitizeGeminiResult(parsedJson, latencyMs);
  } catch (sdkError: any) {
    const errorDetails = extractSanitizedGeminiError(sdkError);

    logSafeDiagnostics({
      provider: "gemini",
      model,
      sdkVersion: "2.19.0",
      apiVersion: "v1beta",
      endpoint: safeEndpoint,
      httpStatus: errorDetails.httpStatus,
      geminiErrorStatus: errorDetails.geminiStatus,
      geminiErrorMessage: errorDetails.geminiMessage,
    });

    // Attempt 2: Fallback via direct REST using header authentication (x-goog-api-key)
    console.warn(`[AI] SDK inference failed (${errorDetails.httpStatus}: ${errorDetails.geminiStatus}), attempting REST fallback...`);
    try {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Analyze this agricultural plant image carefully. Detect any target crop, leaf, pathology, or non-plant elements, and output strict structured JSON following the specified schema.",
              },
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      };

      const restResponse = await fetch(restUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      const latencyMs = performance.now() - startTime;

      if (!restResponse.ok) {
        let errorDetail = `HTTP ${restResponse.status}`;
        let restStatus = restResponse.statusText;
        try {
          const errJson = await restResponse.json();
          if (errJson?.error?.message) {
            errorDetail = errJson.error.message;
          }
          if (errJson?.error?.status) {
            restStatus = errJson.error.status;
          }
        } catch {
          // Ignore JSON parse failure on error response
        }

        const sanitizedRestDetail = errorDetail
          .replace(/AIzaSy[a-zA-Z0-9_-]+/g, "REDACTED")
          .replace(/key=[^& \t\r\n\]\)]+/gi, "key=REDACTED");

        logSafeDiagnostics({
          provider: "gemini",
          model,
          sdkVersion: "2.19.0",
          apiVersion: "v1beta (REST fallback)",
          endpoint: `generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          httpStatus: restResponse.status,
          geminiErrorStatus: restStatus,
          geminiErrorMessage: sanitizedRestDetail,
        });

        const fallbackErr = new Error(`Gemini Vision service error: ${restResponse.status} (${restStatus}) - ${sanitizedRestDetail}`);
        (fallbackErr as any).status = restResponse.status;
        (fallbackErr as any).name = restStatus;
        throw fallbackErr;
      }

      const resultData = await restResponse.json();
      const rawText = resultData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Empty or malformed candidate response received from Gemini Vision REST fallback.");
      }

      let parsedJson: GeminiRawResponse;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (err) {
        console.error("[AI] Failed to parse Gemini REST fallback response as JSON:", rawText);
        throw new Error("Gemini Vision returned an unparseable structured response.");
      }

      return sanitizeGeminiResult(parsedJson, latencyMs);
    } catch (restErr: any) {
      // Re-throw with preserved status
      throw restErr?.status ? restErr : sdkError;
    }
  }
}

/**
 * Universal Server Handler (Vercel Serverless Function & Node.js)
 */
export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const model = normalizeModelName(process.env.GEMINI_MODEL);
  const keyPresent = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== "" &&
    process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
  );

  // Safe server-side diagnostic GET endpoint
  if (req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: keyPresent ? "ready" : "unconfigured",
        provider: "gemini",
        model,
        sdk_version: "2.19.0",
        api_version: "v1beta",
        api_method: "ai.models.generateContent",
        gemini_api_key_present: keyPresent,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method Not Allowed. Use POST.", code: "METHOD_NOT_ALLOWED" }));
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON payload in request body.", code: "INVALID_JSON" }));
        return;
      }
    }

    // Support diagnostic test payload
    if (body?.diagnostic_check === true) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: keyPresent ? "ready" : "unconfigured",
          provider: "gemini",
          model,
          sdk_version: "2.19.0",
          api_version: "v1beta",
          api_method: "ai.models.generateContent",
          gemini_api_key_present: keyPresent,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    const image = body?.image || body?.dataUrl || body?.base64;
    let mimeType = body?.mimeType || "image/jpeg";

    if (!image || typeof image !== "string" || image.trim().length === 0) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing required 'image' base64 data in payload.", code: "MISSING_IMAGE" }));
      return;
    }

    if (image.length > MAX_PAYLOAD_BYTES) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Image payload exceeds maximum limit of 10MB.", code: "PAYLOAD_TOO_LARGE" }));
      return;
    }

    // Extract MIME type if data URL
    if (image.startsWith("data:")) {
      const mimeMatch = image.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    }

    const supportedMimes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (!supportedMimes.has(mimeType.toLowerCase())) {
      res.statusCode = 415;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Unsupported image format: ${mimeType}. Supported: JPEG, PNG, WEBP.`, code: "UNSUPPORTED_MIME" }));
      return;
    }

    console.log(`[AI] Provider: Gemini | Image received (${mimeType}, length: ${image.length}) | Analyzing...`);
    const analysisResult = await executeGeminiVision(image, mimeType);
    console.log(`[AI] Analysis completed in ${analysisResult.latency_ms}ms | Plant: ${analysisResult.plant_detected} | Disease: ${analysisResult.disease_class} | Box: ${analysisResult.bounding_box ? "present" : "null"}`);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(analysisResult));
  } catch (err: any) {
    const diagnosticId = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const { httpStatus, geminiStatus, geminiMessage } = extractSanitizedGeminiError(err);

    logSafeDiagnostics({
      diagnosticId,
      provider: "gemini",
      model,
      sdkVersion: "2.19.0",
      apiVersion: "v1beta",
      endpoint: `generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      httpStatus,
      geminiErrorStatus: geminiStatus,
      geminiErrorMessage: geminiMessage,
    });

    const statusCode = typeof httpStatus === "number" && httpStatus >= 400 && httpStatus <= 599 ? httpStatus : 500;
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "GEMINI_REQUEST_FAILED",
        provider: "gemini",
        model,
        sdk_version: "2.19.0",
        api_version: "v1beta",
        api_method: "ai.models.generateContent",
        gemini_api_key_present: keyPresent,
        http_status: statusCode,
        gemini_status: geminiStatus,
        gemini_message: geminiMessage,
        diagnostic_id: diagnosticId,
      })
    );
  }
}
