import { Worker, Job } from "bullmq";
import redisConnection from "../configs/redis.js";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";
import ai from "../configs/ai.js";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import type { ThumbnailJobData } from "../queues/thumbnailQueue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WATERMARK_PATH = path.join(__dirname, "../assets/logo.png");

// Helper function to add watermark
const addWatermark = async (imageBuffer: Buffer): Promise<Buffer> => {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const imageWidth = metadata.width || 1280;
  const imageHeight = metadata.height || 720;

  const watermarkWidth = Math.round(imageWidth * 0.15);
  const watermark = await sharp(WATERMARK_PATH)
    .resize(watermarkWidth)
    .toBuffer();

  const watermarkMeta = await sharp(watermark).metadata();
  const wmWidth = watermarkMeta.width || watermarkWidth;
  const wmHeight = watermarkMeta.height || watermarkWidth;

  const padding = 20;
  const left = imageWidth - wmWidth - padding;
  const top = imageHeight - wmHeight - padding;

  return await image.composite([{ input: watermark, left, top }]).toBuffer();
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

const processThumbnailJob = async (job: Job<ThumbnailJobData>) => {
  const {
    thumbnailId,
    userId,
    title,
    user_prompt,
    style,
    aspect_ratio,
    color_scheme,
    reference_image,
    userPlan,
    creditsRequired,
  } = job.data;

  console.log(`Processing thumbnail job: ${thumbnailId}`);

  try {
    const canUseReferenceImage = userPlan === "creator" || userPlan === "pro";
    const usingReferenceImage = reference_image && canUseReferenceImage;

    let prompt = `Create a ${
      stylePrompts[style] || stylePrompts["Bold & Graphic"]
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

    prompt += ` The thumbnail should be ${aspect_ratio}, visually stunning, and designed to maximize click-through rate. Make it bold, professional, and impossible to ignore.`;

    let response;

    if (usingReferenceImage) {
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

      response = { generatedImages: [{ image: { imageBytes: imageData } }] };
    } else {
      response = await ai.models.generateImages({
        model: "imagen-4.0-ultra-generate-001",
        prompt,
        config: { numberOfImages: 1, aspectRatio: aspect_ratio || "16:9" },
      });
    }

    if (!response?.generatedImages?.[0]?.image?.imageBytes) {
      throw new Error("Failed to generate image");
    }

    let finalBuffer: Buffer = Buffer.from(
      response.generatedImages[0].image.imageBytes,
      "base64"
    );

    // Add watermark for free plan
    if (userPlan === "free") {
      finalBuffer = await addWatermark(finalBuffer);
    }

    const base64Image = `data:image/png;base64,${finalBuffer.toString(
      "base64"
    )}`;

    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      resource_type: "image",
    });

    // Update thumbnail in DB
    await Thumbnail.findByIdAndUpdate(thumbnailId, {
      image_url: uploadResult.secure_url,
      isGenerating: false,
    });

    // Deduct credits
    await User.findByIdAndUpdate(userId, {
      $inc: { credits: -creditsRequired },
    });

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
    concurrency: 5, // Process up to 5 jobs simultaneously
  }
);

thumbnailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed for thumbnail ${job.data.thumbnailId}`);
});

thumbnailWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

export default thumbnailWorker;
