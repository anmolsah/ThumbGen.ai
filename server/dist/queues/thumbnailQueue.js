import { Queue } from "bullmq";
import redisConnection from "../configs/redis.js";
const thumbnailQueue = new Queue("thumbnail-generation", {
    connection: redisConnection,
    defaultJobOptions: {
        // Retries and candidate fallback are orchestrated per-model inside executeGenerationWithFallback
        attempts: 1,
        // ── Reduced housekeeping counts → fewer EVALSHA Lua ops per job ───────
        // BullMQ runs a Lua cleanup script on every completion/failure.
        // Keeping only 10 completed + 10 failed jobs cuts ~30 Redis ops/job.
        removeOnComplete: { count: 10, age: 3600 }, // max 10 jobs, purge after 1h
        removeOnFail: { count: 10, age: 86400 }, // max 10 jobs, purge after 24h
    },
});
export default thumbnailQueue;
