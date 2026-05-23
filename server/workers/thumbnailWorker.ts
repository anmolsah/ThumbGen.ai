import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import redisConnection from "../configs/redis.js";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";
import ai from "../configs/ai.js";
import xai from "../configs/xai.js";
import { PLATFORM_CONFIG } from "../configs/platformConfig.js";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import type { ThumbnailJobData } from "../queues/thumbnailQueue.js";

// ── 2.3: Dedicated Redis publisher for SSE notifications ─────────────────────
// Must be a separate client — the BullMQ redisConnection is owned by the
// Worker and cannot be used for pub/sub simultaneously.
const isTLS = (process.env.REDIS_URL || "").startsWith("rediss://");
const publisher = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null, ...(isTLS && { tls: {} }) }
);
// Suppress unhandled error events — ioredis auto-reconnects, worker must not crash
publisher.on("error", (err) =>
  console.error("SSE publisher Redis error (non-fatal):", err.message)
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WATERMARK_PATH = path.join(__dirname, "../assets/logo.png");

// ── Watermark cache ───────────────────────────────────────────────────────────
// Read and pre-resize the logo once at startup instead of re-processing it on
// every job. Saves ~100–200ms of Sharp disk I/O per generation.
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
    .composite([{
      input: wm.buffer,
      left: imageWidth - wm.width - padding,
      top: imageHeight - wm.height - padding,
    }])
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

// ── 2K generation — Grok (xAI) ───────────────────────────────────────────────
// grok-imagine-image      → Starter plan  (fast, standard quality)
// grok-imagine-image-pro  → Creator / Pro (higher quality, still fast)
// 4K always uses Imagen (Pro only).
const generateWithGrok = async (
  prompt: string,
  aspectRatio: string,
  userPlan: string
) => {
  const model =
    userPlan === "creator" || userPlan === "pro"
      ? "grok-imagine-image-quality"   // higher quality for paid plans
      : "grok-imagine-image-quality";      // standard for starter

  console.log(`Using Grok model: ${model} (plan: ${userPlan})`);

  const response = await xai.images.generate({
    model,
    prompt,
    // @ts-expect-error — xAI-specific parameter not in OpenAI types
    aspect_ratio: aspectRatio || "16:9",
    response_format: "b64_json",
    n: 1,
  });

  if (!response?.data?.[0]?.b64_json) {
    throw new Error("Failed to generate image with Grok");
  }

  return response.data[0].b64_json;
};

// ── 4K generation — Google Imagen 4.0 (standard) ─────────────────────────────
// Switched from imagen-4.0-ultra-generate-001 → imagen-4.0-generate-001.
// Ultra takes 30–60s and produces imperceptibly different results for thumbnails.
// Standard is 3–5× faster (~8–15s) at the same effective output quality.
const generateWithImagen = async (
  prompt: string,
  aspectRatio: string
) => {
  console.log("Using Google Imagen 4.0 (standard)");

  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config: { numberOfImages: 1, aspectRatio: aspectRatio || "16:9" },
  });

  if (!response?.generatedImages?.[0]?.image?.imageBytes) {
    throw new Error("Failed to generate image with Imagen");
  }

  return response.generatedImages[0].image.imageBytes;
};

