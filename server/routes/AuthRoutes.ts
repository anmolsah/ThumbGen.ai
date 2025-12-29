import express from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  verifyUser,
  sendRegisterOtp,
  verifyOtpAndRegister,
  resendOtp,
} from "../controllers/AuthControllers.js";
import protect from "../middlewares/auth.js";

const AuthRouter = express.Router();

// OTP-based registration
AuthRouter.post("/send-otp", sendRegisterOtp);
AuthRouter.post("/verify-otp", verifyOtpAndRegister);
AuthRouter.post("/resend-otp", resendOtp);

// Legacy registration (kept for backward compatibility)
AuthRouter.post("/register", registerUser);

// Login/Logout
AuthRouter.post("/login", loginUser);
AuthRouter.get("/verify", protect, verifyUser);
AuthRouter.post("/logout", protect, logoutUser);

export default AuthRouter;
