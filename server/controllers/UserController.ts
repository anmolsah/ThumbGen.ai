import { Request, Response } from "express";
import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";

// Update user profile (name, channelName, avatar)
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { name, channelName, avatar } = req.body;

    const updateFields: { name?: string; channelName?: string; avatar?: string } = {};
    if (name && name.trim()) updateFields.name = name.trim();
    if (channelName !== undefined) updateFields.channelName = channelName.trim();
    if (avatar !== undefined) updateFields.avatar = avatar.trim();

    const user = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
      select: "-password",
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ success: true, message: "Profile updated!", user });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

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
