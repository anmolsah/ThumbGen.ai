import mongoose from "mongoose";
const ThumbnailSchema = new mongoose.Schema({
    userId: { type: String, ref: "User", required: true },
    jobId: { type: String, ref: "Job", index: true },
    mode: {
        type: String,
        enum: ["fast", "standard", "premium", "ultra"],
        default: "standard",
    },
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
        enum: ["1k", "2k", "4k", "1K", "2K", "4K"],
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
    original_url: { type: String },
    watermarked_url: { type: String },
    preview_webp_url: { type: String },
    prompt_used: { type: String },
    user_prompt: { type: String },
    isGenerating: { type: Boolean, default: true },
    error: { type: String },
    error_code: { type: String },
    generation_meta: { type: mongoose.Schema.Types.Mixed },
    editedFrom: { type: String, ref: "Thumbnail" },
    edit_instructions: { type: String },
}, {
    // 4.2 — auto-manages createdAt & updatedAt; fixes the "Invalid Date" bug
    timestamps: true,
});
// 4.1 — Indexes: turn full collection scans into ~1ms lookups
//   • userId + createdAt  → user gallery queries (MyGeneration page)
//   • isGenerating + image_url → showcase query (homepage)
ThumbnailSchema.index({ userId: 1, createdAt: -1 });
ThumbnailSchema.index({ isGenerating: 1, image_url: 1 });
const Thumbnail = mongoose.models.Thumbnail ||
    mongoose.model("Thumbnail", ThumbnailSchema);
export default Thumbnail;
