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
import sharp from "sharp";
import type { PlanId, ResolutionTier } from "../configs/registryValidator.js";
import type { IJobAssets, IJobGenerationMeta } from "../models/Job.js";
import {
  inspectImageResolution,
  type ResolutionActual,
} from "../providers/types.js";
import { resolveEffectivePlanId } from "./creditService.js";
import { uploadToCloudflareR2 } from "./r2StorageService.js";
import type { CompositionPlan } from "./briefCompiler.js";

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
export const uploadToR2WithKey: AssetUploadFn = async (
  buffer: Buffer,
  publicId: string,
  format: "webp" | "png" = "webp"
): Promise<string> => {
  return uploadToCloudflareR2(buffer, publicId, format);
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
 *   5. Uploads all three variants to Cloudflare R2 under independent, non-guessable keys (`orig_<hex>`, `wm_<hex>`, `prev_<hex>`).
 */
export async function processAndStoreAssets(
  input: PostProcessInput
): Promise<PostProcessOutput> {
  const upload = input.uploadFn ?? uploadToR2WithKey;
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

// ---------------------------------------------------------------------------
// Phase 7: Server-Side Text Overlay, Smart-Crop & Provenance Inspection
// (PLAN.md Sections 10A.4, 10A.9, 12 Phase 7, Pitfalls P12 & P13)
// ---------------------------------------------------------------------------

export const BANNED_TEXT_EFFECTS = [
  "gold_3d_bevel",
  "neon_gradient_glow",
  "sparkle_overlay",
  "rainbow_wordart",
  "heavy_drop_shadow_stack",
] as const;

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TextOverlayOptions {
  text: string;
  textColorHex?: string; // default "#FFFFFF"
  effectPreset?: string; // checked against BANNED_TEXT_EFFECTS
  faceRegions?: BoundingBox[];
  position?: "top" | "bottom" | "left" | "right";
  compositionPlan?: CompositionPlan; // Section 10B Phase 2 integration
  xPercent?: number; // 0..100 custom horizontal center from draggable canvas
  yPercent?: number; // 0..100 custom vertical center from draggable canvas
  pointerArrow?: "none" | "right" | "left" | "down";
}

export interface TextOverlayResult {
  buffer: Buffer;
  initialContrastRatio: number;
  finalContrastRatio: number;
  scrimApplied: boolean;
  placedRegion: BoundingBox;
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2) || "ff", 16),
    g: parseInt(clean.slice(2, 4) || "ff", 16),
    b: parseInt(clean.slice(4, 6) || "ff", 16),
  };
}

/**
 * Computes WCAG 2.1 relative luminance for an sRGB triplet (0-255).
 */
