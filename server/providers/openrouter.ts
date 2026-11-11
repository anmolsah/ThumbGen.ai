/**
 * providers/openrouter.ts
 *
 * OpenRouter dedicated Image API adapter (`POST https://openrouter.ai/api/v1/images`).
 * Implements explicit per-model parameter mapping, cost & latency telemetry,
 * actual pixel resolution verification via Sharp, and structured error classification.
 */

import { mapOpenRouterParams } from "./paramMapper.js";
import {
  classifyProviderError,
  inspectImageResolution,
  ProviderError,
  type GenerateInput,
  type GenerateOutput,
  type ProviderAdapter,
} from "./types.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 90_000;

function sanitizeRequestParamsForMeta(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...payload };
  if (Array.isArray(clone.input_references)) {
    clone.input_references = (clone.input_references as unknown[]).map((ref) => {
      if (typeof ref === "string" && ref.startsWith("data:")) {
        return `${ref.slice(0, 32)}...[redacted_b64_${ref.length}_chars]`;
      }
      return ref;
    });
  }
  return clone;
}

export class OpenRouterAdapter implements ProviderAdapter {
  public readonly name = "openrouter" as const;
  private readonly baseUrl: string;
  private readonly apiKeyOverride?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.baseUrl = (options?.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKeyOverride = options?.apiKey;
    this.fetchImpl = options?.fetchImpl || fetch;
  }

  private getApiKey(modelId: string): string {
    const key = (
      this.apiKeyOverride ??
      process.env.OPENROUTER_API_KEY ??
      ""
    ).trim();
    if (!key) {
      throw new ProviderError({
        code: "AUTH_ERROR",
        message: "OPENROUTER_API_KEY is not configured in environment",
        retryable: false,
        provider: this.name,
        model_id: modelId,
      });
    }
    return key;
  }

  public async generateWithCandidate(
    modelId: string,
    input: GenerateInput
  ): Promise<GenerateOutput> {
    const apiKey = this.getApiKey(modelId);
    const requestPayload = mapOpenRouterParams(modelId, input);
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startMs = Date.now();

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.FRONTEND_URL || "https://thumbgen.ai",
          "X-Title": "ThumbGen.ai",
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err: any) {
      const isTimeout =
        err?.name === "TimeoutError" ||
        err?.name === "AbortError" ||
        String(err?.message || "").toLowerCase().includes("timeout") ||
        String(err?.message || "").toLowerCase().includes("aborted");

      throw new ProviderError({
        code: isTimeout ? "PROVIDER_TIMEOUT" : "NETWORK_ERROR",
        message: `OpenRouter (${modelId}) ${
          isTimeout ? "request timed out" : "network error"
        }: ${err?.message || String(err)}`,
        retryable: true,
        provider: this.name,
        model_id: modelId,
      });
    }

    const rawText = await response.text();
    if (!response.ok) {
      throw classifyProviderError(
        response.status,
        rawText,
        this.name,
        modelId
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch {
      throw new ProviderError({
        code: "PROVIDER_5XX",
        message: `OpenRouter (${modelId}) returned invalid JSON`,
        retryable: true,
        status: response.status,
        provider: this.name,
        model_id: modelId,
      });
    }

    // Check for embedded error objects inside 200 responses
    if (body?.error) {
      const errStatus =
        typeof body.error.code === "number" ? body.error.code : 500;
      throw classifyProviderError(
        errStatus,
        JSON.stringify(body.error),
        this.name,
        modelId
      );
    }

    const firstItem = Array.isArray(body?.data) ? body.data[0] : null;
    if (!firstItem) {
      throw new ProviderError({
        code: "NO_IMAGE_RETURNED",
        message: `OpenRouter (${modelId}) returned no image data in response`,
        retryable: true,
        provider: this.name,
        model_id: modelId,
      });
    }

    let assetBytes: Buffer;
    let mimeType: string = firstItem.media_type || "image/png";

    if (typeof firstItem.b64_json === "string" && firstItem.b64_json.length > 0) {
      const cleanB64 = firstItem.b64_json.replace(
        /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
        ""
      );
      assetBytes = Buffer.from(cleanB64, "base64");
    } else if (typeof firstItem.url === "string" && firstItem.url.length > 0) {
      const imgResp = await this.fetchImpl(firstItem.url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!imgResp.ok) {
        throw new ProviderError({
          code: "PROVIDER_5XX",
          message: `OpenRouter (${modelId}) returned image URL that failed to download (HTTP ${imgResp.status})`,
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
    } else {
      throw new ProviderError({
        code: "NO_IMAGE_RETURNED",
        message: `OpenRouter (${modelId}) response missing b64_json and url`,
        retryable: true,
        provider: this.name,
        model_id: modelId,
      });
    }

    const latencyMs = Date.now() - startMs;
    const billedCostUsd =
      typeof body?.usage?.cost === "number" && Number.isFinite(body.usage.cost)
        ? body.usage.cost
        : typeof body?.usage?.total_cost === "number" &&
          Number.isFinite(body.usage.total_cost)
        ? body.usage.total_cost
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
        request_params: sanitizeRequestParamsForMeta(requestPayload),
        resolution_actual: resolutionActual,
        upscaled: false,
      },
    };
  }
}

