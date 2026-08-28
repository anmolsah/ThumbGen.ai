import express from "express";
import {
  deleteThumbnail,
  editThumbnail,
  generateThumbnail,
  getThumbnailStatus,
  getShowcaseThumbnails,
} from "../controllers/ThumbnailController.js";
import protect from "../middlewares/auth.js";

const ThumbnailRouter = express.Router();

ThumbnailRouter.post("/generate", protect, generateThumbnail);
ThumbnailRouter.post("/edit", protect, editThumbnail);
ThumbnailRouter.get("/status/:id", protect, getThumbnailStatus);
ThumbnailRouter.get("/showcase", getShowcaseThumbnails);
ThumbnailRouter.delete("/delete/:id", protect, deleteThumbnail);

export default ThumbnailRouter;
