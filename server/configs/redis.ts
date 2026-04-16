import { Redis } from "ioredis";

// ioredis does NOT auto-detect TLS from rediss:// — must pass tls:{} explicitly.
// Upstash always uses rediss:// (TLS required), so we detect and enable it here.
const isTLS = (process.env.REDIS_URL || "").startsWith("rediss://");

const redisConnection = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    ...(isTLS && { tls: {} }),
  }
);

redisConnection.on("connect", () => {
  console.log("Redis connected");
});

redisConnection.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redisConnection;
