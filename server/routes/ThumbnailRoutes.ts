import express from "express";
import {
  deleteThumbnail,
  generateThumbnail,
  getThumbnailStatus,
} from "../controllers/ThumbnailController.js";
import protect from "../middlewares/auth.js";

const ThumbnailRouter = express.Router();

ThumbnailRouter.post("/generate", protect, generateThumbnail);
ThumbnailRouter.get("/status/:id", protect, getThumbnailStatus);
ThumbnailRouter.delete("/delete/:id", protect, deleteThumbnail);

export default ThumbnailRouter;
