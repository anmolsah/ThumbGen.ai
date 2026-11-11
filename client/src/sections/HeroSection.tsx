"use client";
import { ArrowRightIcon, CheckIcon, LayersIcon, SlidersHorizontalIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import thumb_1 from "../assets/thumb_1.jpg";
import thumb_2 from "../assets/thumb_2.jpg";
import thumb_3 from "../assets/thumb_3.jpg";
import thumb_13 from "../assets/thumb_13.png";

const showcaseSamples = [
  {
    src: thumb_13,
    title: "India's Highest Jump — Full Documentary",
    mode: "Ultra 4K",
    specs: "5504×3072 · 16:9 · 5 cr",
  },
  {
    src: thumb_1,
    title: "Top Smartwatch Under 1499",
    mode: "Text & Reference",
    specs: "2752×1536 · 16:9 · 3 cr",
  },
  {
    src: thumb_2,
    title: "How to Make 100K in 10 Days",
    mode: "Standard 2K",
    specs: "2560×1440 · 16:9 · 2 cr",
  },
  {
    src: thumb_3,
    title: "Learn Next.js 16 with a Real Project",
    mode: "Fastest 2K",
    specs: "2048×1152 · 16:9 · 1 cr",
  },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const handlePrimaryAction = () => {
    navigate(isLoggedIn ? "/generate" : "/login");
  };

  return (
    <section className="pt-28 pb-20 border-b border-white/[0.08] bg-[#090a0c]">
      <div className="max-w-7xl mx-auto px-6 animate-hero-enter">
        {/* Top split: Headline + Hard Facts + Actions */}
        <div className="grid lg:grid-cols-12 gap-10 items-end pb-12 border-b border-white/[0.08]">
          <div className="lg:col-span-8 space-y-5">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-zinc-100 leading-[1.08] text-balance">
              Studio-grade thumbnails from a title and prompt.
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-[62ch] leading-relaxed">
              Generate high-contrast YouTube, Shorts, X, and Instagram thumbnails in native 2K and true 4K resolution. Choose your speed and fidelity per job — from 1-credit rapid drafts to 5-credit Ultra 4K renders.
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end justify-end">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto lg:w-64 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-sm"
            >
              <span>Open Studio</span>
              <ArrowRightIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("pricing")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full sm:w-auto lg:w-64 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#111317] hover:bg-[#171a20] text-zinc-200 border border-white/[0.1] font-medium text-sm"
            >
              <span>View Credit Packs</span>
            </button>
          </div>
        </div>

        {/* Verified Fact Strip (tabular numerals, zero unverified claims) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 border-b border-white/[0.08] text-xs text-zinc-300">
          <div className="flex items-center gap-2.5">
            <CheckIcon className="size-4 text-brand-400 shrink-0" />
            <span>
              <strong className="text-zinc-100 font-semibold">Plans from $6</strong> (25 credits, one-time payment)
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckIcon className="size-4 text-brand-400 shrink-0" />
            <span className="tabular-nums">
              <strong className="text-zinc-100 font-semibold">2K &amp; True 4K output</strong> (up to 5504×3072 px)
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckIcon className="size-4 text-brand-400 shrink-0" />
            <span>
              <strong className="text-zinc-100 font-semibold">100% credit refund</strong> automatically on any failed job
            </span>
          </div>
        </div>

        {/* Live Product App-Frame Showcase (taste-skill software app-frame rule) */}
        <div className="mt-10 rounded-2xl border border-white/[0.1] bg-[#111317] overflow-hidden">
          {/* App Frame Toolbar */}
          <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0d0f13] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 text-zinc-300 font-medium">
              <SlidersHorizontalIcon className="size-4 text-brand-400" />
              <span>ThumbGen Studio — Output Verification Matrix</span>
            </div>
            <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px] tabular-nums">
              <span>MODES: 4 VERIFIED</span>
              <span className="text-white/20">|</span>
              <span>RATIOS: 16:9 · 9:16 · 1:1 · 4:5</span>
            </div>
          </div>

          {/* 4-Mode Output Grid inside App Frame */}
          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {showcaseSamples.map((item, idx) => (
              <div
                key={idx}
                className="group rounded-xl border border-white/[0.08] bg-[#090a0c] overflow-hidden flex flex-col justify-between"
              >
                <div className="relative aspect-video bg-black overflow-hidden">
                  <img
                    src={item.src}
                    alt={item.title}
                    loading={idx < 2 ? "eager" : "lazy"}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#090a0c]/85 border border-white/[0.12] backdrop-blur-sm text-[11px] font-medium text-zinc-200 flex items-center gap-1.5">
                    <LayersIcon className="size-3 text-brand-400" />
                    <span>{item.mode}</span>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {item.title}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums shrink-0">
                    {item.specs}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
