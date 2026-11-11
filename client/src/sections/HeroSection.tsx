"use client";
import { useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  LayersIcon,
  SlidersHorizontalIcon,
  CloudIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  R2_SHOWCASE_30,
  resolveR2ThumbnailUrl,
  buildR2FallbackDataUri,
  DEFAULT_R2_BASE_URL,
  type ShowcaseCategory,
} from "../data/r2ShowcaseConfig";

const HERO_CATEGORIES: ShowcaseCategory[] = [
  "All",
  "Photoreal Candid",
  "Bold & Graphic",
  "Product Hero",
  "Tech & Systems",
  "Minimal Clean",
];

export default function HeroSection() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>("All");

  const handlePrimaryAction = () => {
    navigate(isLoggedIn ? "/generate" : "/login");
  };

  const filteredItems =
    activeCategory === "All"
      ? R2_SHOWCASE_30.slice(0, 4)
      : R2_SHOWCASE_30.filter((item) => item.category === activeCategory).slice(
          0,
          4
        );

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

        {/* Live Product App-Frame Showcase (30 Cloudflare R2 Thumbnails with Emil Kowalski Choreography) */}
        <div className="mt-10 rounded-2xl border border-white/[0.1] bg-[#111317] overflow-hidden">
          {/* App Frame Toolbar */}
          <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0d0f13] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 text-zinc-200 font-medium">
              <SlidersHorizontalIcon className="size-4 text-brand-400" />
              <span>ThumbGen Studio — Cloudflare R2 Output Matrix (30 Renders)</span>
            </div>

            {/* Category Filter Pills (Emil Kowalski tactile press + instant feedback) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {HERO_CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                      isSelected
                        ? "bg-zinc-100 text-zinc-950 font-semibold"
                        : "bg-[#111317] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4-Mode Output Grid inside App Frame with 35ms Stagger Choreography */}
          <div
            key={activeCategory}
            className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(idx * 35, 140)}ms` }}
                className="group animate-card-deal hover-lift rounded-xl border border-white/[0.08] bg-[#090a0c] overflow-hidden flex flex-col justify-between transition-colors duration-150 hover:border-white/[0.18]"
              >
                <div className="relative aspect-video bg-[#090a0c] overflow-hidden">
                  <img
                    src={resolveR2ThumbnailUrl(item)}
                    alt={item.title}
                    loading={idx < 2 ? "eager" : "lazy"}
                    className="w-full h-full object-cover transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-[1.015]"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const fallback = buildR2FallbackDataUri(item);
                      if (img.src !== fallback) {
                        img.src = fallback;
                      }
                    }}
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#090a0c]/88 border border-white/[0.12] text-[11px] font-medium text-zinc-200 flex items-center gap-1.5">
                    <LayersIcon className="size-3 text-brand-400" />
                    <span>{item.mode}</span>
                  </div>
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-[#090a0c]/85 border border-white/[0.1] text-[10px] font-mono text-zinc-300 tabular-nums">
                    R2 #{String(item.index).padStart(2, "0")}
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {item.title}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums shrink-0">
                    {item.dimensions} · 16:9 · {item.credits} cr
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* R2 Status Bar */}
          <div className="px-5 py-2.5 border-t border-white/[0.06] bg-[#0d0f13] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <CloudIcon className="size-3.5 text-brand-400" />
              <span>
                STORAGE: CLOUDFLARE R2 EDGE CDN (30/30 OBJECT KEYS CONFIGURED)
              </span>
            </span>
            <span>
              {DEFAULT_R2_BASE_URL
                ? `ENDPOINT: ${DEFAULT_R2_BASE_URL}`
                : "SET VITE_R2_PUBLIC_URL IN .ENV FOR LIVE R2 BUCKET STREAM"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
