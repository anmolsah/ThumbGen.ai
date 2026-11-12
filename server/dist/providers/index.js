/**
 * providers/index.ts
 *
 * Unified provider entry point (PLAN.md Sections 4 & 12 Phase 2).
 * Exposes `generate(input)` and adapter lookup across `openrouter`, `xai`, and `mock`.
 */
import { loadRegistryConfig, } from "../configs/registryValidator.js";
import { MockAdapter } from "./mock.js";
import { OpenRouterAdapter } from "./openrouter.js";
import { normalizeResolutionTier } from "./paramMapper.js";
import { ProviderError, } from "./types.js";
import { XaiAdapter } from "./xai.js";
export * from "./types.js";
export * from "./paramMapper.js";
export * from "./openrouter.js";
export * from "./xai.js";
export * from "./mock.js";
const adapters = {
    openrouter: new OpenRouterAdapter(),
    xai: new XaiAdapter(),
    mock: new MockAdapter(),
};
export function getProviderAdapter(name) {
    const adapter = adapters[name];
    if (!adapter) {
        throw new ProviderError({
            code: "INVALID_PARAMETERS",
            message: `Unknown provider adapter '${name}'`,
            retryable: false,
            provider: String(name),
            model_id: "unknown",
        });
    }
    return adapter;
}
const TIER_RANK = {
    "1K": 1,
    "2K": 2,
    "4K": 3,
};
/**
 * Returns the maximum resolution tier supported across any plan for a given mode.
 */
export function getModeMaxResolution(modeCfg) {
    let maxTier = "1K";
    for (const planId of ["starter", "creator", "pro"]) {
        const t = modeCfg.max_resolution_by_plan[planId];
        if (t && TIER_RANK[t] > TIER_RANK[maxTier]) {
            maxTier = t;
        }
    }
    return maxTier;
}
/**
 * Returns the ordered list of verified, enabled candidates for a given mode that can
 * satisfy the requested resolution tier and reference image requirement.
 */
export function getEligibleCandidatesForMode(mode, requestedResolution, hasReferenceImages = false, registryOverride) {
    const registry = registryOverride ?? loadRegistryConfig();
    const modeCfg = registry.modes[mode];
    if (!modeCfg || !modeCfg.enabled) {
        throw new ProviderError({
            code: "INVALID_PARAMETERS",
            message: `Unknown or disabled generation mode '${mode}'`,
            retryable: false,
            provider: "registry",
            model_id: mode,
        });
    }
    const tier = normalizeResolutionTier(requestedResolution, "registry", mode);
    const modeMaxRes = getModeMaxResolution(modeCfg);
    if (TIER_RANK[tier] > TIER_RANK[modeMaxRes]) {
        throw new ProviderError({
            code: "UNSUPPORTED_CAPABILITY",
            message: `Mode '${mode}' supports up to ${modeMaxRes} resolution (requested ${tier})`,
            retryable: false,
            provider: "registry",
            model_id: mode,
        });
    }
    const eligible = modeCfg.candidates.filter((c) => {
        if (!c.model_id || c.est_cost_usd === null || !c.verified_at) {
            return false;
        }
        if (!c.license_checked) {
            return false;
        }
        const prov = registry.providers[c.provider];
        if (!prov || !prov.enabled) {
            return false;
        }
        if (TIER_RANK[tier] > TIER_RANK[c.default_resolution]) {
            return false;
        }
        if (hasReferenceImages && c.supports_reference_image === false) {
            return false;
        }
        return true;
    });
    return eligible;
}
/**
 * Unified provider generation entry point:
 *   generate({ mode, prompt, aspectRatio, resolution, referenceImages, seed })
 *     -> { assetBytesOrUrl, meta: { provider, model_id, latency_ms, billed_cost_usd, request_params, resolution_actual } }
 */
export async function generate(input, options) {
    const useMock = options?.forceMock === true ||
        process.env.MOCK_PROVIDERS === "true" ||
        input.candidate?.provider === "mock";
    if (useMock) {
        const mockModelId = input.candidate?.model_id || `mock/${input.mode}-generator`;
        return adapters.mock.generateWithCandidate(mockModelId, input);
    }
    if (input.candidate) {
        const adapter = getProviderAdapter(input.candidate.provider);
        return adapter.generateWithCandidate(input.candidate.model_id, input);
    }
    const hasRefs = Boolean(input.referenceImages && input.referenceImages.length > 0);
    const candidates = getEligibleCandidatesForMode(input.mode, input.resolution, hasRefs, options?.registry);
    if (candidates.length === 0) {
        throw new ProviderError({
            code: "UNSUPPORTED_CAPABILITY",
            message: `No verified candidate model in mode '${input.mode}' supports resolution '${input.resolution}'${hasRefs ? " with reference images" : ""}`,
            retryable: false,
            provider: "registry",
            model_id: input.mode,
        });
    }
    const primary = candidates[0];
    const adapter = getProviderAdapter(primary.provider);
    return adapter.generateWithCandidate(primary.model_id, input);
}
