/**
 * workerProcess.ts
 *
 * Standalone entrypoint for the BullMQ thumbnail worker.
 * Run separately from the Express API:
 *   npm run worker
 *
 * This keeps the worker's CPU/IO load off the Express event loop,
 * which prevents API slowdowns when 5 AI jobs run concurrently.
 */

import "dotenv/config";
import connectDB from "./configs/db.js";
import "./configs/cloudinary.js";
import { assertValidStartupRegistry } from "./configs/registryValidator.js";
import { defaultCreditService } from "./services/creditService.js";

// Validate model registry at boot (fails production startup if any enabled mode has null/stale/unverified values per Rule R3)
assertValidStartupRegistry();

// Connect to MongoDB (worker reads/writes Thumbnail & User models)
await connectDB();

// Refund any orphaned queued/running jobs left over from a prior worker crash
await defaultCreditService.sweepOrphanedJobs().catch((err) => {
  console.warn("[CreditService] Worker startup orphan sweep warning:", err?.message);
});

// Start the worker — this file simply importing it kicks it off
import "./workers/thumbnailWorker.js";

console.log("🚀 ThumbGen Worker Process started — listening for jobs...");
