import crypto from "crypto";
import Thumbnail from "../models/Thumbnail.js";
import thumbnailQueue from "../queues/thumbnailQueue.js";
import { CreditServiceError, defaultCreditService, } from "../services/creditService.js";
import { applyServerTextOverlay, exportForPlatformPreset, sanitizeJobAssetsForPlan, sanitizeThumbnailForPlan, smartCropFromMaster, } from "../services/postProcessService.js";
import { defaultGenerationRateLimiter, defaultObservability, } from "../services/observabilityService.js";
import { ProviderError } from "../providers/types.js";
import { fetchLiveShowcaseThumbnails } from "../services/showcaseService.js";
function extractIdempotencyKey(req, strictRequired) {
    const headerVal = req.headers["idempotency-key"] ||
        req.headers["x-idempotency-key"];
    const bodyVal = req.body?.idempotencyKey || req.body?.idempotency_key;
    const key = (headerVal || bodyVal || "").trim();
    if (!key && !strictRequired) {
        return `auto_${crypto.randomUUID()}`;
    }
    return key;
}
export const generateThumbnail = async (req, res) => {
    let reservedJobId = null;
    try {
        const { userId } = req.session;
        if (!userId) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Authentication required" });
        }
        // Phase 8 Abuse Protection & Daily Spend Kill Switch
        const rateCheck = defaultGenerationRateLimiter.check(userId);
        if (!rateCheck.allowed) {
            res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
            return res.status(429).json({
                code: "RATE_LIMITED",
                error_code: "RATE_LIMITED",
                message: `Too many generation requests. Please retry in ${rateCheck.retryAfterSeconds}s.`,
            });
        }
        defaultObservability.assertSpendBelowCap();
        const { title, prompt: rawPrompt, user_prompt, style = "Bold & Graphic", aspect_ratio = "16:9", color_scheme, text_overlay = true, reference_image, referenceImages, resolution = "2K", mode, platform, youtube_reference_url, overlay_title, overlay_position, overlay_accent, overlay_arrow, overlay_x_percent, overlay_y_percent, } = req.body;
        const effectivePrompt = (rawPrompt ?? user_prompt ?? title ?? "").trim();
        if (!effectivePrompt) {
            return res.status(400).json({
                code: "INVALID_PARAMETERS",
                message: "A title or prompt is required to generate a thumbnail",
            });
        }
        // POST /api/generate strictly requires Idempotency-Key (PLAN.md Section 8 Rule 3)
        const isStrictGenerateRoute = req.baseUrl === "/api" ||
            req.originalUrl.startsWith("/api/generate") ||
            req.headers["x-require-idempotency-key"] === "true";
        const idempotencyKey = extractIdempotencyKey(req, isStrictGenerateRoute);
        // Count reference images passed via reference_image, referenceImages[], or youtube_reference_url
        const refArray = Array.isArray(referenceImages)
            ? referenceImages.filter(Boolean)
            : reference_image
                ? [reference_image]
                : [];
        const totalRefCount = refArray.length + (youtube_reference_url?.trim() ? 1 : 0);
        const currentQueueDepth = await thumbnailQueue
            .getWaitingCount()
            .catch(() => 0);
        // 1. Atomically check entitlements, check idempotency, decrement credits, and create Job + reserve ledger entry
        const reservation = await defaultCreditService.reserveCreditsAndCreateJob({
            userId,
            idempotencyKey,
            mode,
            resolution,
            aspectRatio: aspect_ratio,
            prompt: effectivePrompt,
            referenceImagesCount: totalRefCount,
            currentQueueDepth,
        });
        // If this is an idempotent replay of an existing request, return the existing job & thumbnail immediately
        if (reservation.idempotentReplay) {
            const existingThumb = reservation.job.thumbnailId
                ? await Thumbnail.findById(reservation.job.thumbnailId)
                : null;
            return res.status(200).json({
                message: "Thumbnail generation already in progress (idempotent replay)",
                idempotentReplay: true,
                job: reservation.job,
                thumbnail: existingThumb,
                credits: reservation.userCreditsAfter,
            });
        }
        reservedJobId = reservation.job.id;
        // 2. Create the linked Thumbnail record
        const thumbnail = await Thumbnail.create({
            userId,
            jobId: reservation.job.id,
            mode: reservation.job.mode,
            title: (title || effectivePrompt).slice(0, 200),
            prompt_used: effectivePrompt,
            user_prompt: effectivePrompt,
            style,
            aspect_ratio: reservation.job.aspect_ratio,
            color_scheme,
            text_overlay,
            resolution: reservation.job.resolution.toLowerCase(),
            platform: platform || undefined,
            youtube_reference_url: youtube_reference_url || undefined,
            isGenerating: true,
        });
        await defaultCreditService
            .getStore()
            .updateJobThumbnailId(reservation.job.id, thumbnail._id.toString());
        // 3. Enqueue job into BullMQ
        await thumbnailQueue.add(`generate-${thumbnail._id}`, {
            jobId: reservation.job.id,
            thumbnailId: thumbnail._id.toString(),
            userId,
            mode: reservation.job.mode,
            title: (title || effectivePrompt).slice(0, 200),
            user_prompt: effectivePrompt,
            style,
            aspect_ratio: reservation.job.aspect_ratio,
            color_scheme,
            text_overlay,
            reference_image: refArray[0] || undefined,
            reference_images: refArray,
            resolution: reservation.job.resolution,
            platform: platform || "",
            youtube_reference_url: youtube_reference_url || "",
            userPlan: reservation.effectivePlan,
            creditsRequired: reservation.job.reserved_credits,
            overlay_title: overlay_title ? String(overlay_title).trim() : undefined,
            overlay_position: overlay_position || undefined,
            overlay_accent: overlay_accent || undefined,
            overlay_arrow: overlay_arrow || undefined,
            overlay_x_percent: typeof overlay_x_percent === "number" ? overlay_x_percent : undefined,
            overlay_y_percent: typeof overlay_y_percent === "number" ? overlay_y_percent : undefined,
        }, {
            priority: reservation.effectivePlan === "pro"
                ? 1
                : reservation.effectivePlan === "creator"
                    ? 2
                    : 3,
        });
        const updatedJob = {
            ...reservation.job,
            thumbnailId: thumbnail._id.toString(),
        };
        return res.status(202).json({
            message: "Thumbnail generation started",
            idempotentReplay: false,
            job: updatedJob,
            thumbnail,
            credits: reservation.userCreditsAfter,
        });
    }
    catch (error) {
        // If reservation succeeded before Thumbnail.create or thumbnailQueue.add failed, refund immediately
        if (reservedJobId) {
            try {
                await defaultCreditService.refundJobCredits({
                    jobId: reservedJobId,
                    reason: `Automatic refund: failed to enqueue job (${error?.message || "unknown error"})`,
                    errorCode: "QUEUE_ENQUEUE_FAILED",
                    errorMessage: error?.message || "Failed to enqueue generation job",
                });
            }
            catch (refundErr) {
                console.error("Failed to refund after enqueue error:", refundErr);
            }
        }
        if (error instanceof CreditServiceError) {
            if (error.retryAfterSeconds) {
                res.setHeader("Retry-After", String(error.retryAfterSeconds));
            }
            return res.status(error.status).json({
                code: error.code,
                message: error.message,
                retryAfterSeconds: error.retryAfterSeconds,
            });
        }
        if (error instanceof ProviderError) {
            return res.status(400).json({
                code: error.code,
                message: error.message,
            });
        }
        console.error("generateThumbnail error:", error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: error?.message || "Failed to start thumbnail generation",
        });
    }
};
export const editThumbnail = async (req, res) => {
    let reservedJobId = null;
    try {
        const { userId } = req.session;
        if (!userId) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Authentication required" });
        }
        // Phase 8 Abuse Protection & Daily Spend Kill Switch
        const rateCheck = defaultGenerationRateLimiter.check(userId);
        if (!rateCheck.allowed) {
            res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
            return res.status(429).json({
                code: "RATE_LIMITED",
                error_code: "RATE_LIMITED",
                message: `Too many generation requests. Please retry in ${rateCheck.retryAfterSeconds}s.`,
            });
        }
        defaultObservability.assertSpendBelowCap();
        const { thumbnailId, edit_instructions, mode } = req.body;
        if (!thumbnailId || !edit_instructions?.trim()) {
            return res.status(400).json({
                code: "INVALID_PARAMETERS",
                message: "Thumbnail ID and edit instructions are required",
            });
        }
        // Look up the source thumbnail first
        const sourceThumbnail = await Thumbnail.findOne({
            _id: thumbnailId,
            userId,
        });
        if (!sourceThumbnail) {
            return res.status(404).json({
                code: "THUMBNAIL_NOT_FOUND",
                message: "Source thumbnail not found",
            });
        }
        if (!sourceThumbnail.image_url) {
            return res.status(400).json({
                code: "INVALID_PARAMETERS",
                message: "Source thumbnail has no generated image to edit",
            });
        }
        const isStrict = req.headers["x-require-idempotency-key"] === "true";
        const idempotencyKey = extractIdempotencyKey(req, isStrict);
        const currentQueueDepth = await thumbnailQueue
            .getWaitingCount()
            .catch(() => 0);
        // Reserve credits atomically before updating thumbnail or enqueueing edit job
        const reservation = await defaultCreditService.reserveCreditsAndCreateJob({
            userId,
            idempotencyKey,
            mode: mode || sourceThumbnail.mode || "standard",
            resolution: sourceThumbnail.resolution || "2K",
            aspectRatio: sourceThumbnail.aspect_ratio || "16:9",
            prompt: edit_instructions.trim(),
            referenceImagesCount: 0,
            thumbnailId: String(sourceThumbnail._id),
            currentQueueDepth,
        });
        if (reservation.idempotentReplay) {
            return res.status(200).json({
                message: "Thumbnail edit already in progress (idempotent replay)",
                idempotentReplay: true,
                job: reservation.job,
                thumbnail: sourceThumbnail,
                credits: reservation.userCreditsAfter,
            });
        }
        reservedJobId = reservation.job.id;
        const sourceImageUrl = sourceThumbnail.image_url;
        const updatedThumbnail = await Thumbnail.findByIdAndUpdate(thumbnailId, {
            jobId: reservation.job.id,
            edit_instructions: edit_instructions.trim(),
            isGenerating: true,
            error: undefined,
        }, { new: true });
        await thumbnailQueue.add(`edit-${thumbnailId}-${reservation.job.id}`, {
            jobId: reservation.job.id,
            thumbnailId: String(thumbnailId),
            userId,
            mode: reservation.job.mode,
            title: sourceThumbnail.title,
            user_prompt: sourceThumbnail.user_prompt || "",
            style: sourceThumbnail.style,
            aspect_ratio: sourceThumbnail.aspect_ratio || "16:9",
            color_scheme: sourceThumbnail.color_scheme || "",
            text_overlay: sourceThumbnail.text_overlay || false,
            resolution: reservation.job.resolution,
            platform: sourceThumbnail.platform || "",
            userPlan: reservation.effectivePlan,
            creditsRequired: reservation.job.reserved_credits,
            edit_instructions: edit_instructions.trim(),
            source_image_url: sourceImageUrl,
        }, {
            priority: reservation.effectivePlan === "pro"
                ? 1
                : reservation.effectivePlan === "creator"
                    ? 2
                    : 3,
        });
        return res.status(202).json({
            message: "Thumbnail edit started",
            idempotentReplay: false,
            job: reservation.job,
            thumbnail: updatedThumbnail,
            credits: reservation.userCreditsAfter,
        });
    }
    catch (error) {
        if (reservedJobId) {
            try {
                await defaultCreditService.refundJobCredits({
                    jobId: reservedJobId,
                    reason: `Automatic refund: failed to enqueue edit job (${error?.message || "unknown error"})`,
                    errorCode: "QUEUE_ENQUEUE_FAILED",
                    errorMessage: error?.message || "Failed to enqueue edit job",
                });
            }
            catch (refundErr) {
                console.error("Failed to refund edit job after enqueue error:", refundErr);
            }
        }
        if (error instanceof CreditServiceError) {
            if (error.retryAfterSeconds) {
                res.setHeader("Retry-After", String(error.retryAfterSeconds));
            }
            return res.status(error.status).json({
                code: error.code,
                message: error.message,
                retryAfterSeconds: error.retryAfterSeconds,
            });
        }
        if (error instanceof ProviderError) {
            return res.status(400).json({
                code: error.code,
                message: error.message,
            });
        }
        console.error("editThumbnail error:", error);
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: error?.message || "Failed to start thumbnail edit",
        });
    }
};
// Get job status by jobId (GET /api/jobs/:id)
export const getJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.session;
        const job = await defaultCreditService.getStore().findJobById(id);
        if (!job || job.userId !== userId) {
            return res
                .status(404)
                .json({ code: "JOB_NOT_FOUND", message: "Job not found" });
        }
        const [user, thumbnail, ledgerEntries] = await Promise.all([
            defaultCreditService.getStore().getUserById(userId),
            job.thumbnailId
                ? Thumbnail.findOne({ _id: job.thumbnailId, userId })
                : Promise.resolve(null),
            defaultCreditService.getStore().findLedgerEntriesForJob(job.id),
        ]);
        const userPlan = user?.plan || "starter";
        return res.json({
            job: sanitizeJobAssetsForPlan(job, userPlan),
            thumbnail: sanitizeThumbnailForPlan(thumbnail, userPlan),
            ledger: ledgerEntries,
            isComplete: job.status === "succeeded",
            isFailed: job.status === "failed" || job.status === "canceled",
        });
    }
    catch (error) {
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: error?.message || "Failed to fetch job status",
        });
    }
};
// Get user credit ledger history (GET /api/user/ledger)
export const getUserCreditLedger = async (req, res) => {
    try {
        const { userId } = req.session;
        if (!userId) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Authentication required" });
        }
        const user = await defaultCreditService.getStore().getUserById(userId);
        if (!user) {
            return res
                .status(404)
                .json({ code: "USER_NOT_FOUND", message: "User not found" });
        }
        const entries = await defaultCreditService
            .getStore()
            .findLedgerEntriesForUser(userId, 100);
        return res.json({
            credits: user.credits,
            totalCredits: user.totalCredits,
            plan: user.plan,
            ledger: entries,
        });
    }
    catch (error) {
        return res.status(500).json({
            code: "INTERNAL_ERROR",
            message: error?.message || "Failed to fetch credit ledger",
        });
    }
};
// Get thumbnail status (for polling)
export const getThumbnailStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.session;
        const thumbnail = await Thumbnail.findOne({ _id: id, userId });
        if (!thumbnail) {
            return res.status(404).json({ message: "Thumbnail not found" });
        }
        const [user, job] = await Promise.all([
            defaultCreditService.getStore().getUserById(userId),
            thumbnail.jobId
                ? defaultCreditService.getStore().findJobById(thumbnail.jobId)
                : Promise.resolve(null),
        ]);
        const userPlan = user?.plan || "starter";
        const sanitizedThumb = sanitizeThumbnailForPlan(thumbnail, userPlan);
        res.json({
            thumbnail: sanitizedThumb,
            job: job ? sanitizeJobAssetsForPlan(job, userPlan) : null,
            isComplete: !sanitizedThumb.isGenerating && !!sanitizedThumb.image_url,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// Delete thumbnail
export const deleteThumbnail = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.session;
        await Thumbnail.findOneAndDelete({ _id: id, userId });
        res.json({ message: "Thumbnail deleted successfully" });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};
// Get showcase thumbnails for homepage (strictly Cloudflare R2 bucket objects; NEVER fetch generated images from database)
export const getShowcaseThumbnails = async (req, res) => {
    try {
        const liveItems = await fetchLiveShowcaseThumbnails();
        return res.json({ thumbnails: liveItems, count: liveItems.length, source: "cloudflare_r2" });
    }
    catch (error) {
        console.error("Error fetching Cloudflare R2 showcase thumbnails:", error);
        res.status(500).json({ message: error.message || "Failed to fetch Cloudflare R2 thumbnails" });
    }
};
/**
 * Feature 4 & Feature 5: One-Click Multi-Platform Smart-Crop & <=2MB YouTube Studio Exporter
 * (`GET /api/thumbnail/export/:id?variant=yt_jpg_2mb|shorts_9_16|square_1_1|portrait_4_5`)
 * Strictly enforces Starter plan watermark isolation (uses `watermarked_url` for Starter,
 * `original_url` for Creator/Pro) and optionally composites live code-rendered headline + arrow.
 */
export const exportThumbnailVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.session;
        if (!userId) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Authentication required" });
        }
        const thumbnail = await Thumbnail.findOne({ _id: id, userId });
        if (!thumbnail) {
            return res.status(404).json({ message: "Thumbnail not found" });
        }
        const user = await defaultCreditService.getStore().getUserById(userId);
        const userPlan = user?.plan || "starter";
        const sanitized = sanitizeThumbnailForPlan(thumbnail, userPlan);
        const sourceUrl = sanitized.image_url;
        if (!sourceUrl) {
            return res
                .status(400)
                .json({ message: "Thumbnail image is not ready for export yet" });
        }
        const upstream = await fetch(sourceUrl);
        if (!upstream.ok) {
            return res
                .status(502)
                .json({ message: "Failed to fetch master asset from storage" });
        }
        let workingBuffer = Buffer.from(await upstream.arrayBuffer());
        // Optional live headline + pointer arrow compositing (Feature 5, 0 extra credits)
        const overlayTitle = String(req.query.overlay_title || "").trim();
        if (overlayTitle) {
            const overlayPosition = req.query.overlay_position || "bottom";
            const overlayAccent = String(req.query.overlay_accent || "#FFFFFF");
            const overlayArrow = req.query.overlay_arrow || "none";
            const xPct = req.query.x_pct !== undefined ? Number(req.query.x_pct) : undefined;
            const yPct = req.query.y_pct !== undefined ? Number(req.query.y_pct) : undefined;
            const overlaid = await applyServerTextOverlay(workingBuffer, {
                text: overlayTitle,
                position: overlayPosition,
                textColorHex: overlayAccent,
                pointerArrow: overlayArrow,
                xPercent: Number.isFinite(xPct) ? xPct : undefined,
                yPercent: Number.isFinite(yPct) ? yPct : undefined,
            });
            workingBuffer = overlaid.buffer;
        }
        const variant = String(req.query.variant || "master");
        const safeSlug = (thumbnail.title || "thumbgen")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40) || "thumbnail";
        if (variant === "yt_jpg_2mb") {
            const exported = await exportForPlatformPreset(workingBuffer, "youtube_video", thumbnail.resolution === "4k" ? "4K" : "2K");
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Content-Disposition", `attachment; filename="${safeSlug}-yt-studio-under-2mb.jpg"`);
            return res.send(exported.fallbackJpgBuffer);
        }
        if (variant === "shorts_9_16" ||
            variant === "square_1_1" ||
            variant === "portrait_4_5") {
            const ratioMap = {
                shorts_9_16: "9:16",
                square_1_1: "1:1",
                portrait_4_5: "4:5",
            };
            const cropped = await smartCropFromMaster(workingBuffer, ratioMap[variant]);
            res.setHeader("Content-Type", "image/webp");
            res.setHeader("Content-Disposition", `attachment; filename="${safeSlug}-${variant}.webp"`);
            return res.send(cropped.buffer);
        }
        // Default: master WebP (with optional live headline + arrow overlay)
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Content-Disposition", `attachment; filename="${safeSlug}-master.webp"`);
        return res.send(workingBuffer);
    }
    catch (error) {
        return res
            .status(500)
            .json({ message: error?.message || "Export failed" });
    }
};
