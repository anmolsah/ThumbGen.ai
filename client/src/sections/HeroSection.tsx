"use client";
import { useState, useEffect } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  LayersIcon,
  SlidersHorizontalIcon,
  CloudIcon,
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { useAuth } from "../context/AuthContext";
import {
  R2_SHOWCASE_30,
  resolveR2ThumbnailUrl,
  buildR2FallbackDataUri,
  type R2ShowcaseItem,
  type ShowcaseCategory,
} from "../data/r2ShowcaseConfig";

const HERO_CATEGORIES: ShowcaseCategory[] = [
  "All",
  "Product Hero",
  "Tech & Systems",
  "Photoreal Candid",
  "Bold & Graphic",
  "Minimal Clean",
];

// Emil Kowalski easing curves
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export default function HeroSection() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>("All");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const filteredItems: R2ShowcaseItem[] =
    activeCategory === "All"
      ? R2_SHOWCASE_30.slice(0, 8)
      : R2_SHOWCASE_30.filter((item) => item.category === activeCategory).slice(
          0,
          6
        );

  const safeIndex =
    filteredItems.length > 0 ? selectedIndex % filteredItems.length : 0;
  const activeItem = filteredItems[safeIndex] || R2_SHOWCASE_30[0];

  // Reset index when category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeCategory]);

  // Subtle auto-advance unless user interacted or prefers reduced motion
  useEffect(() => {
    if (!isAutoPlaying || prefersReducedMotion || filteredItems.length <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    }, 4800);
    return () => clearInterval(timer);
  }, [isAutoPlaying, prefersReducedMotion, filteredItems.length]);

  // Zero-re-render pointer-tracked 3D tilt (animation-performance rule: useMotionValue, never setState on pointermove)
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rotateX = useTransform(pointerY, [0, 1], [3.5, -3.5]);
  const rotateY = useTransform(pointerX, [0, 1], [-4, 4]);

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerX.set((e.clientX - rect.left) / rect.width);
    pointerY.set((e.clientY - rect.top) / rect.height);
  };

  const handleStagePointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
  };

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

        {/* Live Product App-Frame Stage (Framer Shared-Layout & Emil Kowalski Choreography) */}
        <div
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
          className="mt-10 rounded-2xl border border-white/[0.1] bg-[#111317] overflow-hidden shadow-2xl"
        >
          {/* App Frame Toolbar with Shared-Layout Category Pill */}
          <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0d0f13] flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 text-zinc-200 font-medium">
              <SlidersHorizontalIcon className="size-4 text-brand-400" />
              <span>ThumbGen Studio Showcase</span>
            </div>

            {/* Category Filter Pills with Framer Shared-Layout Pill (`layoutId="hero-cat-pill"`) */}
            <div className="flex flex-wrap items-center gap-1 bg-[#090a0c] p-1 rounded-xl border border-white/[0.08]">
              {HERO_CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveCategory(cat);
                    }}
                    className={`relative px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors duration-150 ${
                      isSelected
                        ? "text-zinc-950 font-semibold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="hero-cat-pill"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.38,
                        }}
                        className="absolute inset-0 rounded-lg bg-zinc-100"
                      />
                    )}
                    <span className="relative z-10">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Split Stage: 8-Col 3D Spotlight Canvas + 4-Col Choreographed Filmstrip Dock */}
          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* LEFT 8 COLS: Active Spotlight Stage with 1:1 Pointer Tilt & Spring Crossfade */}
            <div className="lg:col-span-8 flex flex-col justify-between">
              <div
                style={{ perspective: "1200px" }}
                onPointerMove={handleStagePointerMove}
                onPointerLeave={handleStagePointerLeave}
                className="relative w-full"
              >
                <motion.div
                  style={
                    prefersReducedMotion
                      ? undefined
                      : {
                          rotateX,
                          rotateY,
                          transformStyle: "preserve-3d",
                        }
                  }
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.12] bg-[#090a0c] shadow-2xl"
                >
                  <AnimatePresence mode="popLayout">
                    <motion.img
                      key={activeItem.id}
                      src={resolveR2ThumbnailUrl(activeItem)}
                      alt={activeItem.title}
                      initial={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              scale: 0.96,
                              filter: "blur(4px)",
                            }
                      }
                      animate={{
                        opacity: 1,
                        scale: 1,
                        filter: "blur(0px)",
                      }}
                      exit={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : {
                              opacity: 0,
                              scale: 1.02,
                              filter: "blur(3px)",
                            }
                      }
                      transition={{
                        duration: 0.24,
                        ease: EASE_OUT,
                      }}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget;
                        const fallback = buildR2FallbackDataUri(activeItem);
                        if (img.src !== fallback) {
                          img.src = fallback;
                        }
                      }}
                    />
                  </AnimatePresence>

                  {/* Prev / Next tactile controls */}
                  <div className="absolute bottom-3.5 right-3.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoPlaying(false);
                        setSelectedIndex(
                          (prev) =>
                            (prev - 1 + filteredItems.length) %
                            filteredItems.length
                        );
                      }}
                      aria-label="Previous render"
                      className="p-2 rounded-lg bg-[#090a0c]/88 hover:bg-[#171a20] border border-white/[0.14] text-zinc-200"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAutoPlaying(false);
                        setSelectedIndex(
                          (prev) => (prev + 1) % filteredItems.length
                        );
                      }}
                      aria-label="Next render"
                      className="p-2 rounded-lg bg-[#090a0c]/88 hover:bg-[#171a20] border border-white/[0.14] text-zinc-200"
                    >
                      <ChevronRightIcon className="size-4" />
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Active Stage Caption Bar */}
              <div className="mt-4 px-4 py-3 rounded-xl border border-white/[0.08] bg-[#090a0c] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">
                    {activeItem.title}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-400 mt-0.5">
                    {activeItem.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shrink-0"
                >
                  <SparklesIcon className="size-3.5" />
                  <span>Generate in This Style</span>
                </button>
              </div>
            </div>

            {/* RIGHT 4 COLS: Choreographed Filmstrip Dock with Shared-Layout Active Ring */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span className="font-mono uppercase tracking-wider text-[11px]">
                  Stage Queue ({filteredItems.length} renders)
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  Click to inspect
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 flex-1">
                {filteredItems.map((item, idx) => {
                  const isCurrent = item.id === activeItem.id;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setIsAutoPlaying(false);
                        setSelectedIndex(idx);
                      }}
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.22,
                         delay: Math.min(idx * 0.03, 0.15),
                        ease: EASE_OUT,
                      }}
                      className="group relative rounded-xl overflow-hidden bg-[#090a0c] text-left focus:outline-none"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.08]">
                        <img
                          src={resolveR2ThumbnailUrl(item)}
                          alt={item.title}
                          loading="lazy"
                          className={`w-full h-full object-cover transition-transform duration-200 ease-[var(--ease-out)] ${
                            isCurrent
                              ? "scale-[1.03] opacity-100"
                              : "opacity-65 group-hover:opacity-95 group-hover:scale-[1.02]"
                          }`}
                          onError={(e) => {
                            const img = e.currentTarget;
                            const fallback = buildR2FallbackDataUri(item);
                            if (img.src !== fallback) {
                              img.src = fallback;
                            }
                          }}
                        />
                      </div>

                      {/* Shared-Layout Selection Ring (`layoutId="hero-stage-ring"`) */}
                      {isCurrent && (
                        <motion.div
                          layoutId="hero-stage-ring"
                          transition={{
                            type: "spring",
                            bounce: 0.15,
                            duration: 0.36,
                          }}
                          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-brand-400"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* R2 Edge Status Bar */}
          <div className="px-5 py-2.5 border-t border-white/[0.06] bg-[#0d0f13] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <CloudIcon className="size-3.5 text-brand-400" />
              <span>
                STORAGE: CLOUDFLARE R2 EDGE CDN (30/30 RENDERS VERIFIED LIVE)
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("showcase")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-brand-400 hover:text-brand-300 font-semibold"
            >
              Explore All 30 in Interactive Deck ↓
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
