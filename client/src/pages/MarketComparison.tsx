"use client";
import {
  CheckIcon,
  MinusIcon,
  ArrowRightIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SEO from "../components/SEO";

/* ─── Honest Category Comparison (Section 10 & Rule R2) ─── */
const competitors = [
  {
    name: "ThumbGen",
    isUs: true,
    price: "Starts at $6.00 (one-time)",
    subscription: "No",
    quality: "Up to True 4K (≥ 3840px)",
    watermark: "No on Creator & Pro (Starter: Yes)",
  },
  {
    name: "Recurring AI SaaS",
    isUs: false,
    price: "Monthly Subscription",
    subscription: "Yes",
    quality: "1K–2K",
    watermark: "Varies by tier",
  },
  {
    name: "Template Editors",
    isUs: false,
    price: "Monthly Subscription",
    subscription: "Yes",
    quality: "Manual Export",
    watermark: "Yes on Basic Tiers",
  },
  {
    name: "Freelance Designer",
    isUs: false,
    price: "Per-Thumbnail Fee",
    subscription: "No",
    quality: "Custom",
    watermark: "No",
  },
];

const featuresList = [
  { label: "Pricing Model", key: "price" },
  { label: "Recurring Subscription", key: "subscription" },
  { label: "Verified Resolution", key: "quality" },
  { label: "Watermark Policy", key: "watermark" },
] as const;

export default function MarketComparison() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  return (
    <>
      <SEO
        title="Compare Pricing – ThumbGen"
        description="See how ThumbGen's pay-per-generation credit packs compare to recurring subscriptions and manual workflows."
      />

      <div className="min-h-screen pt-28 pb-20 px-6 bg-[#090a0c]">
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mb-12">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-zinc-100">
              How ThumbGen compares to recurring design tools
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base mt-3 leading-relaxed">
              Pay once for a credit pack, choose 1-to-5 credit modes per thumbnail, and keep unused credits indefinitely.
            </p>
          </div>

          <div className="mb-12 rounded-xl border border-white/[0.08] bg-[#111317] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs font-mono uppercase tracking-wider text-zinc-400 bg-[#0d0f13]">
                    <th className="p-5 w-1/4">Dimension</th>
                    {competitors.map((c) => (
                      <th
                        key={c.name}
                        className={`p-5 text-center ${
                          c.isUs ? "text-zinc-100 bg-brand-500/[0.06]" : "text-zinc-400"
                        }`}
                      >
                        <span>{c.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm divide-y divide-white/[0.06] tabular-nums">
                  {featuresList.map((feat) => (
                    <tr key={feat.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-5 font-medium text-zinc-200">
                        {feat.label}
                      </td>
                      {competitors.map((c) => (
                        <td
                          key={c.name}
                          className={`p-5 text-center ${
                            c.isUs
                              ? "text-zinc-100 font-medium bg-brand-500/[0.06]"
                              : "text-zinc-400"
                          }`}
                        >
                          {c[feat.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="p-5 font-medium text-zinc-200">
                      Automatic Failure Refund
                    </td>
                    {competitors.map((c) => (
                      <td
                        key={c.name}
                        className={`p-5 ${c.isUs ? "bg-brand-500/[0.06]" : ""}`}
                      >
                        <div className="flex justify-center">
                          {c.isUs ? (
                            <CheckIcon className="size-4.5 text-emerald-400" />
                          ) : (
                            <MinusIcon className="size-4.5 text-zinc-600" />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 rounded-xl border border-white/[0.08] bg-[#111317] p-6">
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                Start with 25 credits for $6
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Generate 12–25 thumbnails in 2K on Starter, or unlock 4K and reference photos on Creator ($29) and Pro ($59).
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(isLoggedIn ? "/generate" : "/login")}
              className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-950 hover:bg-white font-semibold px-5 py-2.5 rounded-lg text-xs sm:text-sm"
            >
              <span>Open Studio</span>
              <ArrowRightIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
