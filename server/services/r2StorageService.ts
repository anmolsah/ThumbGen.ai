/**
 * services/r2StorageService.ts
 *
 * Zero-dependency S3-compatible Cloudflare R2 uploader using Node.js `crypto`
 * AWS Signature V4 (`PUT https://<account_id>.r2.cloudflarestorage.com/<bucket>/<key>.<ext>`)
 * plus a bucket object listing helper (`listR2ShowcaseObjects`) for fetching the 30 showcase
 * thumbnails directly from Cloudflare R2.
 */

import crypto from "crypto";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
}

export function getR2ConfigFromEnv(): R2Config | null {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucketName = (process.env.R2_BUCKET_NAME || "").trim();
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicBaseUrl
  ) {
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

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region = "auto",
  service = "s3"
): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

/**
 * Uploads an image buffer (`webp` or `png`) to Cloudflare R2 using S3 SigV4 `PUT`
 * and returns its public CDN URL (`${R2_PUBLIC_BASE_URL}/${key}.${format}`).
 */
export async function uploadToCloudflareR2(
  buffer: Buffer,
  publicId: string,
  format: "webp" | "png" = "webp",
  configOverride?: R2Config
): Promise<string> {
  const cfg = configOverride ?? getR2ConfigFromEnv();
  if (!cfg) {
    throw new Error(
      "Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL) are not configured"
    );
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

  const canonicalHeaders =
    `content-type:${contentType}\n` +
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

  const signingKey = getSigningKey(
    cfg.secretAccessKey,
    dateStamp,
    region,
    service
  );
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
    throw new Error(
      `Cloudflare R2 upload failed (${res.status}): ${errText.slice(0, 240)}`
    );
  }

  return `${cfg.publicBaseUrl}/${cleanKey}`;
}

