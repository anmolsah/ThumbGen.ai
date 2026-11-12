import { Router } from "express";
import { Redis } from "ioredis";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";
import { sanitizeThumbnailForPlan } from "../services/postProcessService.js";
const SSERouter = Router();
// ── Shared SSE subscriber (1 connection for ALL active SSE listeners) ─────────
// Previously: a new Redis connection was opened per SSE request → huge waste.
// Now: one persistent subscriber client, multiplexed over a channel→callback map.
// Redis SUBSCRIBE is cheap to add channels to an existing connection.
const isTLS = (process.env.REDIS_URL || "").startsWith("rediss://");
const sharedSubscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    ...(isTLS && { tls: {} }),
    // Keep alive so the connection doesn't drop between jobs
    keepAlive: 10000,
});
sharedSubscriber.on("error", (err) => console.error("SSE shared subscriber error (non-fatal):", err.message));
// channel  →  Set of callbacks (multiple clients can watch the same thumbnail)
const channelListeners = new Map();
sharedSubscriber.on("message", (channel, message) => {
    const listeners = channelListeners.get(channel);
    if (!listeners)
        return;
    for (const cb of listeners)
        cb(message);
});
/** Subscribe a callback to a channel. Unsubscribes from Redis when last listener leaves. */
function addListener(channel, cb) {
    if (!channelListeners.has(channel)) {
        channelListeners.set(channel, new Set());
        sharedSubscriber.subscribe(channel).catch(() => { });
    }
    channelListeners.get(channel).add(cb);
}
/** Remove a callback. If no listeners remain, unsubscribe from Redis. */
function removeListener(channel, cb) {
    const listeners = channelListeners.get(channel);
    if (!listeners)
        return;
    listeners.delete(cb);
    if (listeners.size === 0) {
        channelListeners.delete(channel);
        sharedSubscriber.unsubscribe(channel).catch(() => { });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
SSERouter.get("/thumbnail/:id", async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    // ── SSE headers ────────────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    // Helper: check DB and fire complete if already done.
    const checkAndSendIfComplete = async () => {
        try {
            const thumbnail = await Thumbnail.findOne({ _id: id, userId }, { image_url: 1, isGenerating: 1, error: 1, error_code: 1 });
            if (!thumbnail) {
                sendEvent("error", { message: "Thumbnail not found" });
                res.end();
                return true;
            }
            if (!thumbnail.isGenerating && (thumbnail.image_url || thumbnail.error)) {
                const [full, user] = await Promise.all([
                    Thumbnail.findById(id),
                    User.findById(userId).select("plan").lean(),
                ]);
                const userPlan = user?.plan || "starter";
                const sanitized = sanitizeThumbnailForPlan(full, userPlan);
                sendEvent("complete", {
                    thumbnail: sanitized,
                    error: full?.error,
                    errorCode: full?.error_code,
                });
                res.end();
                return true;
            }
        }
        catch {
            // DB error — don't end the stream, let the subscriber handle it
        }
        return false;
    };
    // ── Fast path: already complete when client connects ─────────────────────
    const alreadyDone = await checkAndSendIfComplete();
    if (alreadyDone)
        return;
    // ── Slow path: listen on shared subscriber ────────────────────────────────
    const channel = `thumbnail:complete:${id}`;
    let settled = false;
    const onMessage = (message) => {
        if (settled)
            return;
        settled = true;
        clearTimeout(timeout);
        removeListener(channel, onMessage);
        try {
            const payload = JSON.parse(message);
            sendEvent("complete", payload);
        }
        catch {
            sendEvent("complete", { thumbnailId: id });
        }
        res.end();
    };
    const cleanup = () => {
        if (!settled) {
            settled = true;
            clearTimeout(timeout);
            removeListener(channel, onMessage);
        }
    };
    // ── RACE CONDITION FIX ────────────────────────────────────────────────────
    // Subscribe first, then re-check DB so we don't miss a publish that happened
    // between the initial DB check and now.
    addListener(channel, onMessage);
    const done = await checkAndSendIfComplete();
    if (done) {
        cleanup();
        return;
    }
    // ── Safety timeout: 120s ──────────────────────────────────────────────────
    const timeout = setTimeout(() => {
        sendEvent("timeout", { message: "Job is taking longer than expected" });
        cleanup();
        res.end();
    }, 120000);
    req.on("close", () => {
        cleanup();
    });
});
export default SSERouter;