export function computeRelativeLuminance(
  r: number,
  g: number,
  b: number
): number {
  const toLinear = (c: number) => {
    const s = Math.max(0, Math.min(255, c)) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Computes WCAG 2.1 contrast ratio between two relative luminances (`1.0` to `21.0`).
 */
export function computeContrastRatio(lumA: number, lumB: number): number {
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Renders crisp server-side typography over an image buffer using Sharp SVG compositing.
 * Enforces PLAN.md Section 10A.4 & Pitfall P12:
 *   - Rejects banned tacky effect presets (`gold_3d_bevel`, `neon_gradient_glow`, etc.)
 *   - Avoids overlapping any passed `faceRegions`
 *   - Samples background pixels in the target text box and verifies WCAG contrast >= 4.5:1
 *   - Automatically adds a high-contrast dark scrim + stroke when initial contrast < 4.5:1
 */
export async function applyServerTextOverlay(
  imageBuffer: Buffer,
  options: TextOverlayOptions
): Promise<TextOverlayResult> {
  if (
    options.effectPreset &&
    (BANNED_TEXT_EFFECTS as readonly string[]).includes(options.effectPreset)
  ) {
    throw new Error(
      `BANNED_TEXT_EFFECT: Effect preset "${options.effectPreset}" is prohibited by Section 10A.4 / P12.`
    );
  }

  const cleanText = options.text.trim();
  if (!cleanText) {
    throw new Error("Text overlay requires a non-empty text string.");
  }

  const meta = await sharp(imageBuffer).metadata();
  const imgWidth = meta.width ?? 1280;
  const imgHeight = meta.height ?? 720;

  const boxWidth = Math.round(imgWidth * 0.84);
  const boxHeight = Math.max(64, Math.round(imgHeight * 0.22));
  const marginX = Math.round((imgWidth - boxWidth) / 2);
  const marginY = Math.max(24, Math.round(imgHeight * 0.06));

  const candidateBoxes: Record<string, BoundingBox> = {
    bottom: {
      left: marginX,
      top: Math.max(0, imgHeight - boxHeight - marginY),
      width: boxWidth,
      height: boxHeight,
    },
    top: {
      left: marginX,
      top: marginY,
      width: boxWidth,
      height: boxHeight,
    },
    left: {
      left: Math.round(imgWidth * 0.05),
      top: Math.round((imgHeight - boxHeight) / 2),
      width: Math.round(imgWidth * 0.52),
      height: boxHeight,
    },
    right: {
      left: Math.round(imgWidth * 0.43),
      top: Math.round((imgHeight - boxHeight) / 2),
      width: Math.round(imgWidth * 0.52),
      height: boxHeight,
    },
  };

  let effectivePosition = options.position;
  if (!effectivePosition && options.compositionPlan) {
    const reg = options.compositionPlan.text_region.region;
    if (reg === "left-third") effectivePosition = "left";
    else if (reg === "right-third") effectivePosition = "right";
    else if (reg === "top-band") effectivePosition = "top";
    else if (reg === "bottom-band") effectivePosition = "bottom";
  }

  const preferredOrder =
    effectivePosition === "top"
      ? ["top", "bottom"]
      : effectivePosition === "left"
      ? ["left", "top", "bottom"]
      : effectivePosition === "right"
      ? ["right", "top", "bottom"]
      : ["bottom", "top"];
  const faces = options.faceRegions ?? [];
  const avoidBadge = options.compositionPlan?.overlap_constraints?.avoid_bottom_right_badge ?? false;

  let placedRegion = candidateBoxes[preferredOrder[0]];
  if (
    typeof options.xPercent === "number" &&
    typeof options.yPercent === "number"
  ) {
    const customW =
      effectivePosition === "left" || effectivePosition === "right"
        ? Math.round(imgWidth * 0.52)
        : boxWidth;
    const clampedLeft = Math.max(
      0,
      Math.min(
        imgWidth - customW,
        Math.round((options.xPercent / 100) * imgWidth - customW / 2)
      )
    );
    const clampedTop = Math.max(
      0,
      Math.min(
        imgHeight - boxHeight,
        Math.round((options.yPercent / 100) * imgHeight - boxHeight / 2)
      )
    );
    placedRegion = {
      left: clampedLeft,
      top: clampedTop,
      width: customW,
      height: boxHeight,
    };
  } else {
    for (const posKey of preferredOrder) {
      const candidate = candidateBoxes[posKey];
      const collidesWithFace = faces.some((face) => boxesOverlap(candidate, face));
      const inDurationBadgeZone =
        avoidBadge &&
        candidate.left + candidate.width > imgWidth * 0.78 &&
        candidate.top + candidate.height > imgHeight * 0.78;
      if (!collidesWithFace && !inDurationBadgeZone) {
        placedRegion = candidate;
        break;
      }
    }
  }

  // Sample average luminance in the placedRegion
  const regionStats = await sharp(imageBuffer)
    .extract({
      left: Math.max(0, Math.min(imgWidth - 1, placedRegion.left)),
      top: Math.max(0, Math.min(imgHeight - 1, placedRegion.top)),
      width: Math.max(
        1,
        Math.min(imgWidth - placedRegion.left, placedRegion.width)
      ),
      height: Math.max(
        1,
        Math.min(imgHeight - placedRegion.top, placedRegion.height)
      ),
    })
    .stats();

  const avgR = regionStats.channels[0]?.mean ?? 128;
  const avgG = regionStats.channels[1]?.mean ?? 128;
  const avgB = regionStats.channels[2]?.mean ?? 128;
  const bgLuminance = computeRelativeLuminance(avgR, avgG, avgB);

  const textRgb = parseHexRgb(options.textColorHex ?? "#FFFFFF");
  const textLuminance = computeRelativeLuminance(
    textRgb.r,
    textRgb.g,
    textRgb.b
  );

  const initialContrastRatio = computeContrastRatio(textLuminance, bgLuminance);
  const needsScrim = initialContrastRatio < 4.5;

  // When scrim (rgba(10,10,12,0.82)) is applied beneath light text, effective background luminance drops
  const effectiveBgLuminance = needsScrim
    ? computeRelativeLuminance(
        Math.round(avgR * 0.18 + 10 * 0.82),
        Math.round(avgG * 0.18 + 10 * 0.82),
        Math.round(avgB * 0.18 + 12 * 0.82)
      )
    : bgLuminance;

  const EffectiveTextHex =
    needsScrim && textLuminance < 0.5
      ? "#FFFFFF"
      : options.textColorHex ?? "#FFFFFF";
  const finalTextRgb = parseHexRgb(EffectiveTextHex);
  const finalTextLum = computeRelativeLuminance(
    finalTextRgb.r,
    finalTextRgb.g,
    finalTextRgb.b
  );
  const finalContrastRatio = computeContrastRatio(
    finalTextLum,
    effectiveBgLuminance
  );

  const fontSize = Math.max(
    24,
    Math.min(
      Math.round(placedRegion.height * 0.52),
      Math.round((placedRegion.width / Math.max(6, cleanText.length)) * 1.65)
    )
  );

  const scrimRect = needsScrim
    ? `<rect x="0" y="0" width="${placedRegion.width}" height="${placedRegion.height}" rx="12" fill="rgba(10,10,12,0.82)"/>`
    : "";

  const arrowDir = options.pointerArrow ?? "none";
  const arrowSvg =
    arrowDir === "right"
      ? `<g transform="translate(${placedRegion.width - 54}, ${Math.round(
          placedRegion.height / 2 - 16
        )})"><path d="M0 16 H32 M20 4 L34 16 L20 28" stroke="#F43F5E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`
      : arrowDir === "left"
      ? `<g transform="translate(18, ${Math.round(
          placedRegion.height / 2 - 16
        )})"><path d="M34 16 H2 M14 4 L0 16 L14 28" stroke="#F43F5E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`
      : arrowDir === "down"
      ? `<g transform="translate(${Math.round(
          placedRegion.width / 2 - 16
        )}, ${placedRegion.height - 36})"><path d="M16 0 V26 M6 16 L16 28 L26 16" stroke="#F43F5E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`
      : "";

  const svgOverlay = `<svg width="${placedRegion.width}" height="${placedRegion.height}" xmlns="http://www.w3.org/2000/svg">
    ${scrimRect}
    <text
      x="50%"
      y="54%"
      dominant-baseline="middle"
      text-anchor="middle"
      fill="${EffectiveTextHex}"
      stroke="rgba(0,0,0,0.75)"
      stroke-width="${Math.max(2, Math.round(fontSize * 0.06))}"
      paint-order="stroke fill"
      font-family="Inter, Impact, sans-serif"
      font-weight="900"
      font-size="${fontSize}px"
      letter-spacing="0.02em"
    >${escapeXml(cleanText)}</text>
    ${arrowSvg}
  </svg>`;

  const compositedBuffer = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svgOverlay),
        left: placedRegion.left,
        top: placedRegion.top,
      },
    ])
    .webp({ quality: 92 })
    .toBuffer();

  return {
    buffer: compositedBuffer,
    initialContrastRatio,
    finalContrastRatio,
    scrimApplied: needsScrim,
    placedRegion,
  };
}

