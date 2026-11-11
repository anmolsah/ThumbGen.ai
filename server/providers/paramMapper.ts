/**
 * providers/paramMapper.ts
 *
 * Per-model parameter mapping for OpenRouter and xAI adapters.
 * Enforces:
 *   - Pitfall P2: Explicit size/resolution and quality always sent; never rely on provider defaults.
 *   - Pitfall P3: Model-specific parameter formats (tier strings vs quality vs aspect ratio clamping).
 *   - Pitfall P4: Rejects 4K requests on models that cannot produce 4K natively (unless upscaler is configured).
 */

import {
  loadModelsSnapshot,
  type ResolutionTier,
} from "../configs/registryValidator.js";
import type { DiscoveredModel } from "../scripts/discover-models.js";
import { ProviderError, type GenerateInput } from "./types.js";

let cachedSnapshotMap: Map<string, DiscoveredModel> | null = null;

function getSnapshotModel(
  provider: string,
  modelId: string
): DiscoveredModel | undefined {
  if (!cachedSnapshotMap) {
    cachedSnapshotMap = new Map<string, DiscoveredModel>();
    try {
      const snap = loadModelsSnapshot();
      for (const m of snap.models) {
        cachedSnapshotMap.set(`${m.provider}:${m.model_id}`, m);
      }
    } catch {
      // Snapshot may not exist in isolated unit test environments
    }
  }
  return cachedSnapshotMap.get(`${provider}:${modelId}`);
}

const XAI_SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "2:3",
  "3:2",
  "9:19.5",
  "19.5:9",
  "9:20",
  "20:9",
  "1:2",
  "2:1",
];

/**
 * Normalizes resolution strings ("1k", "2k", "4k", "1K", "2K", "4K", or pixel dimensions like "1920x1080")
 * into canonical uppercase tier strings ("1K" | "2K" | "4K").
 * Prevents pixel-string rejection on models that require tier enums (Pitfall P3).
 */
export function normalizeResolutionTier(
  rawResolution: string,
  provider: string,
  modelId: string
): ResolutionTier {
  if (!rawResolution || typeof rawResolution !== "string") {
    throw new ProviderError({
      code: "INVALID_PARAMETERS",
      message: `Explicit resolution is required (Pitfall P2); got '${rawResolution}'`,
      retryable: false,
      provider,
      model_id: modelId,
    });
  }

  const trimmed = rawResolution.trim().toUpperCase();
  if (trimmed === "1K" || trimmed === "2K" || trimmed === "4K") {
    return trimmed;
  }

  // Map pixel-dimension strings ("WIDTHxHEIGHT") to resolution tiers (Pitfall P3)
  const pixelMatch = trimmed.match(/^(\d{3,5})\s*[X×]\s*(\d{3,5})$/);
  if (pixelMatch) {
    const w = parseInt(pixelMatch[1], 10);
    const h = parseInt(pixelMatch[2], 10);
    const longest = Math.max(w, h);
    if (longest >= 3840) return "4K";
    if (longest >= 1920) return "2K";
    return "1K";
  }

  throw new ProviderError({
    code: "INVALID_PARAMETERS",
    message: `Unsupported resolution format '${rawResolution}' for ${provider}/${modelId}`,
    retryable: false,
    provider,
    model_id: modelId,
  });
}

function parseRatioValue(ratio: string): number | null {
  const parts = ratio.split(":");
  if (parts.length !== 2) return null;
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  return w / h;
}

/**
 * Maps a requested aspect ratio (e.g. "16:9", "4:5", "1.91:1") to a valid aspect ratio
 * supported by the target model.
 */
export function normalizeAspectRatioForModel(
  requestedAspectRatio: string,
  supportedAspectRatios: string[] | null | undefined
): string {
  const clean = (requestedAspectRatio || "16:9").trim();

  // Explicit alias for social horizontal link cards (LinkedIn/Facebook 1.91:1)
  const effectiveRequest =
    clean === "1.91:1" &&
    (!supportedAspectRatios || !supportedAspectRatios.includes("1.91:1"))
      ? "16:9"
      : clean;

  if (!supportedAspectRatios || supportedAspectRatios.length === 0) {
    return effectiveRequest;
  }

  if (supportedAspectRatios.includes(effectiveRequest)) {
    return effectiveRequest;
  }

  const targetVal = parseRatioValue(effectiveRequest);
  if (targetVal === null) {
    return supportedAspectRatios.includes("16:9")
      ? "16:9"
      : supportedAspectRatios[0];
  }

  let bestRatio = supportedAspectRatios[0];
  let bestDiff = Infinity;

  for (const candidate of supportedAspectRatios) {
    if (candidate === "auto") continue;
    const val = parseRatioValue(candidate);
    if (val === null) continue;
    const diff = Math.abs(val - targetVal);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestRatio = candidate;
    }
  }

  return bestRatio;
}

