import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true,
    },
    password: { type: String, required: true },
    channelName: { type: String, trim: true, default: "" },
    avatar: { type: String, trim: true, default: "" },
    plan: {
        type: String,
        enum: ["none", "free", "starter", "creator", "pro"],
        default: "none",
    },
    credits: { type: Number, default: 0, min: 0 },
    totalCredits: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;