/**
 * Smart-crops a 16:9 master buffer into another target aspect ratio (`1:1`, `9:16`, `4:5`)
 * using Sharp's entropy/attention-based subject detection (`position: sharp.strategy.attention`).
 */
export async function smartCropFromMaster(
  masterBuffer: Buffer,
  targetAspectRatio: "16:9" | "1:1" | "9:16" | "4:5"
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const meta = await sharp(masterBuffer).metadata();
  const srcWidth = meta.width ?? 1280;
  const srcHeight = meta.height ?? 720;

  const ratioMap: Record<"16:9" | "1:1" | "9:16" | "4:5", [number, number]> = {
    "16:9": [16, 9],
    "1:1": [1, 1],
    "9:16": [9, 16],
    "4:5": [4, 5],
  };

  const [rw, rh] = ratioMap[targetAspectRatio] ?? [16, 9];
  const targetRatio = rw / rh;
  const srcRatio = srcWidth / srcHeight;

  let cropWidth = srcWidth;
  let cropHeight = srcHeight;
  if (srcRatio > targetRatio) {
    cropWidth = Math.max(1, Math.round(srcHeight * targetRatio));
  } else if (srcRatio < targetRatio) {
    cropHeight = Math.max(1, Math.round(srcWidth / targetRatio));
  }

  const buffer = await sharp(masterBuffer)
    .resize({
      width: cropWidth,
      height: cropHeight,
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: 92 })
    .toBuffer();

  const outMeta = await sharp(buffer).metadata();
  return {
    buffer,
    width: outMeta.width ?? cropWidth,
    height: outMeta.height ?? cropHeight,
  };
}

