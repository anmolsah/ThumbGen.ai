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

// Connect to MongoDB (worker reads/writes Thumbnail & User models)
await connectDB();

// Start the worker — this file simply importing it kicks it off
import "./workers/thumbnailWorker.js";

console.log("🚀 ThumbGen Worker Process started — listening for jobs...");
