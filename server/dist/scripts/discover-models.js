/**
 * scripts/discover-models.ts
 *
 * Queries the official model-list endpoints for enabled providers:
 *   1. OpenRouter:
 *      - GET https://openrouter.ai/api/v1/images/models
 *      - GET https://openrouter.ai/api/v1/models?output_modalities=image
 *      - GET https://openrouter.ai/api/v1/images/models/{model}/endpoints (for candidate families)
 *   2. xAI (Grok):
 *      - GET https://api.x.ai/v1/image-generation-models
 *      - GET https://api.x.ai/v1/models
 *
 * Writes the normalized + raw discovery snapshot to:
 *   - server/config/models.snapshot.json
 *   - config/models.snapshot.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load server/.env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const CANDIDATE_PREFIXES = [
    "x-ai/",
    "google/gemini-",
    "bytedance-seed/seedream-5",
    "openai/gpt-image-",
    "black-forest-labs/flux",
];
async function fetchJsonWithTimeout(url, headers, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        const text = await res.text();
        let data = null;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = null;
        }
        if (!res.ok) {
            return {
                ok: false,
                status: res.status,
                data,
                errorText: text.slice(0, 500),
            };
        }
        return { ok: true, status: res.status, data };
    }
    catch (err) {
        return {
            ok: false,
            status: 0,
            data: null,
            errorText: err?.message || String(err),
        };
    }
    finally {
        clearTimeout(timer);
    }
}
function extractSupportedInfo(supportedParams) {
    if (!supportedParams) {
        return { params: null, sizes: null, aspectRatios: null, maxRefs: null };
    }
    if (Array.isArray(supportedParams)) {
        return {
            params: supportedParams,
            sizes: null,
            aspectRatios: null,
            maxRefs: null,
        };
    }
    if (typeof supportedParams === "object") {
        const sizes = Array.isArray(supportedParams?.resolution?.values)
            ? supportedParams.resolution.values.map(String)
            : Array.isArray(supportedParams?.size?.values)
                ? supportedParams.size.values.map(String)
                : null;
        const aspectRatios = Array.isArray(supportedParams?.aspect_ratio?.values)
            ? supportedParams.aspect_ratio.values.map(String)
            : null;
        const maxRefs = typeof supportedParams?.input_references?.max === "number"
            ? supportedParams.input_references.max
            : null;
        return {
            params: supportedParams,
            sizes,
            aspectRatios,
            maxRefs,
        };
    }
    return { params: null, sizes: null, aspectRatios: null, maxRefs: null };
}
async function discoverOpenRouterModels() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const headers = {
        Accept: "application/json",
    };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const endpoints = [
        "https://openrouter.ai/api/v1/images/models",
        "https://openrouter.ai/api/v1/models?output_modalities=image",
    ];
    const byId = new Map();
    const errors = [];
    let anySuccess = false;
    for (const endpoint of endpoints) {
        const res = await fetchJsonWithTimeout(endpoint, headers);
        if (!res.ok) {
            errors.push(`${endpoint} -> HTTP ${res.status}: ${res.errorText ?? "failed"}`);
            continue;
        }
        anySuccess = true;
        const list = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data)
                ? res.data
                : [];
        for (const item of list) {
            const id = item?.id || item?.model_id;
            if (!id || typeof id !== "string")
                continue;
            const inputModalities = Array.isArray(item?.architecture?.input_modalities)
                ? item.architecture.input_modalities
                : [];
            const outputModalities = Array.isArray(item?.architecture?.output_modalities)
                ? item.architecture.output_modalities
                : ["image"];
            const { params, sizes, aspectRatios, maxRefs } = extractSupportedInfo(item?.supported_parameters);
            const supportsRef = inputModalities.includes("image") || (maxRefs !== null && maxRefs > 0);
            const existing = byId.get(id);
            if (!existing) {
                byId.set(id, {
                    provider: "openrouter",
                    model_id: id,
                    name: item?.name || id,
                    created: typeof item?.created === "number" ? item.created : null,
                    input_modalities: inputModalities,
                    output_modalities: outputModalities,
                    supports_reference_image: supportsRef,
                    max_reference_images: maxRefs ?? (supportsRef ? 1 : 0),
                    pricing: item?.pricing ?? null,
                    endpoint_pricing: null,
                    supported_parameters: params,
                    supported_sizes: sizes,
                    supported_aspect_ratios: aspectRatios,
                    source_endpoint: endpoint,
                    raw: item,
                });
            }
            else {
                if (!existing.pricing && item?.pricing) {
                    existing.pricing = item.pricing;
                }
                if (existing.input_modalities.length === 0 &&
                    inputModalities.length > 0) {
                    existing.input_modalities = inputModalities;
                }
                if (supportsRef) {
                    existing.supports_reference_image = true;
                }
                if (maxRefs !== null && maxRefs > existing.max_reference_images) {
                    existing.max_reference_images = maxRefs;
                }
                if ((!existing.supported_parameters ||
                    Array.isArray(existing.supported_parameters)) &&
                    params &&
                    !Array.isArray(params)) {
                    existing.supported_parameters = params;
                }
                else if (!existing.supported_parameters && params) {
                    existing.supported_parameters = params;
                }
                if (!existing.supported_sizes && sizes) {
                    existing.supported_sizes = sizes;
                }
                if (!existing.supported_aspect_ratios && aspectRatios) {
                    existing.supported_aspect_ratios = aspectRatios;
                }
                existing.raw = { ...existing.raw, ...item };
            }
        }
    }
    // Query per-model endpoints metadata for candidate families to capture provider-specific pricing/limits
    const candidateModels = Array.from(byId.values()).filter((m) => CANDIDATE_PREFIXES.some((prefix) => m.model_id.startsWith(prefix)));
    await Promise.all(candidateModels.map(async (model) => {
        const epPath = model.raw?.endpoints;
        const url = typeof epPath === "string" && epPath.startsWith("/")
            ? `https://openrouter.ai${epPath}`
            : `https://openrouter.ai/api/v1/images/models/${model.model_id}/endpoints`;
        const res = await fetchJsonWithTimeout(url, headers, 10000);
        if (res.ok && res.data) {
            const epList = Array.isArray(res.data?.data?.endpoints)
                ? res.data.data.endpoints
                : Array.isArray(res.data?.endpoints)
                    ? res.data.endpoints
                    : Array.isArray(res.data?.data)
                        ? res.data.data
                        : null;
            if (epList) {
                model.endpoint_pricing = epList.map((ep) => ({
                    name: ep?.name || ep?.provider_name || null,
                    pricing: ep?.pricing ?? null,
                    supported_parameters: ep?.supported_parameters ?? null,
                }));
            }
        }
    }));
    return {
        ok: anySuccess,
        endpoints_tried: endpoints,
        models: Array.from(byId.values()).sort((a, b) => a.model_id.localeCompare(b.model_id)),
        ...(errors.length > 0 && !anySuccess ? { error: errors.join("; ") } : {}),
    };
}
async function discoverXaiModels() {
    const apiKey = process.env.XAI_API_KEY;
    const endpoints = [
        "https://api.x.ai/v1/image-generation-models",
        "https://api.x.ai/v1/models",
    ];
    if (!apiKey) {
        return {
            ok: false,
            endpoints_tried: endpoints,
            models: [],
            error: "XAI_API_KEY is not set in environment",
        };
    }
    const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
    };
    const byId = new Map();
    const errors = [];
    let anySuccess = false;
    for (const endpoint of endpoints) {
        const res = await fetchJsonWithTimeout(endpoint, headers);
        if (!res.ok) {
            errors.push(`${endpoint} -> HTTP ${res.status}: ${res.errorText ?? "failed"}`);
            continue;
        }
        anySuccess = true;
        const list = Array.isArray(res.data?.models)
            ? res.data.models
            : Array.isArray(res.data?.data)
                ? res.data.data
                : Array.isArray(res.data)
                    ? res.data
                    : [];
        for (const item of list) {
            const id = item?.id;
            if (!id || typeof id !== "string")
                continue;
            const inputModalities = Array.isArray(item?.input_modalities)
                ? item.input_modalities
                : [];
            const outputModalities = Array.isArray(item?.output_modalities)
                ? item.output_modalities
                : [];
            const isImageModel = endpoint.includes("image-generation-models") ||
                outputModalities.includes("image") ||
                id.toLowerCase().includes("image") ||
                id.toLowerCase().includes("imagine");
            if (!isImageModel)
                continue;
            const pricing = item?.image_price !== undefined ||
                item?.price !== undefined ||
                item?.pricing
                ? {
                    ...(item?.pricing || {}),
                    ...(item?.image_price !== undefined
                        ? { image_price: item.image_price }
                        : {}),
                    ...(item?.price !== undefined ? { price: item.price } : {}),
                }
                : null;
            const supportsRef = inputModalities.includes("image");
            if (!byId.has(id)) {
                byId.set(id, {
                    provider: "xai",
                    model_id: id,
                    name: item?.name || id,
                    created: typeof item?.created === "number" ? item.created : null,
                    input_modalities: inputModalities.length > 0 ? inputModalities : ["text"],
                    output_modalities: outputModalities.length > 0 ? outputModalities : ["image"],
                    supports_reference_image: supportsRef,
                    max_reference_images: supportsRef ? 3 : 0,
                    pricing,
                    endpoint_pricing: null,
                    supported_parameters: null,
                    supported_sizes: null,
                    supported_aspect_ratios: null,
                    source_endpoint: endpoint,
                    raw: item,
                });
            }
        }
    }
    return {
        ok: anySuccess,
        endpoints_tried: endpoints,
        models: Array.from(byId.values()).sort((a, b) => a.model_id.localeCompare(b.model_id)),
        ...(errors.length > 0 && !anySuccess ? { error: errors.join("; ") } : {}),
    };
}
async function main() {
    console.log("Discovering models from enabled providers (openrouter, xai)...");
    const [orResult, xaiResult] = await Promise.all([
        discoverOpenRouterModels(),
        discoverXaiModels(),
    ]);
    const snapshot = {
        fetched_at: new Date().toISOString(),
        providers_queried: {
            openrouter: {
                ok: orResult.ok,
                endpoints_tried: orResult.endpoints_tried,
                model_count: orResult.models.length,
                ...(orResult.error ? { error: orResult.error } : {}),
            },
            xai: {
                ok: xaiResult.ok,
                endpoints_tried: xaiResult.endpoints_tried,
                model_count: xaiResult.models.length,
                ...(xaiResult.error ? { error: xaiResult.error } : {}),
            },
        },
        models: [...orResult.models, ...xaiResult.models],
    };
    const serverSnapshotPath = path.resolve(__dirname, "../config/models.snapshot.json");
    const rootSnapshotPath = path.resolve(__dirname, "../../config/models.snapshot.json");
    fs.mkdirSync(path.dirname(serverSnapshotPath), { recursive: true });
    fs.writeFileSync(serverSnapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
    fs.mkdirSync(path.dirname(rootSnapshotPath), { recursive: true });
    fs.writeFileSync(rootSnapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
    console.log(`OpenRouter: ok=${orResult.ok}, discovered=${orResult.models.length} image models`);
    if (orResult.error)
        console.warn(`  OpenRouter error: ${orResult.error}`);
    console.log(`xAI:        ok=${xaiResult.ok}, discovered=${xaiResult.models.length} image models`);
    if (xaiResult.error)
        console.warn(`  xAI error: ${xaiResult.error}`);
    console.log(`Snapshot written to:\n  - ${serverSnapshotPath}\n  - ${rootSnapshotPath}`);
    if (!orResult.ok && !xaiResult.ok) {
        process.exitCode = 1;
    }
}
main().catch((err) => {
    console.error("Fatal error in discover-models:", err);
    process.exit(1);
});
