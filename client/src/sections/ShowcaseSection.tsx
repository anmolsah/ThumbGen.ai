"use client";
import { useState, useEffect } from "react";
import SectionTitle from "../components/SectionTitle";
import Marquee from "react-fast-marquee";
import {
  LayoutGridIcon,
  Rows3Icon,
  LayersIcon,
  XIcon,
  Maximize2Icon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HandIcon,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "motion/react";
import {
  R2_SHOWCASE_ITEMS,
  resolveR2ThumbnailUrl,
  buildR2FallbackDataUri,
  type R2ShowcaseItem,
  type ShowcaseCategory,
} from "../data/r2ShowcaseConfig";
import api from "../configs/api";

const CATEGORIES: ShowcaseCategory[] = [
  "All",
  "Product Hero",
  "Tech & Systems",
  "Photoreal Candid",
  "Bold & Graphic",
  "Minimal Clean",
];

type ShowcaseViewMode = "deck" | "stream" | "matrix";

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * GPU-composited 3D Magnetic Tilt Card (animation-performance rule:
 * uses useMotionValue + useTransform directly on transform, zero React state re-renders per frame).
 */
function MagneticGridCard({
  item,
  index,
  onSelect,
  prefersReducedMotion,
}: {
  item: R2ShowcaseItem;
  index: number;
  onSelect: (item: R2ShowcaseItem) => void;
  prefersReducedMotion: boolean;
}) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useTransform(py, [0, 1], [4, -4]);
  const rotateY = useTransform(px, [0, 1], [-4.5, 4.5]);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };

  const handlePointerLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      layout
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.94, y: 10 }
      }
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.95, transition: { duration: 0.14 } }
      }
      transition={{
        layout: { type: "spring", bounce: 0.12, duration: 0.42 },
        opacity: {
          duration: 0.22,
          delay: Math.min(index * 0.025, 0.15),
          ease: EASE_OUT,
        },
        scale: {
          duration: 0.24,
          delay: Math.min(index * 0.025, 0.15),
          ease: EASE_OUT,
        },
        y: {
          duration: 0.24,
          delay: Math.min(index * 0.025, 0.15),
          ease: EASE_OUT,
        },
      }}
      style={{ perspective: "1000px" }}
    >
      <motion.button
        type="button"
        onClick={() => onSelect(item)}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={
          prefersReducedMotion
            ? undefined
            : {
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
              }
        }
        whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
        className="group w-full text-left focus:outline-none"
      >
        <div className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.08] bg-[#111317] transition-colors duration-150 group-hover:border-white/[0.22] shadow-lg">
          <img
            src={resolveR2ThumbnailUrl(item)}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-[1.025]"
            onError={(e) => {
              const img = e.currentTarget;
              const fallback = buildR2FallbackDataUri(item);
              if (img.src !== fallback) {
                img.src = fallback;
              }
            }}
          />

          {/* Hover inspect icon */}
          <div className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-[#090a0c]/88 border border-white/[0.12] text-zinc-200 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <Maximize2Icon className="size-3.5" />
          </div>
        </div>
        <div className="mt-2.5 px-1 flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
            {item.title}
          </p>
          <span className="text-[11px] text-zinc-500 shrink-0 ml-2">
            {item.category}
          </span>
        </div>
      </motion.button>
    </motion.div>
  );
}

