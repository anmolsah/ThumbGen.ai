import { Request, Response } from "express";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";
import thumbnailQueue from "../queues/thumbnailQueue.js";

const CREDITS_PER_THUMBNAIL = 5;
const CREDITS_WITH_REFERENCE_IMAGE = 15;

export const generateThumbnail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const {
      title,
      prompt: user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
      reference_image,
    } = req.body;

    // Check if user has a plan and credits
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.plan === "none") {
      return res
        .status(403)
        .json({ message: "Please select a plan to generate thumbnails" });
    }

    // Check if reference image is allowed
    const canUseReferenceImage = user.plan === "creator" || user.plan === "pro";
    const usingReferenceImage = reference_image && canUseReferenceImage;
    const creditsRequired = usingReferenceImage
      ? CREDITS_WITH_REFERENCE_IMAGE
      : CREDITS_PER_THUMBNAIL;

    if (reference_image && !canUseReferenceImage) {
      return res.status(403).json({
        message:
          "Reference images are only available for Creator and Pro plans",
      });
    }

    if (user.credits < creditsRequired) {
      return res.status(403).json({
        message: usingReferenceImage
          ? `Insufficient credits. Reference image generation requires ${CREDITS_WITH_REFERENCE_IMAGE} credits.`
          : "Insufficient credits. Please upgrade your plan.",
      });
    }

    // Create thumbnail record
    const thumbnail = await Thumbnail.create({
      userId,
      title,
      prompt_used: user_prompt,
      user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
      isGenerating: true,
    });

    // Add job to queue (non-blocking)
    await thumbnailQueue.add(
      `generate-${thumbnail._id}`,
      {
        thumbnailId: thumbnail._id.toString(),
        userId: userId!,
        title,
        user_prompt,
        style,
        aspect_ratio,
        color_scheme,
        text_overlay,
        reference_image,
        userPlan: user.plan,
        creditsRequired,
      },
      {
        priority: user.plan === "pro" ? 1 : user.plan === "creator" ? 2 : 3,
      }
    );

    // Respond immediately - don't wait for generation
    res.json({
      message: "Thumbnail generation started",
      thumbnail,
      credits: user.credits, // Credits will be deducted when job completes
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Get thumbnail status (for polling)
export const getThumbnailStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session;

    const thumbnail = await Thumbnail.findOne({ _id: id, userId });

    if (!thumbnail) {
      return res.status(404).json({ message: "Thumbnail not found" });
    }

    res.json({
      thumbnail,
      isComplete: !thumbnail.isGenerating && !!thumbnail.image_url,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Delete thumbnail
export const deleteThumbnail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session;

    await Thumbnail.findByIdAndDelete({ _id: id, userId });

    res.json({ message: "Thumbnail deleted successfully" });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Get showcase thumbnails for homepage (public, no auth required)
export const getShowcaseThumbnails = async (req: Request, res: Response) => {
  try {
    // Get latest 12 completed thumbnails for showcase
    const thumbnails = await Thumbnail.find({
      isGenerating: false,
      image_url: { $exists: true, $ne: "" },
    })
      .select("title image_url style")
      .sort({ createdAt: -1 })
      .limit(12);

    res.json({ thumbnails });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
