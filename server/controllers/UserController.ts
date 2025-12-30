import { Request, Response } from "express";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";

// Controllers to get All User Thumbnails
export const getUsersThumbnails = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    const thumbnails = await Thumbnail.find({ userId }).sort({ createdAt: -1 });
    res.json({ thumbnails });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Controllers to get single Thumbnail of a User
export const getThumbnailbyId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { id } = req.params;

    const thumbnail = await Thumbnail.findOne({ userId, _id: id });
    const user = await User.findById(userId).select("credits totalCredits");

    res.json({
      thumbnail,
      credits: user?.credits,
      totalCredits: user?.totalCredits,
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