export default function ShowcaseSection() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [viewMode, setViewMode] = useState<ShowcaseViewMode>("deck");
  const [showcaseItems, setShowcaseItems] = useState<R2ShowcaseItem[]>(R2_SHOWCASE_ITEMS);
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>("All");
  const [deckIndex, setDeckIndex] = useState(0);
  const [hoveredStreamId, setHoveredStreamId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<R2ShowcaseItem | null>(null);

  // Sync dynamically with Cloudflare R2 bucket objects via server showcase endpoint
  useEffect(() => {
    let isMounted = true;
    api
      .get("/api/thumbnail/showcase")
      .then((res) => {
        if (
          isMounted &&
          Array.isArray(res.data?.thumbnails) &&
          res.data.thumbnails.length > 0
        ) {
          // Strictly ensure only Cloudflare R2 bucket items are loaded (never database images)
          const r2ItemsOnly = res.data.thumbnails.filter(
            (t: any) =>
              t &&
              typeof t === "object" &&
              (t.key || (t.url && t.url.includes("r2.dev")))
          );
          if (r2ItemsOnly.length > 0) {
            setShowcaseItems(r2ItemsOnly);
          }
        }
      })
      .catch(() => {
        // Keeps R2_SHOWCASE_ITEMS fallback
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const half = Math.ceil(showcaseItems.length / 2);
  const row1 = showcaseItems.slice(0, half);
  const row2 = showcaseItems.slice(half);

  const filteredMatrix =
    activeCategory === "All"
      ? showcaseItems
      : showcaseItems.filter((item) => item.category === activeCategory);

  const totalDeck = showcaseItems.length;
  const activeDeckItem = showcaseItems[deckIndex] || showcaseItems[0];

  const stepDeck = (delta: number) => {
    setDeckIndex((prev) => (prev + delta + totalDeck) % totalDeck);
  };

  // Keyboard navigation for Lightbox & Fanned Deck
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedItem) {
        if (e.key === "Escape") {
          setSelectedItem(null);
        } else if (e.key === "ArrowRight") {
          const nextIdx = selectedItem.index % showcaseItems.length;
          setSelectedItem(showcaseItems[nextIdx]);
        } else if (e.key === "ArrowLeft") {
          const prevIdx =
            (selectedItem.index - 2 + showcaseItems.length) %
            showcaseItems.length;
          setSelectedItem(showcaseItems[prevIdx]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem, showcaseItems]);

  // Compute circular signed offset for Fanned Deck cards
  const getSignedOffset = (idx: number): number => {
    let diff = idx - deckIndex;
    if (diff > totalDeck / 2) diff -= totalDeck;
    if (diff < -totalDeck / 2) diff += totalDeck;
    return diff;
  };

  const renderStreamCard = (item: R2ShowcaseItem, index: number) => {
    const isDimmed = hoveredStreamId !== null && hoveredStreamId !== item.id;
    return (
      <button
        key={`stream-${item.id}-${index}`}
        type="button"
        onClick={() => setSelectedItem(item)}
        onMouseEnter={() => setHoveredStreamId(item.id)}
        onMouseLeave={() => setHoveredStreamId(null)}
        className={`mx-2.5 w-76 sm:w-84 shrink-0 group text-left focus:outline-none transition-all duration-200 ease-[var(--ease-out)] ${
          isDimmed ? "opacity-45 scale-[0.98]" : "opacity-100 hover:-translate-y-1"
        }`}
      >
        <div className="relative aspect-video rounded-xl overflow-hidden border border-white/[0.08] bg-[#111317] transition-colors duration-150 group-hover:border-brand-400/50 shadow-lg">
          <img
            src={resolveR2ThumbnailUrl(item)}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-200 ease-[var(--ease-out)] group-hover:scale-[1.03]"
            onError={(e) => {
              const img = e.currentTarget;
              const fallback = buildR2FallbackDataUri(item);
              if (img.src !== fallback) {
                img.src = fallback;
              }
            }}
          />
        </div>
        <div className="mt-2 px-1 flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-200 truncate">
            {item.title}
          </p>
          <span className="text-[11px] text-zinc-500 shrink-0 ml-2">
            {item.category}
          </span>
        </div>
      </button>
    );
  };

  return (
    <section
      id="showcase"
      className="py-24 border-b border-white/[0.08] bg-[#090a0c] overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 mb-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <SectionTitle
            text1="Showcase"
            text2="Interactive Studio Gallery"
            text3="Explore studio-crafted production thumbnails across every major content format. Flick through the Fanned Deck, watch the Kinetic Stream, or filter the Bento Matrix."
          />

          {/* 3-Way View Mode Switcher with Shared-Layout Pill (`layoutId="showcase-mode-pill"`) */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div className="inline-flex rounded-xl bg-[#111317] p-1 border border-white/[0.08]">
              {(
                [
                  {
                    id: "deck",
                    label: "Fanned Deck",
                    icon: LayersIcon,
                  },
                  {
                    id: "stream",
                    label: "Kinetic Stream",
                    icon: Rows3Icon,
                  },
                  {
                    id: "matrix",
                    label: "Bento Matrix",
                    icon: LayoutGridIcon,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isSelected = viewMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewMode(tab.id)}
                    className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                      isSelected
                        ? "text-zinc-950 font-semibold"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="showcase-mode-pill"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.38,
                        }}
                        className="absolute inset-0 rounded-lg bg-zinc-100"
                      />
                    )}
                    <Icon className="relative z-10 size-3.5" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODE 1: FANNED PHYSICS DECK + 30-SLOT FILMSTRIP DOCK (gestures + apple-design)
         ===================================================================== */}
      {viewMode === "deck" && (
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          {/* Interactive Fanned Card Stage */}
          <div className="relative h-[300px] sm:h-[420px] lg:h-[470px] flex items-center justify-center select-none">
            {showcaseItems.map((item, idx) => {
              const offset = getSignedOffset(idx);
              if (Math.abs(offset) > 2) return null;

              const isCenter = offset === 0;
              const absOffset = Math.abs(offset);

              return (
                <motion.div
                  key={item.id}
                  drag={isCenter ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={(_e, info) => {
                    // Dismiss/advance on distance OR velocity (gestures skill rule)
                    if (info.offset.x < -60 || info.velocity.x < -380) {
                      stepDeck(1);
                    } else if (info.offset.x > 60 || info.velocity.x > 380) {
                      stepDeck(-1);
                    }
                  }}
                  onClick={() => {
                    if (isCenter) {
                      setSelectedItem(item);
                    } else {
                      setDeckIndex(idx);
                    }
                  }}
                  animate={{
                    x: prefersReducedMotion ? offset * 40 : offset * 175,
                    y: absOffset * 14,
                    scale: 1 - absOffset * 0.085,
                    rotateZ: prefersReducedMotion ? 0 : offset * 3.2,
                    opacity: 1 - absOffset * 0.28,
                    zIndex: 30 - absOffset * 10,
                  }}
                  transition={{
                    type: "spring",
                    bounce: 0.14,
                    duration: 0.46,
                  }}
                  className={`absolute w-[88%] sm:w-[68%] lg:w-[640px] aspect-video rounded-2xl overflow-hidden border bg-[#111317] shadow-2xl ${
                    isCenter
                      ? "cursor-grab active:cursor-grabbing border-white/[0.2]"
                      : "cursor-pointer border-white/[0.08]"
                  }`}
                >
                  <img
                    src={resolveR2ThumbnailUrl(item)}
                    alt={item.title}
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none select-none"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const fallback = buildR2FallbackDataUri(item);
                      if (img.src !== fallback) {
                        img.src = fallback;
                      }
                    }}
                  />

                  {isCenter && (
                    <div className="absolute top-3.5 right-3.5 px-2.5 py-1 rounded-lg bg-[#090a0c]/88 border border-white/[0.14] text-[11px] font-mono text-zinc-300 hidden sm:flex items-center gap-1.5">
                      <HandIcon className="size-3 text-brand-400" />
                      <span>Drag or Click to Inspect</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Deck Controls + Active Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-xl border border-white/[0.08] bg-[#111317]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepDeck(-1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#090a0c] hover:bg-[#171a20] border border-white/[0.1] text-xs font-medium text-zinc-200"
              >
                <ChevronLeftIcon className="size-4" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={() => stepDeck(1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#090a0c] hover:bg-[#171a20] border border-white/[0.1] text-xs font-medium text-zinc-200"
              >
                <span>Next</span>
                <ChevronRightIcon className="size-4" />
              </button>
            </div>

            <div className="text-xs font-medium text-zinc-200 truncate max-w-xs sm:max-w-md">
              {activeDeckItem?.title || "Showcase Thumbnail"}
            </div>

            <button
              type="button"
              onClick={() => setSelectedItem(activeDeckItem)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold"
            >
              <Maximize2Icon className="size-3.5" />
              <span>Full-Res Lightbox</span>
            </button>
          </div>

          {/* Interactive Filmstrip Dock Scrubber */}
          <div className="space-y-2">
            <div className="flex overflow-x-auto pb-2 gap-1.5 p-2.5 rounded-xl border border-white/[0.08] bg-[#111317] scrollbar-thin">
              {showcaseItems.map((item, idx) => {
                const isSelected = idx === deckIndex;
                return (
                  <button
                    key={`dock-${item.id}`}
                    type="button"
                    onClick={() => setDeckIndex(idx)}
                    onMouseEnter={() => setDeckIndex(idx)}
                    title={`#${String(item.index).padStart(2, "0")} — ${item.title}`}
                    className="relative shrink-0 w-14 sm:w-16 aspect-video rounded-md overflow-hidden bg-[#090a0c] focus:outline-none"
                  >
                    <img
                      src={resolveR2ThumbnailUrl(item)}
                      alt={item.title}
                      loading="lazy"
                      className={`w-full h-full object-cover transition-opacity duration-150 ${
                        isSelected
                          ? "opacity-100 scale-105"
                          : "opacity-45 hover:opacity-90"
                      }`}
                      onError={(e) => {
                        const img = e.currentTarget;
                        const fallback = buildR2FallbackDataUri(item);
                        if (img.src !== fallback) {
                          img.src = fallback;
                        }
                      }}
                    />
                    {isSelected && (
                      <motion.div
                        layoutId="deck-dock-ring"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.32,
                        }}
                        className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-brand-400"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE 2: DUAL-TRACK KINETIC STREAM WITH FOCUS DIMMING
         ===================================================================== */}
      {viewMode === "stream" && (
        <div className="space-y-4">
          <Marquee
            speed={30}
            gradient={true}
            gradientColor="#090a0c"
            gradientWidth={80}
            pauseOnHover={true}
          >
            {row1.map((thumb, index) => renderStreamCard(thumb, index))}
          </Marquee>

          <Marquee
            speed={30}
            gradient={true}
            gradientColor="#090a0c"
            gradientWidth={80}
            pauseOnHover={true}
            direction="right"
          >
            {row2.map((thumb, index) => renderStreamCard(thumb, index))}
          </Marquee>
        </div>
      )}

      {/* =====================================================================
          MODE 3: CHOREOGRAPHED 30-RENDER BENTO MATRIX (choreograph + animate)
         ===================================================================== */}
      {viewMode === "matrix" && (
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          {/* Category Filter Bar with Shared-Layout Pill */}
          <div className="pt-2 pb-4 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((category) => {
                const isSelected = activeCategory === category;
                const count =
                  category === "All"
                    ? showcaseItems.length
                    : showcaseItems.filter((i) => i.category === category)
                        .length;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors duration-150 ${
                      isSelected
                        ? "text-white font-semibold"
                        : "bg-[#111317] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="matrix-cat-pill"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.36,
                        }}
                        className="absolute inset-0 rounded-lg bg-brand-600"
                      />
                    )}
                    <span className="relative z-10">
                      {category} ({count})
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-zinc-400">
              Click any thumbnail to inspect in full resolution
            </span>
          </div>

          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <AnimatePresence mode="popLayout">
              {filteredMatrix.map((thumb, index) => (
                <MagneticGridCard
                  key={thumb.id}
                  item={thumb}
                  index={index}
                  onSelect={setSelectedItem}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* =====================================================================
          SPRING LIGHTBOX INSPECTOR MODAL (Drag-to-Dismiss + Keyboard Scrubbing)
         ===================================================================== */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="fixed inset-0 z-50 bg-black/82 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (
                  Math.abs(info.offset.y) > 90 ||
                  Math.abs(info.velocity.y) > 500
                ) {
                  setSelectedItem(null);
                }
              }}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{
                type: "spring",
                bounce: 0.12,
                duration: 0.34,
              }}
              className="max-w-4xl w-full rounded-2xl border border-white/[0.14] bg-[#111317] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0d0f13] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 text-xs">
                  <LayersIcon className="size-4 text-brand-400" />
                  <span className="text-zinc-200 font-medium truncate max-w-sm">
                    {selectedItem.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const prevIdx =
                        (selectedItem.index - 2 + showcaseItems.length) %
                        showcaseItems.length;
                      setSelectedItem(showcaseItems[prevIdx]);
                    }}
                    className="p-1.5 rounded-lg bg-[#171a20] hover:bg-white/[0.1] text-zinc-300"
                    aria-label="Previous thumbnail"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx =
                        selectedItem.index % showcaseItems.length;
                      setSelectedItem(showcaseItems[nextIdx]);
                    }}
                    className="p-1.5 rounded-lg bg-[#171a20] hover:bg-white/[0.1] text-zinc-300"
                    aria-label="Next thumbnail"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 rounded-lg bg-[#171a20] hover:bg-white/[0.1] text-zinc-300 ml-1"
                    aria-label="Close preview"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              </div>

              <div className="relative aspect-video bg-[#090a0c]">
                <AnimatePresence mode="popLayout">
                  <motion.img
                    key={selectedItem.id}
                    src={resolveR2ThumbnailUrl(selectedItem)}
                    alt={selectedItem.title}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const fallback = buildR2FallbackDataUri(selectedItem);
                      if (img.src !== fallback) {
                        img.src = fallback;
                      }
                    }}
                  />
                </AnimatePresence>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    {selectedItem.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {selectedItem.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#171a20] hover:bg-[#20242c] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
