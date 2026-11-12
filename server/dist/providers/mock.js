/**
 * providers/mock.ts
 *
 * Deterministic mock provider adapter for unit tests, contract tests,
 * chaos/fallback tests, and local zero-cost development (`MOCK_PROVIDERS=true`).
 */
import sharp from "sharp";
import { normalizeAspectRatioForModel, normalizeResolutionTier, } from "./paramMapper.js";
import { classifyProviderError, inspectImageResolution, ProviderError, } from "./types.js";
const attemptCounters = new Map();
let customFaultInjector = null;
export function setMockFaultInjector(injector) {
    customFaultInjector = injector;
}
export function resetMockState() {
    attemptCounters.clear();
    customFaultInjector = null;
}
export function getMockAttemptCount(modelId) {
    return attemptCounters.get(modelId) ?? 0;
}
function computeDimensionsForTierAndRatio(tier, aspectRatio) {
    const cleanRatio = normalizeAspectRatioForModel(aspectRatio, [
        "16:9",
        "9:16",
        "1:1",
        "4:5",
        "3:4",
        "4:3",
    ]);
    const baseLongEdge = tier === "4K" ? 3840 : tier === "2K" ? 1920 : 1280;
    switch (cleanRatio) {
        case "16:9":
            return {
                width: baseLongEdge,
                height: Math.round((baseLongEdge * 9) / 16),
            };
        case "9:16":
            return {
                width: Math.round((baseLongEdge * 9) / 16),
                height: baseLongEdge,
            };
        case "1:1":
            return {
                width: tier === "4K" ? 3840 : tier === "2K" ? 2048 : 1024,
                height: tier === "4K" ? 3840 : tier === "2K" ? 2048 : 1024,
            };
        case "4:5":
            return {
                width: Math.round((baseLongEdge * 4) / 5),
                height: baseLongEdge,
            };
        case "3:4":
            return {
                width: Math.round((baseLongEdge * 3) / 4),
                height: baseLongEdge,
            };
        case "4:3":
            return {
                width: baseLongEdge,
                height: Math.round((baseLongEdge * 3) / 4),
            };
        default:
            return {
                width: baseLongEdge,
                height: Math.round((baseLongEdge * 9) / 16),
            };
    }
}
export class MockAdapter {
    constructor() {
        this.name = "mock";
    }
    async generateWithCandidate(modelId, input) {
        const startMs = Date.now();
        const prevAttempts = attemptCounters.get(modelId) ?? 0;
        const currentAttempt = prevAttempts + 1;
        attemptCounters.set(modelId, currentAttempt);
        if (!input.prompt || !input.prompt.trim()) {
            throw new ProviderError({
                code: "INVALID_PARAMETERS",
                message: "Prompt is required",
                retryable: false,
                provider: this.name,
                model_id: modelId,
            });
        }
        const tier = normalizeResolutionTier(input.resolution, this.name, modelId);
        // Custom fault injector hook for chaos tests
        if (customFaultInjector) {
            await customFaultInjector(modelId, input, currentAttempt);
        }
        // Prompt-triggered deterministic error simulation
        const p = input.prompt;
        if (p.includes("__MOCK_FAIL_429__")) {
            throw classifyProviderError(429, '{"error":{"message":"Rate limit exceeded"}}', this.name, modelId);
        }
        if (p.includes("__MOCK_FAIL_500__") || p.includes("__MOCK_FAIL_503__")) {
            throw classifyProviderError(503, '{"error":{"message":"Upstream provider unavailable"}}', this.name, modelId);
        }
        if (p.includes("__MOCK_FAIL_TIMEOUT__")) {
            throw classifyProviderError(504, '{"error":{"message":"Gateway timeout"}}', this.name, modelId);
        }
        if (p.includes("__MOCK_FAIL_POLICY__")) {
            throw classifyProviderError(400, '{"error":{"message":"Request blocked by content_policy safety filter"}}', this.name, modelId);
        }
        if (p.includes("__MOCK_FAIL_400__")) {
            throw classifyProviderError(400, '{"error":{"message":"Invalid aspect_ratio parameter"}}', this.name, modelId);
        }
        const { width, height } = computeDimensionsForTierAndRatio(tier, input.aspectRatio);
        const assetBytes = await sharp({
            create: {
                width,
                height,
                channels: 3,
                background: { r: 24, g: 36, b: 64 },
            },
        })
            .png({ compressionLevel: 9 })
            .toBuffer();
        const resolutionActual = await inspectImageResolution(assetBytes);
        const latencyMs = Math.max(1, Date.now() - startMs);
        return {
            assetBytes,
            assetBytesOrUrl: assetBytes,
            mimeType: "image/png",
            meta: {
                provider: this.name,
                model_id: modelId,
                latency_ms: latencyMs,
                billed_cost_usd: 0,
                request_params: {
                    model: modelId,
                    prompt: input.prompt.trim(),
                    aspect_ratio: input.aspectRatio,
                    resolution: tier,
                    reference_count: input.referenceImages?.length ?? 0,
                    seed: input.seed ?? null,
                },
                resolution_actual: resolutionActual,
                upscaled: false,
            },
        };
    }
}
