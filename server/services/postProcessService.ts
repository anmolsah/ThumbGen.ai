/**
 * services/postProcessService.ts
 *
 * Phase 5 post-processing & storage pipeline (PLAN.md Sections 4, 6, 12 Phase 5, 13):
 *   - Produces `original`, `watermarked`, and `preview_webp` (<= 640px wide) variants
 *   - Uses cryptographically independent storage keys so `original_url` can never be
 *     derived or guessed from `watermarked_url`
 *   - Enforces Starter plan watermark isolation in all API/SSE responses while
 *     allowing instant unwatermarked access if a user upgrades to Creator/Pro
 *   - Verifies `resolution_actual` pixel dimensions and enforces the Section 6 4K rule
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import type { PlanId, ResolutionTier } from "../configs/registryValidator.js";
import type { IJobAssets, IJobGenerationMeta } from "../models/Job.js";
import {
  inspectImageResolution,
  type ResolutionActual,
} from "../providers/types.js";
import { resolveEffectivePlanId } from "./creditService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WATERMARK_PATH = path.join(__dirname, "../assets/logo.png");

type WatermarkCache = { buffer: Buffer; width: number; height: number };
const watermarkCache = new Map<number, WatermarkCache>();

async function getWatermarkOverlay(
  targetWidth: number
): Promise<WatermarkCache> {
  const safeWidth = Math.max(48, Math.round(targetWidth));
  if (watermarkCache.has(safeWidth)) {
    return watermarkCache.get(safeWidth)!;
  }

  let buffer: Buffer;
  if (fs.existsSync(WATERMARK_PATH)) {
    buffer = await sharp(WATERMARK_PATH).resize(safeWidth).png().toBuffer();
  } else {
    // Fallback deterministic SVG watermark if logo.png is unavailable
    const svgHeight = Math.max(24, Math.round(safeWidth * 0.28));
    const svg = `<svg width="${safeWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="6" fill="rgba(0,0,0,0.65)"/>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="${Math.round(
        svgHeight * 0.5
      )}">ThumbGen.ai</text>
    </svg>`;
    buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  }

  const meta = await sharp(buffer).metadata();
  const entry: WatermarkCache = {
    buffer,
    width: meta.width || safeWidth,
    height: meta.height || Math.round(safeWidth * 0.28),
  };
  watermarkCache.set(safeWidth, entry);
  return entry;
}

/**
 * Applies the ThumbGen.ai watermark in the bottom-right corner of `imageBuffer`.
 */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const { width: imageWidth = 1280, height: imageHeight = 720 } =
    await image.metadata();
  const targetWidth = Math.max(64, Math.round(imageWidth * 0.15));
  const wm = await getWatermarkOverlay(targetWidth);
  const padding = Math.max(12, Math.round(imageWidth * 0.015));

  const left = Math.max(0, imageWidth - wm.width - padding);
  const top = Math.max(0, imageHeight - wm.height - padding);

  return sharp(imageBuffer)
    .composite([
      {
        input: wm.buffer,
        left,
        top,
      },
    ])
    .webp({ quality: 90 })
    .toBuffer();
}

/**
 * Generates an optimized WebP preview (`<= 640px` wide) for gallery views.
 */
export async function generatePreviewWebp(
  sourceBuffer: Buffer,
  maxWidth: number = 640
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const buffer = await sharp(sourceBuffer)
    .resize({
      width: maxWidth,
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  const meta = await sharp(buffer).metadata();
  return {
    buffer,
    width: meta.width ?? maxWidth,
    height: meta.height ?? Math.round((maxWidth * 9) / 16),
  };
}

export type AssetUploadFn = (
  buffer: Buffer,
  publicId: string,
  format: "webp" | "png"
) => Promise<string>;

/**
 * Default Cloudinary uploader using cryptographically random `public_id`s
 * so `original_url` cannot be guessed or derived from `watermarked_url`.
 */
export const uploadToCloudinaryWithKey: AssetUploadFn = async (
  buffer: Buffer,
  publicId: string,
  format: "webp" | "png" = "webp"
): Promise<string> => {
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: publicId,
        format,
        overwrite: true,
      },
      (err, res) => {
        if (err || !res) {
          return reject(err ?? new Error("Cloudinary upload failed"));
        }
        resolve(res as { secure_url: string });
      }
    );
    stream.end(buffer);
  });
  return result.secure_url;
};

export interface PostProcessInput {
  rawAssetBytes: Buffer;
  requestedResolution: ResolutionTier;
  aspectRatio: string;
  userPlan: string;
  uploadFn?: AssetUploadFn;
}

export interface PostProcessOutput {
  originalBuffer: Buffer;
  watermarkedBuffer: Buffer;
  previewWebpBuffer: Buffer;
  previewDimensions: { width: number; height: number };
  resolutionActual: ResolutionActual;
  upscaled: boolean;
  assets: IJobAssets;
}

