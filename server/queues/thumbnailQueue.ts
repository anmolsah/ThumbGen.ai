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
  reference_image?: string;
  userPlan: string;
  creditsRequired: number;
}

const thumbnailQueue = new Queue<ThumbnailJobData>("thumbnail-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export default thumbnailQueue;
