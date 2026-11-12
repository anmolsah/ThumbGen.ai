/**
 * providers/xai.ts
 *
 * Direct xAI Image API adapter (`POST https://api.x.ai/v1/images/generations`
 * and `POST https://api.x.ai/v1/images/edits`).
 */
import { mapXaiParams } from "./paramMapper.js";
import { classifyProviderError, inspectImageResolution, ProviderError, } from "./types.js";
const DEFAULT_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_TIMEOUT_MS = 90000;
function sanitizeXaiRequestParamsForMeta(endpointPath, payload) {
    const clone = {
        endpoint: endpointPath,
        ...payload,
    };
    if (clone.image) {
        if (Array.isArray(clone.image)) {
            clone.image = clone.image.map((item) => {
                if (typeof item?.url === "string" && item.url.startsWith("data:")) {
                    return {
                        url: `${item.url.slice(0, 32)}...[redacted_b64_${item.url.length}_chars]`,
                    };
                }
                return item;
            });
        }
        else if (typeof clone.image?.url === "string" &&
            clone.image.url.startsWith("data:")) {
            const u = clone.image.url;
            clone.image = {
                url: `${u.slice(0, 32)}...[redacted_b64_${u.length}_chars]`,
            };
        }
    }
    return clone;
}
export class XaiAdapter {
    constructor(options) {
        this.name = "xai";
        this.baseUrl = (options?.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.apiKeyOverride = options?.apiKey;
        this.fetchImpl = options?.fetchImpl || fetch;
    }
    getApiKey(modelId) {
        const key = (this.apiKeyOverride ??
            process.env.XAI_API_KEY ??
            "").trim();
        if (!key) {
            throw new ProviderError({
                code: "AUTH_ERROR",
                message: "XAI_API_KEY is not configured in environment",
                retryable: false,
                provider: this.name,
                model_id: modelId,
            });
        }
        return key;
    }
    async generateWithCandidate(modelId, input) {
        const apiKey = this.getApiKey(modelId);
        const { endpointPath, body: requestPayload } = mapXaiParams(modelId, input);
        const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const startMs = Date.now();
        let response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}${endpointPath}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestPayload),
                signal: AbortSignal.timeout(timeoutMs),
            });
        }
        catch (err) {
            const isTimeout = err?.name === "TimeoutError" ||
                err?.name === "AbortError" ||
                String(err?.message || "").toLowerCase().includes("timeout") ||
                String(err?.message || "").toLowerCase().includes("aborted");
            throw new ProviderError({
                code: isTimeout ? "PROVIDER_TIMEOUT" : "NETWORK_ERROR",
                message: `xAI (${modelId}) ${isTimeout ? "request timed out" : "network error"}: ${err?.message || String(err)}`,
                retryable: true,
                provider: this.name,
                model_id: modelId,
            });
        }
        const rawText = await response.text();
        if (!response.ok) {
            throw classifyProviderError(response.status, rawText, this.name, modelId);
        }
        let body;
        try {
            body = JSON.parse(rawText);
        }
        catch {
            throw new ProviderError({
                code: "PROVIDER_5XX",
                message: `xAI (${modelId}) returned invalid JSON`,
                retryable: true,
                status: response.status,
                provider: this.name,
                model_id: modelId,
            });
        }
        const firstItem = Array.isArray(body?.data) ? body.data[0] : null;
        if (!firstItem) {
            throw new ProviderError({
                code: "NO_IMAGE_RETURNED",
                message: `xAI (${modelId}) returned no image data in response`,
                retryable: true,
                provider: this.name,
                model_id: modelId,
            });
        }
        let assetBytes;
        let mimeType = firstItem.media_type || "image/png";
        if (typeof firstItem.b64_json === "string" && firstItem.b64_json.length > 0) {
            const cleanB64 = firstItem.b64_json.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
            assetBytes = Buffer.from(cleanB64, "base64");
        }
        else if (typeof firstItem.url === "string" && firstItem.url.length > 0) {
            const imgResp = await this.fetchImpl(firstItem.url, {
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!imgResp.ok) {
                throw new ProviderError({
                    code: "PROVIDER_5XX",
                    message: `xAI (${modelId}) returned image URL that failed to download (HTTP ${imgResp.status})`,
                    retryable: true,
                    status: imgResp.status,
                    provider: this.name,
                    model_id: modelId,
                });
            }
            const ct = imgResp.headers.get("content-type");
            if (ct && ct.startsWith("image/")) {
                mimeType = ct.split(";")[0].trim();
            }
            assetBytes = Buffer.from(await imgResp.arrayBuffer());
        }
        else {
            throw new ProviderError({
                code: "NO_IMAGE_RETURNED",
                message: `xAI (${modelId}) response missing b64_json and url`,
                retryable: true,
                provider: this.name,
                model_id: modelId,
            });
        }
        const latencyMs = Date.now() - startMs;
        const billedCostUsd = typeof body?.usage?.cost === "number" && Number.isFinite(body.usage.cost)
            ? body.usage.cost
            : null;
        const resolutionActual = await inspectImageResolution(assetBytes);
        return {
            assetBytes,
            assetBytesOrUrl: assetBytes,
            mimeType,
            meta: {
                provider: this.name,
                model_id: modelId,
                latency_ms: latencyMs,
                billed_cost_usd: billedCostUsd,
                request_params: sanitizeXaiRequestParamsForMeta(endpointPath, requestPayload),
                resolution_actual: resolutionActual,
                upscaled: false,
            },
        };
    }
}
