import mongoose from "mongoose";

export interface IThumbnail extends Document {
  userId: string;
  title: string;
  description?: string;
  style:
    | "Bold & Graphic"
    | "Tech/Futuristic"
    | "Minimalist"
    | "Photorealistic"
    | "Illustrated";
  aspect_ratio?: string;
  color_scheme?:
    | "vibrant"
    | "sunset"
    | "forest"
    | "neon"
    | "purple"
    | "monochrome"
    | "ocean"
    | "pastel";
  resolution?: "2k" | "4k";
  platform?: string;
  youtube_reference_url?: string;
  text_overlay?: boolean;
  image_url?: string;
  prompt_used?: string;
  user_prompt?: string;
  isGenerating?: boolean;
  error?: string;
  // createdAt and updatedAt are auto-managed by { timestamps: true }
}

const ThumbnailSchema = new mongoose.Schema<IThumbnail>(
  {
    userId: { type: String, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    style: {
      type: String,
      required: true,
      enum: [
        "Bold & Graphic",
        "Tech/Futuristic",
        "Minimalist",
        "Photorealistic",
        "Illustrated",
      ],
    },
    aspect_ratio: {
      type: String,
      enum: [
        "16:9",
        "1:1",
        "9:16",
        "4:3",
        "3:4",
        "4:5",
        "3:2",
        "2:3",
        "2:1",
        "1:2",
        "1.91:1",
      ],
      default: "16:9",
    },
    color_scheme: {
      type: String,
      enum: [
        "vibrant",
        "sunset",
        "forest",
        "neon",
        "purple",
        "monochrome",
        "ocean",
        "pastel",
      ],
    },
    resolution: {
      type: String,
      enum: ["2k", "4k"],
      default: "2k",
    },
    youtube_reference_url: { type: String },
    platform: {
      type: String,
      enum: [
        "youtube",
        "youtube-shorts",
        "instagram-post",
        "instagram-portrait",
        "instagram-story",
        "tiktok",
        "twitter",
        "linkedin",
        "facebook",
        "pinterest",
        "custom",
      ],
    },
    text_overlay: { type: Boolean, default: false },
    image_url: { type: String, default: "" },
    prompt_used: { type: String },
    user_prompt: { type: String },
    isGenerating: { type: Boolean, default: true },
    error: { type: String },
  },
  {
    // 4.2 — auto-manages createdAt & updatedAt; fixes the "Invalid Date" bug
    timestamps: true,
  }
);

// 4.1 — Indexes: turn full collection scans into ~1ms lookups
//   • userId + createdAt  → user gallery queries (MyGeneration page)
//   • isGenerating + image_url → showcase query (homepage)
ThumbnailSchema.index({ userId: 1, createdAt: -1 });
ThumbnailSchema.index({ isGenerating: 1, image_url: 1 });

const Thumbnail =
  mongoose.models.Thumbnail ||
  mongoose.model<IThumbnail>("Thumbnail", ThumbnailSchema);

export default Thumbnail;
