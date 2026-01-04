"use client";
import { motion } from "motion/react";
import {
  SparklesIcon,
  PenLineIcon,
  ImageIcon,
  DownloadIcon,
  CheckCircleIcon,
  ArrowDownIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import SEO from "../components/SEO";

const steps = [
  {
    icon: PenLineIcon,
    title: "Describe Your Video",
    description:
      "Enter your video title and a brief description. Tell us about the mood, style, and key elements you want in your thumbnail.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: SparklesIcon,
    title: "AI Generates Options",
    description:
      "Our AI analyzes your input and generates multiple thumbnail options optimized for clicks and engagement.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: ImageIcon,
    title: "Preview & Choose",
    description:
      "Review the generated thumbnails. Each one is designed to grab attention and increase your click-through rate.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: DownloadIcon,
    title: "Download & Use",
    description:
      "Download your favorite thumbnail in high resolution. Upload it directly to YouTube and watch your views grow!",
    color: "from-green-500 to-emerald-500",
  },
];

const features = [
  "No design skills required",
  "Generate in under 60 seconds",
  "High-resolution 4K output",
  "Optimized for YouTube CTR",
  "Multiple style options",
  "Unlimited revisions",
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const handleGetStarted = () => {
    if (isLoggedIn) {
      navigate("/generate");
    } else {
      navigate("/login");
    }
  };

  return (
    <>
      <SEO
        title="How It Works"
        description="Learn how ThumbGen creates AI-powered YouTube thumbnails in 4 simple steps. No design skills needed - just describe your video and get professional thumbnails."
        url="https://thumbgen.online/how-it-works"
      />
      <SoftBackdrop />
      <div className="min-h-screen pt-24 sm:pt-28 md:pt-32 pb-16 md:pb-20 px-4 sm:px-6 md:px-16 lg:px-24 xl:px-32">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-10 sm:mb-12 md:mb-16"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
              How{" "}
              <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
                ThumbGen
              </span>{" "}
              Works
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto px-2">
              Create stunning YouTube thumbnails in 4 simple steps. No design
              experience needed.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12 sm:mb-16 md:mb-20">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                className="relative bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-5 sm:p-6 hover:border-white/20 transition-all"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                {/* Step number */}
                <div className="absolute -top-3 -left-3 sm:-top-4 sm:-left-4 size-8 sm:size-10 bg-brand-500 rounded-full flex items-center justify-center text-sm sm:text-lg font-bold">
                  {index + 1}
                </div>

                {/* Icon */}
                <div
                  className={`size-12 sm:size-14 rounded-lg sm:rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-3 sm:mb-4`}
                >
                  <step.icon className="size-6 sm:size-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-400 text-sm sm:text-base">
                  {step.description}
                </p>

                {/* Arrow to next step - mobile */}
                {index < steps.length - 1 && (
                  <div className="flex md:hidden justify-center mt-4">
                    <ArrowDownIcon className="size-6 text-brand-500 animate-bounce" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Features Grid */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 mb-12 sm:mb-16"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8">
              Why Choose ThumbGen?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5"
                >
                  <CheckCircleIcon className="size-5 text-brand-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm sm:text-base">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            className="text-center px-2"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 max-w-md mx-auto">
              Join thousands of creators who are already using ThumbGen to boost
              their YouTube presence.
            </p>
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 sm:px-8 py-2.5 sm:py-3 rounded-full transition-all text-sm sm:text-base"
            >
              <SparklesIcon className="size-4 sm:size-5" />
              Generate Your First Thumbnail
            </button>
          </motion.div>
        </div>
      </div>
    </>
  );
}
