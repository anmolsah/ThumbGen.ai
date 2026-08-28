import { Queue } from "bullmq";
import redisConnection from "../configs/redis.js";

export interface ThumbnailJobData {
  thumbnailId: string;
  userId: string;
  title: string;
  user_prompt: string;
  style: string;
  aspect_ratio: string;
  color_scheme: string;
  text_overlay: boolean;
  resolution: string;
  platform: string;
  youtube_reference_url?: string;
  reference_image?: string;
  userPlan: string;
  creditsRequired: number;
  // Edit-specific fields
  edit_instructions?: string;
  source_image_url?: string;
}

const thumbnailQueue = new Queue<ThumbnailJobData>("thumbnail-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    // ── Reduced housekeeping counts → fewer EVALSHA Lua ops per job ───────
    // BullMQ runs a Lua cleanup script on every completion/failure.
    // Keeping only 10 completed + 10 failed jobs cuts ~30 Redis ops/job.
    removeOnComplete: { count: 10, age: 3600 },  // max 10 jobs, purge after 1h
    removeOnFail:     { count: 10, age: 86400 },  // max 10 jobs, purge after 24h
  },
});

export default thumbnailQueue;
