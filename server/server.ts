import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";
import session from "express-session";
import { createClient } from "redis";
import { RedisStore } from "connect-redis";
import AuthRouter from "./routes/AuthRoutes.js";
import ThumbnailRouter from "./routes/ThumbnailRoutes.js";
import UserRouter from "./routes/UserRoutes.js";
import PaymentRouter from "./routes/PaymentRoutes.js";
import SSERouter from "./routes/SSERoutes.js";
import {
  assertValidStartupRegistry,
  loadRegistryConfig,
} from "./configs/registryValidator.js";
import { defaultCreditService } from "./services/creditService.js";
import { defaultObservability } from "./services/observabilityService.js";
import {
  generateThumbnail,
  getJobStatus,
} from "./controllers/ThumbnailController.js";
import protect from "./middlewares/auth.js";

// Validate model registry at boot
assertValidStartupRegistry({
  nodeEnv:
    process.env.STRICT_REGISTRY_BOOT === "true" ? "production" : "development",
});

// ─── NOTE ────────────────────────────────────────────────────────────────────
// The BullMQ worker is NO LONGER imported here.
// Run it as a separate process:   npm run worker
// This prevents the worker's CPU/IO from saturating the Express event loop.
// ─────────────────────────────────────────────────────────────────────────────

declare module "express-session" {
  interface SessionData {
    isLoggedIn: boolean;
    userId: string;
  }
}

await connectDB();
defaultCreditService
  .sweepOrphanedJobs()
  .then((res) => {
    if (res.sweptCount > 0) {
      console.log(
        `[CreditService] Startup sweep refunded ${res.refundedJobIds.length}/${res.sweptCount} orphaned job(s).`
      );
    }
  })
  .catch((err) =>
    console.warn("[CreditService] Startup orphan sweep warning:", err?.message)
  );

// ── Redis session client (node-redis v4 — required by connect-redis) ─────────
// This is separate from the ioredis client used by BullMQ,
// because ioredis and node-redis have different interfaces.
const redisSessionClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisSessionClient.on("error", (err) =>
  console.error("Session Redis error:", err)
);
redisSessionClient.on("connect", () =>
  console.log("Session Redis connected")
);

await redisSessionClient.connect();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    },
    // ── 2.2: Sessions stored in Redis ────────────────────────────────────────
    // Redis session reads are ~0.1ms vs 5–20ms for MongoDB.
    // ttl: explicit 7-day TTL (seconds) — avoids the store computing it on
    //      every request from cookie.maxAge, saving a small but constant overhead.
    // disableTouch: true — stops the store issuing a Redis EXPIRE command on
    //      every single authenticated request just to slide the TTL window.
    //      Session expiry is still enforced; we just don't extend it each request.
    store: new RedisStore({
      client: redisSessionClient,
      ttl: 60 * 60 * 24 * 7,   // 7 days in seconds
      disableTouch: true,        // no EXPIRE on every request → saves ~1 op/request
    }),
  })
);

app.use(express.json({ limit: "20mb" }));

app.get("/", (req: Request, res: Response) => {
  res.send("Server is Live!");
});

// Prometheus metrics endpoint (Phase 7 & Phase 8 Observability)
app.get("/metrics", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(defaultObservability.renderPrometheusMetrics());
});

// JSON metrics & alert evaluation summary
app.get("/api/metrics/summary", (req: Request, res: Response) => {
  res.json({
    metrics: defaultObservability.getMetricsSnapshot(),
    alerts: defaultObservability.evaluateAlertRules(),
  });
});

// Public configuration endpoint derived from config/registry.json (never exposes internal model/provider costs)
app.get("/api/config/public", (req: Request, res: Response) => {
  try {
    const registry = loadRegistryConfig();
    const publicPlans = Object.entries(registry.plans).map(([id, plan]) => ({
      id,
      name: plan.name,
      price_usd: plan.price_usd,
      credits: plan.credits,
      most_popular: plan.most_popular,
      max_resolution: plan.max_resolution,
      watermark: plan.watermark,
      reference_images: plan.reference_images,
      max_concurrent_jobs: plan.max_concurrent_jobs,
      marketing_thumbnails_claim: plan.marketing_thumbnails_claim,
    }));

    const publicModes = Object.entries(registry.modes)
      .filter(([, mode]) => mode.enabled)
      .map(([id, mode]) => ({
        id,
        label: mode.label,
        description: mode.description,
        credits: mode.credits,
        allowed_plans: mode.allowed_plans,
        max_resolution_by_plan: mode.max_resolution_by_plan,
        supports_reference_image: mode.candidates.some(
          (c) => c.supports_reference_image && c.model_id !== null
        ),
      }));

    res.json({
      plans: publicPlans,
      modes: publicModes,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to load public configuration" });
  }
});

// Debug endpoint to check session
app.get("/api/debug/session", (req: Request, res: Response) => {
  res.json({
    sessionId: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie,
  });
});

app.use("/api/auth", AuthRouter);
app.use("/api/thumbnail", ThumbnailRouter);
app.post("/api/generate", protect, generateThumbnail);
app.get("/api/jobs/:id", protect, getJobStatus);
app.use("/api/user", UserRouter);
app.use("/api/payment", PaymentRouter);
// ── 2.3: SSE endpoint for real-time job completion notifications ──────────────
app.use("/api/sse", SSERouter);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// ── Export for Vercel serverless ──────────────────────────────────────────────
export default app;