// ── 2.4: YouTube thumbnail fetch helper (runs inside the worker, not the API) ─
const fetchYouTubeThumbnail = async (url: string): Promise<string | null> => {
  try {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    let videoId: string | null = null;
    for (const p of patterns) {
      const m = url.match(p);
      if (m) { videoId = m[1]; break; }
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

const processThumbnailJob = async (job: Job<ThumbnailJobData>) => {
  const {
    thumbnailId,
    userId,
    title,
    user_prompt,
    style,
    aspect_ratio,
    color_scheme,
    resolution,
    platform,
    userPlan,
    creditsRequired,
  } = job.data;

  // ── 2.4: Resolve reference image ─────────────────────────────────────────
  // Direct upload takes priority; YouTube URL is fetched here (async, off API).
  let reference_image = job.data.reference_image;
  if (!reference_image && job.data.youtube_reference_url) {
    console.log(`Worker: fetching YouTube thumbnail for job ${thumbnailId}`);
    reference_image = (await fetchYouTubeThumbnail(job.data.youtube_reference_url)) ?? undefined;
  }

  console.log(
    `Processing thumbnail job: ${thumbnailId} | resolution: ${resolution} | platform: ${platform}`
  );

  try {
    const canUseReferenceImage = userPlan === "creator" || userPlan === "pro";
    const usingReferenceImage = reference_image && canUseReferenceImage;

    // Build prompt
    let prompt = `Create a ${stylePrompts[style] || stylePrompts["Bold & Graphic"]
      } for: "${title}"`;

    if (color_scheme && colorSchemeDescriptions[color_scheme]) {
      prompt += ` Use a ${colorSchemeDescriptions[color_scheme]} color scheme.`;
    }

    if (user_prompt) {
      prompt += ` Additional details: ${user_prompt}.`;
    }

    if (usingReferenceImage) {
      prompt += ` Incorporate the person/subject from the reference image prominently in the thumbnail, maintaining their likeness and features.`;
    }

    // Add platform-specific prompt enhancement
    const platformSpec = platform ? PLATFORM_CONFIG[platform] : null;
    if (platformSpec) {
      prompt += ` ${platformSpec.promptHint}`;
    }

    prompt += ` The thumbnail should be ${aspect_ratio}, visually stunning, and designed to maximize click-through rate. Make it bold, professional, and impossible to ignore.`;

    let imageBase64: string;

    if (usingReferenceImage) {
      // Reference image — always uses Gemini (unchanged)
      const base64Data = reference_image!.includes("base64,")
        ? reference_image!.split("base64,")[1]
        : reference_image;

      const mimeType = reference_image!.includes("data:")
        ? reference_image!.split(";")[0].split(":")[1]
        : "image/jpeg";

      const geminiResponse: any = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              {
                text: `Using the person/subject from this reference image, ${prompt} Make sure to incorporate the person's likeness and features prominently in the generated thumbnail.`,
              },
            ],
          },
        ],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });

      if (!geminiResponse?.candidates?.[0]?.content?.parts) {
        throw new Error("Failed to generate image with reference");
      }

      const parts = geminiResponse.candidates[0].content.parts;
      let imageData: string | null = null;

      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }

      if (!imageData) throw new Error("Failed to generate image");
      imageBase64 = imageData;
    } else if (resolution === "4k") {
      // Premium 4K — Imagen 4.0 standard (3–5× faster than Ultra)
      imageBase64 = await generateWithImagen(prompt, aspect_ratio);
    } else {
      // Fast 2K — Grok (model chosen by plan)
      imageBase64 = await generateWithGrok(prompt, aspect_ratio, userPlan);
    }

    let finalBuffer: Buffer = Buffer.from(imageBase64, "base64");

    // Add watermark for starter plan
    if (userPlan === "starter") {
      finalBuffer = await addWatermark(finalBuffer);
    }

    // ── Cloudinary upload: buffer stream + WebP (7.1) ────────────────────────
    // Sending a raw buffer stream avoids the base64 string encode/decode
    // roundtrip. WebP output is ~30% smaller than PNG, reducing upload time
    // and CDN delivery cost.
    const webpBuffer = await sharp(finalBuffer).webp({ quality: 90 }).toBuffer();

    const uploadResult = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            format: "webp",
            folder: `thumbgen`,
          },
          (err, result) => {
            if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
            resolve(result as { secure_url: string });
          }
        );
        stream.end(webpBuffer);
      }
    );

    // Update thumbnail in DB
    const completedThumbnail = await Thumbnail.findByIdAndUpdate(
      thumbnailId,
      { image_url: uploadResult.secure_url, isGenerating: false },
      { new: true }
    );

    // Deduct credits
    await User.findByIdAndUpdate(userId, {
      $inc: { credits: -creditsRequired },
    });

    // ── 2.3: Notify SSE subscribers via Redis pub/sub ─────────────────────────
    // Any Express process subscribed to this channel will push the event
    // to the waiting browser, eliminating polling entirely.
    await publisher.publish(
      `thumbnail:complete:${thumbnailId}`,
      JSON.stringify({ thumbnail: completedThumbnail })
    );

    console.log(`Thumbnail ${thumbnailId} completed successfully`);
    return { success: true, thumbnailId };
  } catch (error: any) {
    console.error(`Thumbnail ${thumbnailId} failed:`, error.message);

    // Mark thumbnail as failed
    await Thumbnail.findByIdAndUpdate(thumbnailId, {
      isGenerating: false,
      error: error.message,
    });

    throw error;
  }
};

// Create the worker
const thumbnailWorker = new Worker<ThumbnailJobData>(
  "thumbnail-generation",
  processThumbnailJob,
  {
    connection: redisConnection,
    concurrency: 5,
    // ── Polling / heartbeat tuning — reduces idle Redis ops significantly ──
    // drainDelay: seconds to wait before re-polling when queue is empty.
    // Default is 5 — raising to 10 halves idle BRPOPLPUSH ops.
    drainDelay: 10,
    // stalledInterval: how often (ms) to check for stalled jobs.
    // Default 30 000 — raising to 60 000 halves the stall-check Lua scripts.
    stalledInterval: 60_000,
    // lockRenewTime: how often (ms) to heartbeat the job lock.
    // Default is lockDuration/2 = 15 000 — raising to 20 000 saves ~25% lock heartbeats.
    // AI jobs run 10–30s so 20s renew is well within the 30s lockDuration.
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