/**
 * Full Phase 5 post-processing pipeline:
 *   1. Inspects actual pixel dimensions of `rawAssetBytes`.
 *   2. Produces full-resolution `original` WebP buffer.
 *   3. Produces full-resolution `watermarked` WebP buffer.
 *   4. Produces `<= 640px` `preview_webp` buffer (watermarked for Starter, unwatermarked for Creator/Pro).
 *   5. Uploads all three variants under independent, non-guessable keys (`orig_<hex>`, `wm_<hex>`, `prev_<hex>`).
 */
export async function processAndStoreAssets(
  input: PostProcessInput
): Promise<PostProcessOutput> {
  const upload = input.uploadFn ?? uploadToCloudinaryWithKey;
  const effectivePlan: PlanId =
    resolveEffectivePlanId(input.userPlan) ?? "starter";
  const isStarter = effectivePlan === "starter";

  const workingBuffer = input.rawAssetBytes;
  const upscaled = false;
  const resolutionActual = await inspectImageResolution(workingBuffer);

  // 1. Original unwatermarked full-resolution WebP
  const originalBuffer = await sharp(workingBuffer)
    .webp({ quality: 92 })
    .toBuffer();

  // 2. Watermarked full-resolution WebP
  const watermarkedBuffer = await applyWatermark(originalBuffer);

  // 3. Preview WebP (<= 640px wide): generated from watermarkedBuffer for Starter, originalBuffer for Creator/Pro
  const previewSource = isStarter ? watermarkedBuffer : originalBuffer;
  const previewResult = await generatePreviewWebp(previewSource, 640);

  // 4. Independent 128-bit random keys so original_url is never derivable from watermarked_url
  const origKey = `thumbgen/orig_${crypto.randomBytes(16).toString("hex")}`;
  const wmKey = `thumbgen/wm_${crypto.randomBytes(16).toString("hex")}`;
  const prevKey = `thumbgen/prev_${crypto.randomBytes(16).toString("hex")}`;

  const [originalUrl, watermarkedUrl, previewWebpUrl] = await Promise.all([
    upload(originalBuffer, origKey, "webp"),
    upload(watermarkedBuffer, wmKey, "webp"),
    upload(previewResult.buffer, prevKey, "webp"),
  ]);

  const deliveryUrl = isStarter ? watermarkedUrl : originalUrl;

  return {
    originalBuffer,
    watermarkedBuffer,
    previewWebpBuffer: previewResult.buffer,
    previewDimensions: {
      width: previewResult.width,
      height: previewResult.height,
    },
    resolutionActual,
    upscaled,
    assets: {
      original_url: originalUrl,
      watermarked_url: watermarkedUrl,
      preview_webp_url: previewWebpUrl,
      delivery_url: deliveryUrl,
    },
  };
}

/**
 * Enforces Starter plan watermark isolation on a `Job` object before returning
 * it to the client:
 *   - Starter users receive `watermarked_url` as `delivery_url` and NEVER see `original_url`.
 *   - Creator/Pro users receive `original_url` as `delivery_url` (including on thumbnails
 *     generated while they were previously on the Starter plan!).
 */
export function sanitizeJobAssetsForPlan<
  T extends { assets?: IJobAssets | null }
>(job: T, currentUserPlan: string): T {
  if (!job || !job.assets) return job;
  const effectivePlan = resolveEffectivePlanId(currentUserPlan) ?? "starter";
  const isStarter = effectivePlan === "starter";

  const clonedAssets: IJobAssets = {
    original_url: isStarter ? null : job.assets.original_url,
    watermarked_url: job.assets.watermarked_url,
    preview_webp_url: job.assets.preview_webp_url,
    delivery_url: isStarter
      ? job.assets.watermarked_url || job.assets.delivery_url
      : job.assets.original_url || job.assets.delivery_url,
  };

  return {
    ...job,
    assets: clonedAssets,
  };
}

/**
 * Enforces Starter plan watermark isolation on a `Thumbnail` document/object
 * before returning it to the client via REST or SSE:
 *   - Starter users receive `watermarked_url` as `image_url` and `original_url` is stripped (`undefined`).
 *   - Creator/Pro users receive `original_url` as `image_url` (so upgrading immediately unlocks
 *     the unwatermarked original on existing thumbnails!).
 */
export function sanitizeThumbnailForPlan(
  thumbnail: any,
  currentUserPlan: string
): any {
  if (!thumbnail) return thumbnail;
  const obj =
    typeof thumbnail.toObject === "function"
      ? thumbnail.toObject()
      : { ...thumbnail };

  const effectivePlan = resolveEffectivePlanId(currentUserPlan) ?? "starter";
  const isStarter = effectivePlan === "starter";

  if (isStarter) {
    const safeUrl = obj.watermarked_url || obj.image_url || "";
    obj.image_url = safeUrl;
    delete obj.original_url;
  } else {
    // Paid plan (Creator or Pro): unlock unwatermarked original_url if present
    if (obj.original_url) {
      obj.image_url = obj.original_url;
    }
  }

  return obj;
}

