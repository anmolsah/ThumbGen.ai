"use client";
import { useState } from "react";
import SectionTitle from "../components/SectionTitle";
import Marquee from "react-fast-marquee";
import {
  LayoutGridIcon,
  Rows3Icon,
  XIcon,
  LayersIcon,
  Maximize2Icon,
  CheckCircle2Icon,
} from "lucide-react";
import {
  R2_SHOWCASE_30,
  resolveR2ThumbnailUrl,
  buildR2FallbackDataUri,
  type R2ShowcaseItem,
  type ShowcaseCategory,
} from "../data/r2ShowcaseConfig";

const CATEGORIES: ShowcaseCategory[] = [
  "All",
  "Photoreal Candid",
  "Bold & Graphic",
  "Product Hero",
  "Tech & Systems",
  "Minimal Clean",
];

export default function ShowcaseSection() {
  const [viewMode, setViewMode] = useState<"stream" | "matrix">("stream");
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>("All");
  const [selectedItem, setSelectedItem] = useState<R2ShowcaseItem | null>(null);

  const row1 = R2_SHOWCASE_30.slice(0, 15);
  const row2 = R2_SHOWCASE_30.slice(15, 30);

  const filteredMatrix =
    activeCategory === "All"
      ? R2_SHOWCASE_30
      : R2_SHOWCASE_30.filter((item) => item.category === activeCategory);

  const renderThumbnailCard = (
    item: R2ShowcaseItem,
    index: number,
    isMatrix = false
  ) => (
    <button
      key={`${isMatrix ? "matrix" : "stream"}-${item.id}-${index}`}
      type="button"
      onClick={() => setSelectedItem(item)}
      style={
        isMatrix
          ? { animationDelay: `${Math.min(index * 25, 150)}ms` }
          : undefined
      }
      className={`group text-left focus:outline-none ${
        isMatrix
          ? "w-full animate-card-deal hover-lift"
          : "mx-2.5 w-76 sm:w-84 shrink-0 hover-lift"
      }`}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.08] bg-[#111317] transition-colors duration-150 group-hover:border-white/[0.2]">
        <img
          src={resolveR2ThumbnailUrl(item)}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-[1.02]"
          onError={(e) => {
            const img = e.currentTarget;
            const fallback = buildR2FallbackDataUri(item);
            if (img.src !== fallback) {
              img.src = fallback;
            }
          }}
        />

        {/* Top-left index & mode pill */}
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-[#090a0c]/85 border border-white/[0.12] text-[10px] font-mono text-zinc-200 flex items-center gap-1.5 tabular-nums">
          <span className="text-brand-400 font-semibold">
            #{String(item.index).padStart(2, "0")}
          </span>
          <span className="text-white/20">·</span>
          <span>{item.mode}</span>
        </div>

        {/* Hover inspect icon */}
        <div className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-[#090a0c]/85 border border-white/[0.12] text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <Maximize2Icon className="size-3.5" />
        </div>

        {/* Bottom metadata bar */}
        <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-100 truncate">
              {item.title}
            </p>
            <p className="text-[10px] font-mono text-zinc-400 tabular-nums">
              {item.category} · {item.dimensions}
            </p>
          </div>
          <span className="text-[10px] font-mono font-semibold text-brand-300 bg-[#090a0c]/85 border border-white/[0.1] px-1.5 py-0.5 rounded shrink-0 tabular-nums">
            {item.credits} cr
          </span>
        </div>
      </div>
    </button>
  );

  return (
    <section
      id="showcase"
      className="py-24 border-b border-white/[0.08] bg-[#090a0c]"
    >
      <div className="max-w-7xl mx-auto px-6 mb-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <SectionTitle
            text1="Cloudflare R2 Showcase (30 Renders)"
            text2="Unretouched Studio Gallery"
            text3="All 30 production thumbnails served directly from Cloudflare R2 across Photoreal Candid, Bold & Graphic, Product Hero, Tech & Systems, and Minimal Clean."
          />

          {/* View Mode Switcher (Kinetic Stream vs 30-Card Matrix) */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div className="inline-flex rounded-xl bg-[#111317] p-1 border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setViewMode("stream")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  viewMode === "stream"
                    ? "bg-zinc-100 text-zinc-950 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Rows3Icon className="size-3.5" />
                <span>Kinetic Stream (30)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("matrix")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  viewMode === "matrix"
                    ? "bg-zinc-100 text-zinc-950 font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LayoutGridIcon className="size-3.5" />
                <span>Inspect All 30</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Bar when in Matrix Mode */}
        {viewMode === "matrix" && (
          <div className="mt-6 pt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((category) => {
                const isSelected = activeCategory === category;
                const count =
                  category === "All"
                    ? R2_SHOWCASE_30.length
                    : R2_SHOWCASE_30.filter((i) => i.category === category)
                        .length;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums ${
                      isSelected
                        ? "bg-brand-600 text-white font-semibold"
                        : "bg-[#111317] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
                    }`}
                  >
                    {category} ({count})
                  </button>
                );
              })}
            </div>
            <span className="text-xs font-mono text-zinc-400 tabular-nums">
              Showing {filteredMatrix.length} of 30 R2 renders · Click any card to inspect
            </span>
          </div>
        )}
      </div>

      {/* MODE A: Dual-Track 30-Thumbnail Kinetic Stream */}
      {viewMode === "stream" ? (
        <div className="space-y-4">
          <Marquee
            speed={30}
            gradient={true}
            gradientColor="#090a0c"
            gradientWidth={80}
            pauseOnHover={true}
          >
            {row1.map((thumb, index) => renderThumbnailCard(thumb, index, false))}
          </Marquee>

          <Marquee
            speed={30}
            gradient={true}
            gradientColor="#090a0c"
            gradientWidth={80}
            pauseOnHover={true}
            direction="right"
          >
            {row2.map((thumb, index) => renderThumbnailCard(thumb, index, false))}
          </Marquee>
        </div>
      ) : (
        /* MODE B: Full 30-Thumbnail Interactive Choreographed Grid */
        <div
          key={activeCategory}
          className="max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredMatrix.map((thumb, index) =>
            renderThumbnailCard(thumb, index, true)
          )}
        </div>
      )}

      {/* Lightbox Inspector Modal (Emil Kowalski scale(0.95) -> scale(1) cubic-bezier(0.23, 1, 0.32, 1)) */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="animate-modal-pop max-w-4xl w-full rounded-2xl border border-white/[0.12] bg-[#111317] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0d0f13] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs">
                <LayersIcon className="size-4 text-brand-400" />
                <span className="font-mono text-zinc-300 tabular-nums">
                  R2 #{String(selectedItem.index).padStart(2, "0")} ·{" "}
                  {selectedItem.key}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg bg-[#171a20] hover:bg-white/[0.1] text-zinc-300"
                aria-label="Close preview"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="relative aspect-video bg-[#090a0c]">
              <img
                src={resolveR2ThumbnailUrl(selectedItem)}
                alt={selectedItem.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  const fallback = buildR2FallbackDataUri(selectedItem);
                  if (img.src !== fallback) {
                    img.src = fallback;
                  }
                }}
              />
            </div>

            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">
                  {selectedItem.title}
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-1 tabular-nums">
                  Style: {selectedItem.category} · Mode: {selectedItem.mode} ·{" "}
                  {selectedItem.dimensions} ({selectedItem.credits} credits)
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono text-emerald-300 tabular-nums">
                <CheckCircle2Icon className="size-3.5 text-emerald-400" />
                <span>QA Gate Verified · sRGB</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
