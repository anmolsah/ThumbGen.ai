/**
 * services/r2StorageService.ts
 *
 * Zero-dependency S3-compatible Cloudflare R2 uploader using Node.js `crypto`
 * AWS Signature V4 (`PUT https://<account_id>.r2.cloudflarestorage.com/<bucket>/<key>.<ext>`)
 * plus a bucket object listing helper (`listR2ShowcaseObjects`) for fetching the 30 showcase
 * thumbnails directly from Cloudflare R2.
 */
import crypto from "crypto";
export function getR2ConfigFromEnv() {
    const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
    const bucketName = (process.env.R2_BUCKET_NAME || "")
        .trim()
        .replace(/^\/+|\/+$/g, "");
    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || "")
        .trim()
        .replace(/\/+$/, "");
    if (!accountId ||
        !accessKeyId ||
        !secretAccessKey ||
        !bucketName ||
        !publicBaseUrl) {
        return null;
    }
    return {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicBaseUrl,
    };
}
function hmacSha256(key, data) {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256Hex(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}
function getSigningKey(secretAccessKey, dateStamp, region = "auto", service = "s3") {
    const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    return hmacSha256(kService, "aws4_request");
}
/**
 * Uploads an image buffer (`webp` or `png`) to Cloudflare R2 using S3 SigV4 `PUT`
 * and returns its public CDN URL (`${R2_PUBLIC_BASE_URL}/${key}.${format}`).
 */
export async function uploadToCloudflareR2(buffer, publicId, format = "webp", configOverride) {
    const cfg = configOverride ?? getR2ConfigFromEnv();
    if (!cfg) {
        throw new Error("Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL) are not configured");
    }
    const cleanKey = `${publicId.replace(/^\/+/, "")}.${format}`;
    const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${cfg.bucketName}/${cleanKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;
    const endpoint = `https://${host}${canonicalUri}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";
    const contentType = format === "png" ? "image/png" : "image/webp";
    const payloadHash = sha256Hex(buffer);
    const canonicalHeaders = `content-type:${contentType}\n` +
        `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
        "PUT",
        canonicalUri,
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = getSigningKey(cfg.secretAccessKey, dateStamp, region, service);
    const signature = crypto
        .createHmac("sha256", signingKey)
        .update(stringToSign, "utf8")
        .digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate,
            Authorization: authorization,
        },
        body: new Uint8Array(buffer),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Cloudflare R2 upload failed (${res.status}): ${errText.slice(0, 240)}`);
    }
    return `${cfg.publicBaseUrl}/${cleanKey}`;
}
/**
 * Lists object keys inside the configured Cloudflare R2 bucket via S3 ListObjectsV2 (`GET /<bucket>?list-type=2`).
 */
export async function listR2BucketObjects(configOverride) {
    const cfg = configOverride ?? getR2ConfigFromEnv();
    if (!cfg) {
        throw new Error("Cloudflare R2 credentials are not configured");
    }
    const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${cfg.bucketName}`;
    const canonicalQueryString = "list-type=2";
    const endpoint = `https://${host}${canonicalUri}?${canonicalQueryString}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";
    const payloadHash = sha256Hex("");
    const canonicalHeaders = `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
        "GET",
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = getSigningKey(cfg.secretAccessKey, dateStamp, region, service);
    const signature = crypto
        .createHmac("sha256", signingKey)
        .update(stringToSign, "utf8")
        .digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const res = await fetch(endpoint, {
        method: "GET",
        headers: {
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate,
            Authorization: authorization,
        },
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Cloudflare R2 ListObjectsV2 failed (${res.status}): ${errText.slice(0, 240)}`);
    }
    const xml = await res.text();
    const keys = [];
    const regex = /<Key>([^<]+)<\/Key>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        const decoded = match[1]
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&gt;/g, ">")
            .replace(/&lt;/g, "<")
            .replace(/&amp;/g, "&");
        keys.push(decoded);
    }
    return keys;
}
