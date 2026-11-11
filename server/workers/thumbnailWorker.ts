/**
 * workers/thumbnailWorker.ts
 *
 * BullMQ worker for thumbnail generation & editing (PLAN.md Sections 4, 6, 8, 9, 12 Phase 4).
 * Uses `executeGenerationWithFallback` across the verified Provider Adapter Layer
 * (`openrouter`, `xai`, `mock`) with per-provider concurrency semaphores,
 * per-model circuit breakers, and atomic credit commit/refund via `CreditService`.
 */

import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import redisConnection from "../configs/redis.js";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";
import { PLATFORM_CONFIG } from "../configs/platformConfig.js";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import type { ThumbnailJobData } from "../queues/thumbnailQueue.js";
import {
  defaultCreditService,
  resolveRequestedMode,
} from "../services/creditService.js";
import { executeGenerationWithFallback } from "../services/resilience.js";
import {
  processAndStoreAssets,
  sanitizeThumbnailForPlan,
} from "../services/postProcessService.js";
import {
  normalizeResolutionTier,
  ProviderError,
  type GenerateInput,
} from "../providers/index.js";

// ── Dedicated Redis publisher for SSE notifications ──────────────────────────
const isTLS = (process.env.REDIS_URL || "").startsWith("rediss://");
const publisher = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null, ...(isTLS && { tls: {} }) }
);
publisher.on("error", (err) =>
  console.error("SSE publisher Redis error (non-fatal):", err.message)
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WATERMARK_PATH = path.join(__dirname, "../assets/logo.png");

type WatermarkCache = { buffer: Buffer; width: number; height: number };
const watermarkCache = new Map<number, WatermarkCache>();

const getWatermark = async (targetWidth: number): Promise<WatermarkCache> => {
  if (watermarkCache.has(targetWidth)) return watermarkCache.get(targetWidth)!;
  const buffer = await sharp(WATERMARK_PATH).resize(targetWidth).toBuffer();
  const meta = await sharp(buffer).metadata();
  const entry: WatermarkCache = {
    buffer,
    width: meta.width || targetWidth,
    height: meta.height || targetWidth,
  };
  watermarkCache.set(targetWidth, entry);
  return entry;
};

const addWatermark = async (imageBuffer: Buffer): Promise<Buffer> => {
  const image = sharp(imageBuffer);
  const { width: imageWidth = 1280, height: imageHeight = 720 } =
    await image.metadata();
  const targetWidth = Math.round(imageWidth * 0.15);
  const wm = await getWatermark(targetWidth);
  const padding = 20;
  return image
    .composite([
      {
        input: wm.buffer,
        left: imageWidth - wm.width - padding,
        top: imageHeight - wm.height - padding,
      },
    ])
    .toBuffer();
};

const stylePrompts: Record<string, string> = {
  "Bold & Graphic":
    "eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition, professional style",
  "Tech/Futuristic":
    "futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, sharp lighting, high-tech atmosphere",
  Minimalist:
    "minimalist thumbnail, clean layout, simple shapes, limited color palette, plenty of negative space, modern flat design, clear focal point",
  Photorealistic:
    "photorealistic thumbnail, ultra-realistic lighting, natural skin tones, candid moment, DSLR-style photography, lifestyle realism, shallow depth of field",
  Illustrated:
    "illustrated thumbnail, custom digital illustration, stylized characters, bold outlines, vibrant colors, creative cartoon or vector art style",
};

const colorSchemeDescriptions: Record<string, string> = {
  vibrant:
    "vibrant and energetic colors, high saturation, bold contrasts, eye-catching palette",
  sunset:
    "warm sunset tones, orange pink and purple hues, soft gradients, cinematic glow",
  forest:
    "natural green tones, earthy colors, calm and organic palette, fresh atmosphere",
  neon: "neon glow effects, electric blues and pinks, cyberpunk lighting, high contrast glow",
  purple:
    "purple-dominant color palette, magenta and violet tones, modern and stylish mood",
  monochrome:
    "black and white color scheme, high contrast, dramatic lighting, timeless aesthetic",
  ocean:
    "cool blue and teal tones, aquatic color palette, fresh and clean atmosphere",
  pastel:
    "soft pastel colors, low saturation, gentle tones, calm and friendly aesthetic",
};

const fetchYouTubeThumbnail = async (url: string): Promise<string | null> => {
  try {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    let videoId: string | null = null;
    for (const p of patterns) {
      const m = url.match(p);
      if (m) {
        videoId = m[1];
        break;
      }
    }
    if (!videoId) return null;

    const ytThumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const response = await fetch(ytThumbUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.warn("Worker: failed to fetch YouTube thumbnail:", err);
    return null;
  }
};

const uploadBufferToCloudinary = async (
  buffer: Buffer,
  format: "webp" | "png" = "webp"
): Promise<string> => {
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        format,
        folder: "thumbgen",
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

export const processThumbnailJob = async (job: Job<ThumbnailJobData>) => {
  const {
    jobId,
    thumbnailId,
    userId,
    title,
    user_prompt,
    style,
    aspect_ratio = "16:9",
    color_scheme,
    resolution = "2K",
    platform,
    userPlan,
    creditsRequired,
  } = job.data;

  if (jobId) {
    try {
      await defaultCreditService.markJobRunning(jobId);
    } catch (e: any) {
      console.warn(
        `Could not transition job ${jobId} to running:`,
        e?.message
      );
    }
  }

  try {
    const resolutionTier = normalizeResolutionTier(
      resolution || "2K",
      "worker",
      job.data.mode || "standard"
    );

    let prompt: string;
    const referenceImages: string[] = [];

    if (job.data.source_image_url && job.data.edit_instructions) {
      // ── EDIT JOB: fetch source image and pass as reference image to Provider Adapter Layer
      console.log(`Worker: processing EDIT job for thumbnail ${thumbnailId}`);
      const sourceResponse = await fetch(job.data.source_image_url);
      if (!sourceResponse.ok) {
        throw new ProviderError({
          code: "INVALID_PARAMETERS",
          message: "Failed to fetch source thumbnail image for editing",
          retryable: false,
          provider: "worker",
          model_id: "edit",
        });
      }
      const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
      const sourceUrl = job.data.source_image_url;
      const sourceMimeType = sourceUrl.includes(".webp")
        ? "image/webp"
        : sourceUrl.includes(".png")
        ? "image/png"
        : "image/jpeg";

      referenceImages.push(
        `data:${sourceMimeType};base64,${sourceBuffer.toString("base64")}`
      );
      prompt = `Edit this thumbnail image based on the following instructions: "${job.data.edit_instructions}". Keep the overall composition, style, colors, and theme of the original thumbnail intact, but apply the requested changes precisely.`;
    } else {
      // ── STANDARD GENERATION JOB
      const canUseReferenceImage =
        userPlan === "creator" || userPlan === "pro";

      if (canUseReferenceImage) {
        if (
          Array.isArray(job.data.reference_images) &&
          job.data.reference_images.length > 0
        ) {
          referenceImages.push(...job.data.reference_images.filter(Boolean));
        } else if (job.data.reference_image) {
          referenceImages.push(job.data.reference_image);
        } else if (job.data.youtube_reference_url) {
          const ytRef = await fetchYouTubeThumbnail(
            job.data.youtube_reference_url
          );
          if (ytRef) {
            referenceImages.push(ytRef);
          }
        }
      }

      prompt = `Create a ${
        stylePrompts[style] || stylePrompts["Bold & Graphic"]
      } for: "${title}"`;

      if (color_scheme && colorSchemeDescriptions[color_scheme]) {
        prompt += ` Use a ${colorSchemeDescriptions[color_scheme]} color scheme.`;
      }

      if (user_prompt) {
        prompt += ` Additional details: ${user_prompt}.`;
      }

      if (referenceImages.length > 0) {
        prompt += ` Incorporate the person/subject from the reference image prominently in the thumbnail, maintaining their likeness and features.`;
      }

      const platformSpec = platform ? PLATFORM_CONFIG[platform] : null;
      if (platformSpec) {
        prompt += ` ${platformSpec.promptHint}`;
      }

      prompt += ` The thumbnail should be ${aspect_ratio}, visually stunning, and designed to maximize click-through rate. Make it bold, professional, and impossible to ignore.`;
    }

    const modeId = resolveRequestedMode(
      job.data.mode,
      resolutionTier,
      referenceImages.length > 0
    );

    const generateInput: GenerateInput = {
      mode: modeId,
      prompt,
      aspectRatio: aspect_ratio,
      resolution: resolutionTier,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
    };

    const { output, meta } = await executeGenerationWithFallback(generateInput);

    // Phase 5 post-processing: generates `original`, `watermarked`, and `preview_webp` (<=640px)
    // under independent cryptographic keys and verifies actual pixel dimensions.
    const processed = await processAndStoreAssets({
      rawAssetBytes: output.assetBytes,
      requestedResolution: resolutionTier,
      aspectRatio: aspect_ratio,
      userPlan,
    });

    meta.resolution_actual = processed.resolutionActual;
    meta.upscaled = processed.upscaled;

    const assets = processed.assets;

    if (jobId) {
      await defaultCreditService.commitJobCredits({
        jobId,
        generationMeta: meta,
        assets,
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        $inc: { credits: -creditsRequired },
      });
    }

    const completedThumbnail = await Thumbnail.findByIdAndUpdate(
      thumbnailId,
      {
        image_url: assets.delivery_url ?? "",
        original_url: assets.original_url ?? undefined,
        watermarked_url: assets.watermarked_url ?? undefined,
        preview_webp_url: assets.preview_webp_url ?? undefined,
        generation_meta: meta as any,
        isGenerating: false,
        error: undefined,
        error_code: undefined,
      },
      { new: true }
    );

    const sanitizedThumbnail = sanitizeThumbnailForPlan(
      completedThumbnail,
      userPlan
    );

    await publisher.publish(
      `thumbnail:complete:${thumbnailId}`,
      JSON.stringify({ thumbnail: sanitizedThumbnail })
    );

    console.log(
      `Thumbnail ${thumbnailId} completed via ${meta.provider}/${meta.model_id} (fallback=${meta.fallback_used}, res=${meta.resolution_actual?.dimensions})`
    );
    return { success: true, thumbnailId, meta };
  } catch (error: any) {
    const errorCode =
      error instanceof ProviderError
        ? error.code
        : "WORKER_TERMINAL_FAILURE";
    const errorMessage = error?.message || "Thumbnail generation failed";

    console.error(
      `Thumbnail ${thumbnailId} failed (${errorCode}):`,
      errorMessage
    );

    if (jobId) {
      try {
        await defaultCreditService.refundJobCredits({
          jobId,
          reason: `Worker failure (${errorCode}): ${errorMessage}`,
          errorCode,
          errorMessage,
        });
      } catch (refundErr: any) {
        console.error(
          `Failed to refund credits for job ${jobId}:`,
          refundErr?.message
        );
      }
    }

    const failedThumbnail = await Thumbnail.findByIdAndUpdate(
      thumbnailId,
      {
        isGenerating: false,
        error: errorMessage,
        error_code: errorCode,
      },
      { new: true }
    );

    await publisher
      .publish(
        `thumbnail:complete:${thumbnailId}`,
        JSON.stringify({
          thumbnail: failedThumbnail,
          error: errorMessage,
          errorCode,
        })
      )
      .catch(() => {});

    throw error;
  }
};

const thumbnailWorker = new Worker<ThumbnailJobData>(
  "thumbnail-generation",
  processThumbnailJob,
  {
    connection: redisConnection,
    concurrency: 5,
    drainDelay: 10,
    stalledInterval: 60_000,
    lockRenewTime: 20_000,
    lockDuration: 30_000,
  }
);

thumbnailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed for thumbnail ${job.data.thumbnailId}`);
});

thumbnailWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

export default thumbnailWorker;
