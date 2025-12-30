import { Request, Response } from "express";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";
import ai from "../configs/ai.js";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WATERMARK_PATH = path.join(__dirname, "../assets/logo.png");

// Helper function to add watermark to image buffer
const addWatermark = async (imageBuffer: Buffer): Promise<Buffer> => {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const imageWidth = metadata.width || 1280;
  const imageHeight = metadata.height || 720;

  // Resize watermark to 15% of image width
  const watermarkWidth = Math.round(imageWidth * 0.15);
  const watermark = await sharp(WATERMARK_PATH)
    .resize(watermarkWidth)
    .toBuffer();

  // Get watermark dimensions after resize
  const watermarkMeta = await sharp(watermark).metadata();
  const wmWidth = watermarkMeta.width || watermarkWidth;
  const wmHeight = watermarkMeta.height || watermarkWidth;

  // Position watermark at bottom-right corner with padding
  const padding = 20;
  const left = imageWidth - wmWidth - padding;
  const top = imageHeight - wmHeight - padding;

  // Composite watermark onto image
  return await image
    .composite([
      {
        input: watermark,
        left,
        top,
      },
    ])
    .toBuffer();
};

const CREDITS_PER_THUMBNAIL = 5;

const stylePrompts = {
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

const colorSchemeDescriptions = {
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

export const generateThumbnail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const {
      title,
      prompt: user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
    } = req.body;

    // Check if user has a plan and credits
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.plan === "none") {
      return res
        .status(403)
        .json({ message: "Please select a plan to generate thumbnails" });
    }

    if (user.credits < CREDITS_PER_THUMBNAIL) {
      return res
        .status(403)
        .json({ message: "Insufficient credits. Please upgrade your plan." });
    }

    const thumbnail = await Thumbnail.create({
      userId,
      title,
      prompt_used: user_prompt,
      user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
      isGenerating: true,
    });

    const model = "imagen-4.0-ultra-generate-001";
    //const model = "gemini-3-pro-image-preview";

    let prompt = `Create a ${
      stylePrompts[style as keyof typeof stylePrompts]
    } for: "${title}"`;

    if (color_scheme) {
      prompt += ` Use a ${
        colorSchemeDescriptions[
          color_scheme as keyof typeof colorSchemeDescriptions
        ]
      } color scheme.`;
    }

    if (user_prompt) {
      prompt += ` Additional details: ${user_prompt}.`;
    }

    prompt += ` The thumbnail should be ${aspect_ratio}, visually stunning, and designed to maximize click-through rate. Make it bold, professional, and impossible to ignore.`;

    // Generate the image using Imagen 4.0
    const response = await ai.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspect_ratio || "16:9",
      },
    });

    // Check if the response is valid
    if (!response?.generatedImages?.[0]?.image?.imageBytes) {
      throw new Error("Failed to generate image");
    }

    let finalBuffer: Buffer = Buffer.from(
      response.generatedImages[0].image.imageBytes,
      "base64"
    );

    // Add watermark for free plan users
    if (user.plan === "free") {
      finalBuffer = await addWatermark(finalBuffer);
    }

    const base64Image = `data:image/png;base64,${finalBuffer.toString(
      "base64"
    )}`;

    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      resource_type: "image",
    });

    thumbnail.image_url = uploadResult.secure_url;
    thumbnail.isGenerating = false;
    await thumbnail.save();

    // Deduct credits only after successful generation
    user.credits -= CREDITS_PER_THUMBNAIL;
    await user.save();

    res.json({
      message: "Thumbnail Generated",
      thumbnail,
      credits: user.credits,
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Controllers For Thumbnail Deletion
export const deleteThumbnail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session;

    await Thumbnail.findByIdAndDelete({ _id: id, userId });

    res.json({ message: "Thumbnail deleted successfully" });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