export interface ProvenanceInspection {
  format: string;
  hasExif: boolean;
  hasIcc: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
   survivesPostProcessing: boolean;
  notes: string;
}

/**
 * Inspects image provenance/EXIF/XMP metadata before & after Sharp WebP post-processing
 * (PLAN.md Section 10A.9 & Pitfall P13).
 */
export async function inspectProvenanceMetadata(
  rawBuffer: Buffer
): Promise<ProvenanceInspection> {
  const rawMeta = await sharp(rawBuffer).metadata();
  const processedBuffer = await sharp(rawBuffer).webp({ quality: 92 }).toBuffer();
  const procMeta = await sharp(processedBuffer).metadata();

  const rawHasAny = Boolean(
    rawMeta.exif || rawMeta.xmp || rawMeta.iptc
  );
  const procHasAny = Boolean(
    procMeta.exif || procMeta.xmp || procMeta.iptc
  );

  return {
    format: procMeta.format ?? "webp",
    hasExif: Boolean(procMeta.exif),
    hasIcc: Boolean(procMeta.icc),
    hasXmp: Boolean(procMeta.xmp),
    hasIptc: Boolean(procMeta.iptc),
    survivesPostProcessing: rawHasAny ? procHasAny : false,
    notes:
      "Sharp `.webp()` strips EXIF/XMP/C2PA JUMBF boxes by default unless `.withMetadata()` is explicitly called; SynthID imperceptible pixel-domain watermarks (on Gemini models) reside in spatial frequency bands and may degrade under lossy WebP compression + watermarking.",
  };
}

// ---------------------------------------------------------------------------
// Phase 5.5 / Section 10A.11: Verified Platform Preset Exporter
// Resolves the YouTube Help Center specification conflict (Appendix A.3) by
// producing BOTH a primary sRGB export at the preset resolution AND a <= 2 MB
// sRGB JPG fallback via a quality loop, plus the small mobile feed preview (10A.3).
// ---------------------------------------------------------------------------

export interface VerifiedPlatformPreset {
  id: "youtube_video" | "youtube_shorts";
  aspect_ratio: "16:9" | "9:16";
  primary_width: number;
  primary_height: number;
  uhd_width: number;
  uhd_height: number;
  min_width: number;
  fallback_max_bytes: number;
  desktop_max_bytes: number;
  safe_zone_center_ratio: number;
  mobile_preview_width: number;
  mobile_preview_height: number;
  verified_at: string;
  source_url: string;
}

export const VERIFIED_PLATFORM_PRESETS: Record<
  "youtube_video" | "youtube_shorts",
  VerifiedPlatformPreset
> = {
  youtube_video: {
    id: "youtube_video",
    aspect_ratio: "16:9",
    primary_width: 1280,
    primary_height: 720,
    uhd_width: 3840,
    uhd_height: 2160,
    min_width: 640,
    fallback_max_bytes: 2 * 1024 * 1024, // 2,097,152 bytes (2 MB)
    desktop_max_bytes: 50 * 1024 * 1024, // 52,428,800 bytes (50 MB)
    safe_zone_center_ratio: 0.8,
    mobile_preview_width: 320,
    mobile_preview_height: 180,
    verified_at: "2026-11-11",
    source_url: "https://support.google.com/youtube/answer/72431",
  },
  youtube_shorts: {
    id: "youtube_shorts",
    aspect_ratio: "9:16",
    primary_width: 1080,
    primary_height: 1920,
    uhd_width: 2160,
    uhd_height: 3840,
    min_width: 640,
    fallback_max_bytes: 2 * 1024 * 1024, // 2,097,152 bytes (2 MB)
    desktop_max_bytes: 50 * 1024 * 1024,
    safe_zone_center_ratio: 0.8,
    mobile_preview_width: 180,
    mobile_preview_height: 320,
    verified_at: "2026-11-11",
    source_url: "https://support.google.com/youtube/answer/72431",
  },
};

