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
import "./configs/cloudinary.js";

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
    // ── 2.2: Sessions now stored in Redis instead of MongoDB ─────────────────
    // Redis session reads are ~0.1ms vs 5–20ms for MongoDB.
    // This is a free 10–50x speedup for every authenticated request.
    store: new RedisStore({ client: redisSessionClient }),
  })
);

app.use(express.json({ limit: "20mb" }));

app.get("/", (req: Request, res: Response) => {
  res.send("Server is Live!");
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
