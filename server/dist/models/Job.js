/**
 * models/Job.ts
 *
 * Generation job state machine & telemetry schema (PLAN.md Sections 4, 8, 9).
 * States: queued -> running -> succeeded | failed | canceled
 */
import mongoose, { Schema } from "mongoose";
const JobSchema = new Schema({
    userId: {
        type: String,
        ref: "User",
        required: true,
        index: true,
    },
    thumbnailId: {
        type: String,
        ref: "Thumbnail",
        default: null,
        index: true,
    },
    idempotency_key: {
        type: String,
        required: true,
        trim: true,
    },
    mode: {
        type: String,
        enum: ["fast", "standard", "premium", "ultra"],
        required: true,
    },
    resolution: {
        type: String,
        enum: ["1K", "2K", "4K"],
        required: true,
    },
    aspect_ratio: {
        type: String,
        default: "16:9",
    },
    prompt: {
        type: String,
        required: true,
    },
    reference_images_count: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ["queued", "running", "succeeded", "failed", "canceled"],
        default: "queued",
        required: true,
        index: true,
    },
    reserved_credits: {
        type: Number,
        required: true,
        min: 0,
    },
    final_credits: {
        type: Number,
        default: null,
    },
    error_code: {
        type: String,
        default: null,
    },
    error_message: {
        type: String,
        default: null,
    },
    generation_meta: {
        type: Schema.Types.Mixed,
        default: null,
    },
    assets: {
        original_url: { type: String, default: null },
        watermarked_url: { type: String, default: null },
        preview_webp_url: { type: String, default: null },
        delivery_url: { type: String, default: null },
    },
    startedAt: {
        type: Date,
        default: null,
    },
    completedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    collection: "jobs",
});
// Enforces per-user Idempotency-Key uniqueness
JobSchema.index({ userId: 1, idempotency_key: 1 }, { unique: true });
// Supports orphan sweeps and active-job per-user concurrency queries
JobSchema.index({ userId: 1, status: 1 });
JobSchema.index({ status: 1, updatedAt: 1 });
const Job = mongoose.models.Job || mongoose.model("Job", JobSchema);
export default Job;
