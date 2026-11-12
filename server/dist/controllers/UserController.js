import Thumbnail from "../models/Thumbnail.js";
import User from "../models/User.js";
import { sanitizeThumbnailForPlan } from "../services/postProcessService.js";
// Update user profile (name, channelName, avatar)
export const updateProfile = async (req, res) => {
    try {
        const { userId } = req.session;
        const { name, channelName, avatar } = req.body;
        const updateFields = {};
        if (name && name.trim())
            updateFields.name = name.trim();
        if (channelName !== undefined)
            updateFields.channelName = channelName.trim();
        if (avatar !== undefined)
            updateFields.avatar = avatar.trim();
        const user = await User.findByIdAndUpdate(userId, updateFields, {
            new: true,
            select: "-password",
        });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        return res.json({ success: true, message: "Profile updated!", user });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};
// Controllers to get All User Thumbnails (with Starter watermark isolation)
export const getUsersThumbnails = async (req, res) => {
    try {
        const { userId } = req.session;
        const [user, thumbnails] = await Promise.all([
            User.findById(userId).select("plan").lean(),
            Thumbnail.find({ userId }).sort({ createdAt: -1 }),
        ]);
        const userPlan = user?.plan || "starter";
        const sanitized = thumbnails.map((t) => sanitizeThumbnailForPlan(t, userPlan));
        res.json({ thumbnails: sanitized });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};
// Controllers to get single Thumbnail of a User (with Starter watermark isolation)
export const getThumbnailbyId = async (req, res) => {
    try {
        const { userId } = req.session;
        const { id } = req.params;
        const [thumbnail, user] = await Promise.all([
            Thumbnail.findOne({ userId, _id: id }),
            User.findById(userId).select("credits totalCredits plan"),
        ]);
        const userPlan = user?.plan || "starter";
        res.json({
            thumbnail: sanitizeThumbnailForPlan(thumbnail, userPlan),
            credits: user?.credits,
            totalCredits: user?.totalCredits,
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};
