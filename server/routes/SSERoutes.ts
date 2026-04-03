import { Router, Request, Response } from "express";
import { Redis } from "ioredis";
import Thumbnail from "../models/Thumbnail.js";

const SSERouter = Router();

SSERouter.get("/thumbnail/:id", async (req: Request, res: Response) => {
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

  const sendEvent = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Helper: check DB and fire complete if already done.
  // Returns true if the thumbnail was already complete.
  const checkAndSendIfComplete = async (): Promise<boolean> => {
    try {
      const thumbnail = await Thumbnail.findOne({ _id: id, userId });
      if (!thumbnail) {
        sendEvent("error", { message: "Thumbnail not found" });
        res.end();
        return true;
      }
      if (!thumbnail.isGenerating && thumbnail.image_url) {
        sendEvent("complete", { thumbnail });
        res.end();
        return true;
      }
    } catch {
      // DB error — don't end the stream, let the subscriber handle it
    }
    return false;
  };

  // ── Fast path: already complete when client connects ─────────────────────
  const alreadyDone = await checkAndSendIfComplete();
  if (alreadyDone) return;

  // ── Slow path: subscribe to Redis pub/sub ─────────────────────────────────
  const subscriber = new Redis(
    process.env.REDIS_URL || "redis://localhost:6379",
    { maxRetriesPerRequest: null }
  );

  // Suppress unhandled error events — connection issues are non-fatal here
  subscriber.on("error", () => {});

  const channel = `thumbnail:complete:${id}`;
  let settled = false;

  const cleanup = () => {
    if (!settled) {
      settled = true;
      clearTimeout(timeout);
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
    }
  };

  // ── RACE CONDITION FIX ────────────────────────────────────────────────────
  // The worker may have published BETWEEN our DB check above and now.
  // After subscribing, we re-check the DB so we don't miss a completed job.
  subscriber.subscribe(channel, async (err) => {
    if (err) {
      // Subscription failed — fall through; the polling interval in the
      // client will keep retrying
      sendEvent("error", { message: "Subscription failed" });
      cleanup();
      res.end();
      return;
    }

    // Re-check DB now that we are subscribed (closes the race window)
    const done = await checkAndSendIfComplete();
    if (done) cleanup();
  });

  subscriber.on("message", (_channel: string, message: string) => {
    try {
      const payload = JSON.parse(message);
      sendEvent("complete", payload);
    } catch {
      sendEvent("complete", { thumbnailId: id });
    }
    cleanup();
    res.end();
  });

  // ── Safety timeout: 120s ──────────────────────────────────────────────────
  const timeout = setTimeout(() => {
    sendEvent("timeout", { message: "Job is taking longer than expected" });
    cleanup();
    res.end();
  }, 120_000);

  req.on("close", () => {
    cleanup();
  });
});

export default SSERouter;
