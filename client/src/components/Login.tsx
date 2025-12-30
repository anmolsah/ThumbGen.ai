import React, { useEffect, useState, useRef } from "react";
import SoftBackdrop from "./SoftBackdrop";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2Icon } from "lucide-react";

const Login = () => {
  const [state, setState] = useState<"login" | "register" | "otp">("login");
  const { user, login, sendOtp, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (state === "login") {
      await login(formData);
    } else if (state === "register") {
      const success = await sendOtp(formData);
      if (success) {
        setState("otp");
        setCountdown(60);
      }
    }

    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtpValues = [...otpValues];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtpValues[index + i] = digit;
        }
      });
      setOtpValues(newOtpValues);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtpValues = [...otpValues];
    newOtpValues[index] = value;
    setOtpValues(newOtpValues);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpValues.join("");
    if (otp.length !== 6) return;

    setLoading(true);
    const success = await verifyOtp(formData.email, otp);
    if (!success) {
      setOtpValues(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    const success = await resendOtp(formData.email);
    if (success) {
      setCountdown(60);
      setOtpValues(["", "", "", "", "", ""]);
    }
    setLoading(false);
  };

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-verify when all digits entered
  useEffect(() => {
    if (otpValues.every((v) => v) && state === "otp") {
      handleVerifyOtp();
    }
  }, [otpValues]);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user]);

  return (
    <>
      <SoftBackdrop />
      <div className="min-h-screen flex items-center justify-center px-4">
        {state === "otp" ? (
          // OTP Verification Screen
          <div className="w-full sm:w-96 text-center bg-white/6 border border-white/10 rounded-2xl px-8 py-10">
            <div className="size-16 mx-auto mb-4 rounded-full bg-brand-500/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-8 text-brand-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-white text-2xl font-medium">
              Verify your email
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              We've sent a 6-digit code to
              <br />
              <span className="text-brand-400">{formData.email}</span>
            </p>

            {/* OTP Input */}
            <div className="flex justify-center gap-2 mt-8">
              {otpValues.map((value, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={value}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-11 h-13 text-center text-xl font-semibold bg-white/5 border-2 border-white/10 rounded-lg focus:border-brand-500 focus:outline-none text-white transition-all"
                  disabled={loading}
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otpValues.some((v) => !v)}
              className="mt-8 w-full h-11 rounded-full text-white bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2Icon className="size-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Create Account"
              )}
            </button>

            {/* Resend OTP */}
            <p className="text-gray-400 text-sm mt-6">
              Didn't receive the code?{" "}
              {countdown > 0 ? (
                <span className="text-gray-500">Resend in {countdown}s</span>
              ) : (
                <button
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-brand-400 hover:underline disabled:opacity-50"
                >
                  Resend OTP
                </button>
              )}
            </p>

            {/* Back button */}
            <button
              onClick={() => {
                setState("register");
                setOtpValues(["", "", "", "", "", ""]);
              }}
              className="text-gray-500 text-sm mt-4 hover:text-gray-400"
            >
              ← Change email
            </button>
          </div>
        ) : (
          // Login/Register Form
          <form
            onSubmit={handleSubmit}
            className="w-full sm:w-87.5 text-center bg-white/6 border border-white/10 rounded-2xl px-8"
          >
            <h1 className="text-white text-3xl mt-10 font-medium">
              {state === "login" ? "Login" : "Sign up"}
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              {state === "login"
                ? "Please sign in to continue"
                : "Create your account"}
            </p>

            {state !== "login" && (
              <div className="flex items-center mt-6 w-full bg-white/5 ring-2 ring-white/10 focus-within:ring-brand-500/60 h-12 rounded-full overflow-hidden pl-6 gap-2 transition-all">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="text-white/60"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="5" />
                  <path d="M20 21a8 8 0 0 0-16 0" />
                </svg>
                <input
                  type="text"
                  name="name"
                  placeholder="Name"
                  className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="flex items-center w-full mt-4 bg-white/5 ring-2 ring-white/10 focus-within:ring-brand-500/60 h-12 rounded-full overflow-hidden pl-6 gap-2 transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="text-white/75"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                <rect x="2" y="4" width="20" height="16" rx="2" />
              </svg>
              <input
                type="email"
                name="email"
                placeholder="Email id"
                className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="flex items-center mt-4 w-full bg-white/5 ring-2 ring-white/10 focus-within:ring-brand-500/60 h-12 rounded-full overflow-hidden pl-6 gap-2 transition-all">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="text-white/75"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                name="password"
                placeholder="Password"
                className="w-full bg-transparent text-white placeholder-white/60 border-none outline-none"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            {state === "login" && (
              <div className="mt-4 text-left">
                <button
                  type="button"
                  className="text-sm text-brand-400 hover:underline"
                >
                  Forget password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full h-11 rounded-full text-white bg-brand-500 hover:bg-brand-400 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2Icon className="size-5 animate-spin" />
                  {state === "login" ? "Logging in..." : "Sending OTP..."}
                </>
              ) : state === "login" ? (
                "Login"
              ) : (
                "Continue"
              )}
            </button>

            <p
              onClick={() =>
                setState((prev) => (prev === "login" ? "register" : "login"))
              }
              className="text-gray-400 text-sm mt-3 mb-11 cursor-pointer"
            >
              {state === "login"
                ? "Don't have an account?"
                : "Already have an account?"}
              <span className="text-brand-400 hover:underline ml-1">
                click here
              </span>
            </p>
          </form>
        )}
      </div>
    </>
  );
};

export default Login;
