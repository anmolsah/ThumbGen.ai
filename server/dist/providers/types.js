/**
 * providers/types.ts
 *
 * Unified provider interface, metadata contract, and error classification
 * (PLAN.md Sections 4, 9, 11, 12, 13).
 */
import sharp from "sharp";
export class ProviderError extends Error {
    constructor(params) {
        super(params.message);
        this.name = "ProviderError";
        this.code = params.code;
        this.retryable = params.retryable;
        this.isPolicyRejection = params.isPolicyRejection === true;
        this.status = params.status;
        this.provider = params.provider;
        this.model_id = params.model_id;
    }
}
/**
 * Classifies HTTP/provider errors into retryable vs non-retryable categories
 * (PLAN.md Section 9 & Section 13).
 * - Retryable: timeout (408), rate limit (429), server errors (5xx), network errors.
 * - Non-retryable: content policy/safety rejections, 4xx validation, auth/permission errors.
 */
export function classifyProviderError(status, bodyText, provider, modelId) {
    const lower = (bodyText || "").toLowerCase();
    // Check for content policy / safety moderation rejection first
    const isPolicy = lower.includes("content_policy") ||
        lower.includes("content policy") ||
        lower.includes("safety") ||
        lower.includes("moderation") ||
        lower.includes("nsfw") ||
        lower.includes("violates") ||
        lower.includes("prohibited") ||
        lower.includes("blocked by");
    if (isPolicy && (status >= 400 && status < 500)) {
        return new ProviderError({
            code: "CONTENT_POLICY_REJECTED",
            message: `${provider} (${modelId}) content policy rejection (HTTP ${status}): ${bodyText.slice(0, 300)}`,
            retryable: false,
            isPolicyRejection: true,
            status,
            provider,
            model_id: modelId,
        });
    }
    if (status === 429) {
        return new ProviderError({
            code: "RATE_LIMITED",
            message: `${provider} (${modelId}) rate limited (HTTP 429): ${bodyText.slice(0, 300)}`,
            retryable: true,
            isPolicyRejection: false,
            status,
            provider,
            model_id: modelId,
        });
    }
    if (status === 408 || status === 504) {
        return new ProviderError({
            code: "PROVIDER_TIMEOUT",
            message: `${provider} (${modelId}) timed out (HTTP ${status}): ${bodyText.slice(0, 300)}`,
            retryable: true,
            isPolicyRejection: false,
            status,
            provider,
            model_id: modelId,
        });
    }
    if (status >= 500) {
        return new ProviderError({
            code: "PROVIDER_5XX",
            message: `${provider} (${modelId}) server error (HTTP ${status}): ${bodyText.slice(0, 300)}`,
            retryable: true,
            isPolicyRejection: false,
            status,
            provider,
            model_id: modelId,
        });
    }
    if (status === 401 || status === 403) {
        return new ProviderError({
            code: "AUTH_ERROR",
            message: `${provider} (${modelId}) authentication/permission error (HTTP ${status}): ${bodyText.slice(0, 300)}`,
            retryable: false,
            isPolicyRejection: false,
            status,
            provider,
            model_id: modelId,
        });
    }
    if (status === 402) {
        return new ProviderError({
            code: "INSUFFICIENT_QUOTA",
            message: `${provider} (${modelId}) insufficient credits/quota (HTTP 402): ${bodyText.slice(0, 300)}`,
            retryable: false,
            isPolicyRejection: false,
            status,
            provider,
            model_id: modelId,
        });
    }
    return new ProviderError({
        code: "INVALID_PARAMETERS",
        message: `${provider} (${modelId}) request rejected (HTTP ${status}): ${bodyText.slice(0, 300)}`,
        retryable: false,
        isPolicyRejection: false,
        status,
        provider,
        model_id: modelId,
    });
}
/**
 * Inspects an image buffer with Sharp and returns its actual pixel dimensions
 * and verified resolution tier (Section 6 4K rule).
 */
export async function inspectImageResolution(buffer) {
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const longestEdge = Math.max(width, height);
    const totalPixels = width * height;
    // 4K rule: 3840x2160 (or equivalent aspect ratio with longest edge >= 3840 or >= 7.4M pixels)
    let tier = "1K";
    if (longestEdge >= 3840 || totalPixels >= 3840 * 2160 * 0.9) {
        tier = "4K";
    }
    else if (longestEdge >= 1920 || totalPixels >= 1920 * 1080 * 0.85) {
        tier = "2K";
    }
    return {
        width,
        height,
        tier,
        dimensions: `${width}x${height}`,
    };
}
