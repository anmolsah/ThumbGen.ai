import { Request, Response } from "express";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcrypt";
import { sendOtpEmail } from "../configs/brevo.js";

// Generate 6-digit OTP
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to format user response
const formatUserResponse = (user: any) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  plan: user.plan,
  credits: user.credits,
  totalCredits: user.totalCredits,
});

// Send OTP for registration
export const sendRegisterOtp = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Delete any existing OTP for this email
    await Otp.deleteMany({ email });

    // Generate OTP and hash password
    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save OTP with user data (expires in 10 minutes)
    const otpDoc = new Otp({
      email,
      otp,
      name,
      password: hashedPassword,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    await otpDoc.save();

    // Send OTP email
    await sendOtpEmail(email, otp, name);

    return res.json({ message: "OTP sent to your email" });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Verify OTP and complete registration
export const verifyOtpAndRegister = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Create user
    const newUser = new User({
      name: otpRecord.name,
      email: otpRecord.email,
      password: otpRecord.password,
    });
    await newUser.save();

    // Delete OTP record
    await Otp.deleteOne({ _id: otpRecord._id });

    // Set session
    req.session.isLoggedIn = true;
    req.session.userId = newUser._id.toString();

    // Explicitly save session before responding
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      return res.json({
        message: "Account created successfully",
        user: formatUserResponse(newUser),
      });
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Resend OTP
export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find existing OTP record
    const existingOtp = await Otp.findOne({ email });

    if (!existingOtp) {
      return res.status(400).json({ message: "No pending registration found" });
    }

    // Generate new OTP
    const otp = generateOtp();

    // Update OTP record
    existingOtp.otp = otp;
    existingOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await existingOtp.save();

    // Send OTP email
    await sendOtpEmail(email, otp, existingOtp.name);

    return res.json({ message: "OTP resent to your email" });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Controllers For User Registration (kept for backward compatibility)
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    req.session.isLoggedIn = true;
    req.session.userId = newUser._id.toString();

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      return res.json({
        message: "Account created successfully",
        user: formatUserResponse(newUser),
      });
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Controllers For User Login
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    req.session.isLoggedIn = true;
    req.session.userId = user._id.toString();

    // Explicitly save session before responding
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session error" });
      }
      return res.json({
        message: "Login successful",
        user: formatUserResponse(user),
      });
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Controllers For User Logout
export const logoutUser = async (req: Request, res: Response) => {
  req.session.destroy((error: any) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  });
  return res.json({ message: "Logout successful" });
};

// Controllers For User Verify
export const verifyUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(400).json({ message: "Invalid user" });
    }

    return res.json({ user: formatUserResponse(user) });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
