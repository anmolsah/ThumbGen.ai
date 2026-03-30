"use client";
import { motion } from "motion/react";
import {
  LinkIcon,
  Wand2Icon,
  DownloadIcon,
  ArrowRightIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import SEO from "../components/SEO";

const steps = [
  {
    icon: LinkIcon,
    title: "1. Input & Reference",
    description:
      "Paste a YouTube URL to perfectly copy its aesthetic, or describe exactly what you want your thumbnail to look like.",
  },
  {
    icon: Wand2Icon,
    title: "2. Generate AI Magic",
    description:
      "Select your target platform (YouTube, Reels, Posts) and our custom AI models generate highly-clickable options in seconds.",
  },
  {
    icon: DownloadIcon,
    title: "3. Export & Scale",
    description:
      "Download your favorite pixel-perfect thumbnail. Ready to upload, entirely watermark-free on premium plans.",
  },
];

export default function HowItWorks() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  return (
    <>
      <SEO
        title="How It Works"
        description="Learn how ThumbGen creates AI-powered multi-platform thumbnails in 3 simple steps."
        url="https://thumbgen.online/how-it-works"
      />
      <SoftBackdrop />
      <div className="min-h-screen pt-24 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Minimalist Header */}
          <motion.div
            className="text-center mb-16 sm:mb-24"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Create in 3 Steps.
            </h1>
            <p className="text-gray-400 text-lg sm:text-xl font-medium max-w-xl mx-auto">
              Skip the heavy design software. Give us a reference, and we handle the rest.
            </p>
          </motion.div>

          {/* Clean Vertical SaaS Timeline */}
          <div className="relative mb-24 max-w-2xl mx-auto">
            {/* The vertical connector line - hidden on small mobile if desired, but good for SaaS look */}
            <div className="hidden md:block absolute left-8 top-12 bottom-12 w-px bg-white/10" />

            <div className="flex flex-col gap-12 sm:gap-16">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  className="relative flex flex-col md:flex-row gap-6 md:gap-8 items-start group"
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                >
                  {/* Step Icon / Circle */}
                  <div className="relative z-10 size-16 shrink-0 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shadow-lg group-hover:border-brand-500/50 group-hover:bg-brand-500/10 transition-colors">
                    <step.icon className="size-6 text-brand-400" />
                  </div>

                  {/* Step Content */}
                  <div className="pt-2">
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-md">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Minimal CTA */}
          <motion.div
            className="text-center"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
          >
            <button
              onClick={() => navigate(isLoggedIn ? "/generate" : "/login")}
              className="inline-flex items-center gap-2 bg-white text-black hover:bg-gray-200 font-semibold px-8 py-3.5 rounded-full transition-all text-base sm:text-lg shadow-xl hover:shadow-2xl"
            >
              Start Generating
              <ArrowRightIcon className="size-5" />
            </button>
          </motion.div>
        </div>
      </div>
    </>
  );
}