/**
 * Maps universal GenerateInput into an explicit OpenRouter Image API (`POST /api/v1/images`) payload.
 */
export function mapOpenRouterParams(
  modelId: string,
  input: GenerateInput,
  explicitSnapshotModel?: DiscoveredModel
): Record<string, unknown> {
  const snap =
    explicitSnapshotModel ?? getSnapshotModel("openrouter", modelId);

  if (!input.prompt || !input.prompt.trim()) {
    throw new ProviderError({
      code: "INVALID_PARAMETERS",
      message: "Prompt is required",
      retryable: false,
      provider: "openrouter",
      model_id: modelId,
    });
  }

  const tier = normalizeResolutionTier(
    input.resolution,
    "openrouter",
    modelId
  );

  const supportedParamsObj =
    snap?.supported_parameters && !Array.isArray(snap.supported_parameters)
      ? (snap.supported_parameters as Record<string, any>)
      : null;

  const supportedSizes =
    snap?.supported_sizes ??
    (Array.isArray(supportedParamsObj?.resolution?.values)
      ? supportedParamsObj.resolution.values.map(String)
      : null);

  const supportedAspectRatios =
    snap?.supported_aspect_ratios ??
    (Array.isArray(supportedParamsObj?.aspect_ratio?.values)
      ? supportedParamsObj.aspect_ratio.values.map(String)
      : null);

  const aspectRatio = normalizeAspectRatioForModel(
    input.aspectRatio,
    supportedAspectRatios
  );

  const payload: Record<string, unknown> = {
    model: modelId,
    prompt: input.prompt.trim(),
    aspect_ratio: aspectRatio,
    n: 1,
  };

  // Determine whether this model uses 'resolution' or 'quality' (or both)
  const isGptImageFamily = modelId.startsWith("openai/gpt-image-");
  const isGrokFamily = modelId.startsWith("x-ai/grok-imagine-image");

  if (isGptImageFamily) {
    // OpenAI GPT Image models do NOT accept a 'resolution' parameter on OpenRouter;
    // their detail & billing tier is controlled by 'quality' ("low" | "medium" | "high").
    if (tier === "4K") {
      // GPT Image 2 outputs ~1024-1536px max natively; cannot natively produce 4K (3840x2160)
      throw new ProviderError({
        code: "UNSUPPORTED_CAPABILITY",
        message: `Model '${modelId}' does not natively output 4K resolution without a verified upscaler (Section 6 4K rule)`,
        retryable: false,
        provider: "openrouter",
        model_id: modelId,
      });
    }
    payload.quality =
      input.mode === "fast" || tier === "1K" ? "low" : "medium";
    payload.output_format = "png";
  } else {
    // Models that accept explicit 'resolution' ("1K", "2K", "4K")
    if (supportedSizes && supportedSizes.length > 0) {
      if (!supportedSizes.includes(tier)) {
        if (tier === "4K") {
          throw new ProviderError({
            code: "UNSUPPORTED_CAPABILITY",
            message: `Model '${modelId}' does not support 4K resolution (supported: ${supportedSizes.join(
              ", "
            )})`,
            retryable: false,
            provider: "openrouter",
            model_id: modelId,
          });
        }
        // If 1K was requested on a model whose lowest tier is 2K (e.g. seedream-5-0-lite), use 2K explicitly
        if (tier === "1K" && supportedSizes.includes("2K")) {
          payload.resolution = "2K";
        } else {
          throw new ProviderError({
            code: "UNSUPPORTED_CAPABILITY",
            message: `Model '${modelId}' does not support resolution '${tier}' (supported: ${supportedSizes.join(
              ", "
            )})`,
            retryable: false,
            provider: "openrouter",
            model_id: modelId,
          });
        }
      } else {
        payload.resolution = tier;
      }
    } else {
      // Fallback when model metadata has no resolution array: still send explicit resolution
      if (tier === "4K") {
        throw new ProviderError({
          code: "UNSUPPORTED_CAPABILITY",
          message: `Model '${modelId}' does not declare native 4K resolution support in models.snapshot.json`,
          retryable: false,
          provider: "openrouter",
          model_id: modelId,
        });
      }
      payload.resolution = tier;
    }

    // Grok 2.0 on OpenRouter accepts both 'resolution' AND 'quality' ("low" | "medium")
    if (isGrokFamily || supportedParamsObj?.quality) {
      payload.quality = input.mode === "fast" ? "low" : "medium";
    }

    if (supportedParamsObj?.output_format) {
      const formats: string[] = Array.isArray(
        supportedParamsObj.output_format.values
      )
        ? supportedParamsObj.output_format.values
        : ["png"];
      if (formats.includes("png")) {
        payload.output_format = "png";
      }
    }
  }

  // Reference images
  if (input.referenceImages && input.referenceImages.length > 0) {
    const supportsRef = snap ? snap.supports_reference_image : true;
    const maxRefs = snap ? snap.max_reference_images : 14;

    if (!supportsRef || maxRefs <= 0) {
      throw new ProviderError({
        code: "UNSUPPORTED_CAPABILITY",
        message: `Model '${modelId}' does not support reference images`,
        retryable: false,
        provider: "openrouter",
        model_id: modelId,
      });
    }
    if (input.referenceImages.length > maxRefs) {
      throw new ProviderError({
        code: "INVALID_PARAMETERS",
        message: `Model '${modelId}' accepts at most ${maxRefs} reference image(s), got ${input.referenceImages.length}`,
        retryable: false,
        provider: "openrouter",
        model_id: modelId,
      });
    }

    payload.input_references = input.referenceImages;
  }

  // Seed (only if supported by the model)
  if (
    input.seed !== undefined &&
    Number.isFinite(input.seed) &&
    supportedParamsObj?.seed
  ) {
    payload.seed = Math.floor(input.seed);
  }

  return payload;
}

