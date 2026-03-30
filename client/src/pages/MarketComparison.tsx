"use client";
import { motion } from "motion/react";
import {
  CheckIcon,
  MinusIcon,
  ArrowRightIcon,
  SparklesIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SoftBackdrop from "../components/SoftBackdrop";
import SEO from "../components/SEO";

/* ─── Minimalist Data ─── */
const competitors = [
  { name: "ThumbGen",   isUs: true,  price: "$0.09/ea",  subscription: "No", quality: "Ultra 4K", watermark: "No" },
  { name: "ThumbnailTest", isUs: false, price: "$25.00/mo",  subscription: "Yes", quality: "High", watermark: "No" },
  { name: "Canva Pro",  isUs: false, price: "$15.00/mo",  subscription: "Yes", quality: "Medium", watermark: "Yes" },
  { name: "ThumbMachine", isUs: false, price: "$12.00/mo", subscription: "Yes", quality: "Medium", watermark: "Yes" },
];

const featuresList = [
  { label: "Pricing", key: "price" },
  { label: "Subscription Required", key: "subscription" },
  { label: "Output Quality", key: "quality" },
  { label: "Forces Watermark", key: "watermark" },
] as const;

export default function MarketComparison() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  return (
    <>
      <SEO
        title="Compare Pricing – ThumbGen"
        description="See how ThumbGen's pay-per-generation pricing compares to SaaS subscriptions."
      />
      <SoftBackdrop />

      <div className="min-h-screen pt-24 sm:pt-32 pb-16 px-4">
        <div className="max-w-5xl mx-auto">

          {/* ── Header ── */}
          <motion.div
            className="text-center mb-16 sm:mb-20"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">
              Compare Alternatives
            </h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Stop paying expensive monthly subscriptions for basic design tools.
            </p>
          </motion.div>

          {/* ── Clean Table ── */}
          <motion.div
            className="mb-16 rounded-3xl border border-white/5 bg-zinc-950/50 backdrop-blur-sm overflow-hidden shadow-2xl"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-sm font-medium text-gray-500">
                    <th className="p-6 w-1/4">Features</th>
                    {competitors.map((c) => (
                      <th
                        key={c.name}
                        className={`p-6 text-center ${c.isUs ? "text-white bg-white/5" : "text-gray-400"}`}
                      >
                        {c.name}
                        {c.isUs && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500 text-white">
                            YOU
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-sm sm:text-base divide-y divide-white/5">
                  {featuresList.map((feat) => (
                    <tr key={feat.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-6 font-medium text-gray-300">
                        {feat.label}
                      </td>
                      {competitors.map((c) => (
                        <td
                          key={c.name}
                          className={`p-6 text-center font-medium ${
                            c.isUs ? "text-brand-400 bg-white/5" : "text-gray-400"
                          }`}
                        >
                          {c[feat.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Final check row for visual impact */}
                  <tr>
                    <td className="p-6 font-medium text-gray-300">True AI Generation</td>
                    {competitors.map((c) => (
                      <td key={c.name} className={`p-6 flex justify-center ${c.isUs ? "bg-white/5" : ""}`}>
                        {c.isUs || c.name === "ThumbnailTest" ? (
                          <CheckIcon className="size-5 text-emerald-500" />
                        ) : (
                          <MinusIcon className="size-5 text-gray-600" />
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* ── Minimal CTA ── */}
          <motion.div
            className="flex justify-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <button
              onClick={() => navigate(isLoggedIn ? "/generate" : "/login")}
              className="inline-flex items-center gap-2 bg-white text-black hover:bg-gray-200 font-semibold px-8 py-3.5 rounded-full transition-all text-base sm:text-lg shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
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
