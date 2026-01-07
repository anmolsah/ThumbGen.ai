import mongoose from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  plan: "none" | "starter" | "creator" | "pro";
  credits: number;
  totalCredits: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    plan: {
      type: String,
      enum: ["none", "starter", "creator", "pro"],
      default: "none",
    },
    credits: { type: Number, default: 0 },
    totalCredits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