/**
 * Maps universal GenerateInput into an explicit xAI direct API payload
 * (`/v1/images/generations` or `/v1/images/edits`).
 */
export function mapXaiParams(
  modelId: string,
  input: GenerateInput
): { endpointPath: "/images/generations" | "/images/edits"; body: Record<string, unknown> } {
  if (!input.prompt || !input.prompt.trim()) {
    throw new ProviderError({
      code: "INVALID_PARAMETERS",
      message: "Prompt is required",
      retryable: false,
      provider: "xai",
      model_id: modelId,
    });
  }

  const tier = normalizeResolutionTier(input.resolution, "xai", modelId);

  // Pitfall P4: Grok output tops out at 2K
  if (tier === "4K") {
    throw new ProviderError({
      code: "UNSUPPORTED_CAPABILITY",
      message: `xAI model '${modelId}' tops out at 2K resolution and cannot satisfy a 4K request (Pitfall P4)`,
      retryable: false,
      provider: "xai",
      model_id: modelId,
    });
  }

  const aspectRatio = normalizeAspectRatioForModel(
    input.aspectRatio,
    XAI_SUPPORTED_ASPECT_RATIOS
  );

  // xAI direct API expects lowercase "1k" or "2k"
  const body: Record<string, unknown> = {
    model: modelId,
    prompt: input.prompt.trim(),
    aspect_ratio: aspectRatio,
    resolution: tier.toLowerCase(),
    response_format: "b64_json",
    n: 1,
  };

  if (modelId.includes("2.0")) {
    body.quality = input.mode === "fast" ? "low" : "medium";
  }

  if (input.referenceImages && input.referenceImages.length > 0) {
    if (input.referenceImages.length > 3) {
      throw new ProviderError({
        code: "INVALID_PARAMETERS",
        message: `xAI model '${modelId}' supports at most 3 reference images, got ${input.referenceImages.length}`,
        retryable: false,
        provider: "xai",
        model_id: modelId,
      });
    }
    body.image =
      input.referenceImages.length === 1
        ? { url: input.referenceImages[0] }
        : input.referenceImages.map((url) => ({ url }));
    return { endpointPath: "/images/edits", body };
  }

  return { endpointPath: "/images/generations", body };
}