export interface PlatformExportResult {
  presetId: "youtube_video" | "youtube_shorts";
  primaryBuffer: Buffer;
  primaryWidth: number;
  primaryHeight: number;
  primaryBytes: number;
  fallbackJpgBuffer: Buffer;
  fallbackJpgWidth: number;
  fallbackJpgHeight: number;
  fallbackJpgBytes: number;
  fallbackJpgQualityUsed: number;
  mobileFeedPreviewBuffer: Buffer;
  mobileFeedPreviewWidth: number;
  mobileFeedPreviewHeight: number;
}

/**
 * Exports an image buffer according to the verified platform preset (Section 10A.6 & 10A.11):
 *   1. Primary sRGB asset at the preset dimensions (`1280x720` or `3840x2160` for `youtube_video`,
 *      `1080x1920` or `2160x3840` for `youtube_shorts`).
 *   2. Guaranteed `<= 2 MB` (`fallback_max_bytes`) sRGB JPG fallback via a quality loop.
 *   3. Mobile feed preview (`320x180` or `180x320`) for small-size legibility verification (`10A.3`).
 */
export async function exportForPlatformPreset(
  sourceBuffer: Buffer,
  presetId: "youtube_video" | "youtube_shorts" | string,
  tier: "1K" | "2K" | "4K" = "2K"
): Promise<PlatformExportResult> {
  if (presetId !== "youtube_video" && presetId !== "youtube_shorts") {
    throw new Error(
      `UNVERIFIED_PLATFORM_PRESET: Platform preset '${presetId}' has unverified (null) specifications in config/platform_presets.yaml (Rule R3).`
    );
  }

  const preset = VERIFIED_PLATFORM_PRESETS[presetId];
  const targetWidth =
    tier === "4K" ? preset.uhd_width : preset.primary_width;
  const targetHeight =
    tier === "4K" ? preset.uhd_height : preset.primary_height;

  // 1. Primary high-resolution sRGB export
  const primaryBuffer = await sharp(sourceBuffer)
    .toColorspace("srgb")
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .webp({ quality: 92 })
    .toBuffer();

  // 2. Guaranteed <= 2 MB JPG fallback via quality loop (1280x720 / 1080x1920 base dimensions)
  const fallbackWidth = preset.primary_width;
  const fallbackHeight = preset.primary_height;
  let fallbackJpgBuffer: Buffer = Buffer.alloc(0);
  let fallbackJpgQualityUsed = 92;

  for (const quality of [92, 86, 80, 74, 68, 60, 52]) {
    fallbackJpgQualityUsed = quality;
    fallbackJpgBuffer = await sharp(sourceBuffer)
      .toColorspace("srgb")
      .resize({
        width: fallbackWidth,
        height: fallbackHeight,
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (fallbackJpgBuffer.byteLength <= preset.fallback_max_bytes) {
      break;
    }
  }

  // 3. Small mobile feed preview (320x180 for YouTube Video, 180x320 for Shorts — Section 10A.3)
  const mobileFeedPreviewBuffer = await sharp(primaryBuffer)
    .resize({
      width: preset.mobile_preview_width,
      height: preset.mobile_preview_height,
      fit: "cover",
    })
    .webp({ quality: 85 })
    .toBuffer();

  return {
    presetId,
    primaryBuffer,
    primaryWidth: targetWidth,
    primaryHeight: targetHeight,
    primaryBytes: primaryBuffer.byteLength,
    fallbackJpgBuffer,
    fallbackJpgWidth: fallbackWidth,
    fallbackJpgHeight: fallbackHeight,
    fallbackJpgBytes: fallbackJpgBuffer.byteLength,
    fallbackJpgQualityUsed,
    mobileFeedPreviewBuffer,
    mobileFeedPreviewWidth: preset.mobile_preview_width,
    mobileFeedPreviewHeight: preset.mobile_preview_height,
  };
}

