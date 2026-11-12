"use client";
import { useState, useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import SectionTitle from "../components/SectionTitle";
import logo from "../assets/logo.png";
import { SparklesIcon, CheckCircle2Icon, ArrowUpRightIcon } from "lucide-react";

interface PlatformTreeItem {
  id: string;
  name: string;
  description: string;
  brandColor: string;
  glowColor: string;
  iconSvg: React.ReactNode;
}

const PLATFORM_TREE: PlatformTreeItem[] = [
  {
    id: "youtube",
    name: "YouTube",
    description: "Main Video Feed",
    brandColor: "#FF0000",
    glowColor: "rgba(255, 0, 0, 0.35)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6" fill="#FF0000">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    id: "shorts",
    name: "YouTube Shorts",
    description: "Short-form Feed",
    brandColor: "#FF0000",
    glowColor: "rgba(255, 0, 0, 0.35)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6" fill="#FF0000">
        <path d="M10 15l5.19-3L10 9v6zm11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Explore & Stories",
    brandColor: "#E1306C",
    glowColor: "rgba(225, 48, 108, 0.35)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6">
        <defs>
          <linearGradient id="tree-ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FD5" />
            <stop offset="50%" stopColor="#FF543E" />
            <stop offset="100%" stopColor="#C837AB" />
          </linearGradient>
        </defs>
        <path
          fill="url(#tree-ig-grad)"
          d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"
        />
      </svg>
    ),
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "For You Algorithm",
    brandColor: "#00F2FE",
    glowColor: "rgba(0, 242, 254, 0.35)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6" fill="#00F2FE">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    description: "Timeline Media",
    brandColor: "#FFFFFF",
    glowColor: "rgba(255, 255, 255, 0.25)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Professional Feed",
    brandColor: "#0A66C2",
    glowColor: "rgba(10, 102, 194, 0.35)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Feed & Stories",
    brandColor: "#1877F2",
    glowColor: "rgba(24, 119, 242, 0.35)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: "pinterest",
    name: "Pinterest",
    description: "Visual Discovery",
    brandColor: "#BD081C",
    glowColor: "rgba(189, 8, 28, 0.35)",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="size-6" fill="#BD081C">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" />
      </svg>
    ),
  },
];

export default function PlatformSection() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null);
  const svgId = useId();

  return (
    <section className="relative py-28 border-b border-white/[0.08] bg-[#090a0c] overflow-hidden">
      {/* Background Subtle Ambient Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#1b4974]/20 via-[#2c6da2]/10 to-transparent blur-[120px] pointer-events-none rounded-full" />

      <div className="relative max-w-7xl mx-auto px-6">
        <SectionTitle
          text1="Distribution"
          text2="Multi-Platform Native Ecosystem"
          text3="One master creative asset automatically branches into pixel-perfect formats for every major social network."
        />

        {/* Tree Container Stage */}
        <div className="mt-16 max-w-5xl mx-auto flex flex-col items-center">
          {/* =================================================================
              TRUNK ROOT NODE: ThumbGen AI Core Studio
             ================================================================= */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: -20, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              type: "spring",
              bounce: 0.15,
              duration: 0.5,
            }}
            className="relative z-20 flex flex-col items-center"
          >
            {/* Glowing Root Badge */}
            <div className="group relative flex items-center gap-3.5 px-6 py-3.5 rounded-2xl bg-[#111317] border border-white/[0.14] shadow-[0_0_30px_rgba(44,109,162,0.25)] backdrop-blur-xl">
              <div className="relative size-10 rounded-xl overflow-hidden bg-gradient-to-br from-[#143a61] to-[#2c6da2] p-1 flex items-center justify-center shadow-md">
                <img
                  src={logo}
                  alt="ThumbGen Studio"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white tracking-wide">
                    ThumbGen Core Studio
                  </h3>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-400/30 text-[10px] font-medium text-brand-300">
                    <SparklesIcon className="size-2.5" />
                    <span>Master Asset</span>
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                  Synchronous multi-channel generation engine
                </p>
              </div>

              {/* Pulsing ambient halo */}
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-brand-500/20 via-sky-400/20 to-brand-500/20 -z-10 blur-sm opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Central Vertical Connector Segment */}
            <div className="w-[2px] h-10 bg-gradient-to-b from-brand-400/80 via-brand-500/50 to-white/10" />
          </motion.div>

          {/* =================================================================
              DESKTOP/TABLET BRANCHING TREE (SVG Bezier Network)
             ================================================================= */}
          <div className="relative w-full hidden md:block">
            {/* SVG Connecting Branches */}
            <svg
              className="absolute inset-x-0 -top-2 w-full h-[180px] pointer-events-none z-0"
              viewBox="0 0 1000 180"
              fill="none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`${svgId}-core-pulse`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2c6da2" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#3682bd" stopOpacity="0.3" />
                </linearGradient>

                <linearGradient id={`${svgId}-active-pulse`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Central hub distribution manifold bar */}
              <path
                d="M 120 70 L 880 70"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="2"
              />

              {/* Trunk feed into horizontal bar */}
              <path
                d="M 500 0 L 500 70"
                stroke="rgba(56, 189, 248, 0.45)"
                strokeWidth="2.5"
                strokeDasharray="4 3"
              />

              {/* 8 Distinct Branching Curves to Each Column Leaf */}
              {[
                { x: 120, id: "youtube" },
                { x: 230, id: "shorts" },
                { x: 340, id: "instagram" },
                { x: 450, id: "tiktok" },
                { x: 550, id: "twitter" },
                { x: 660, id: "linkedin" },
                { x: 770, id: "facebook" },
                { x: 880, id: "pinterest" },
              ].map((branch) => {
                const isActive = activePlatformId === branch.id;
                return (
                  <g key={`branch-${branch.id}`}>
                    {/* Background resting guide path */}
                    <path
                      d={`M 500 0 C 500 45, ${branch.x} 35, ${branch.x} 180`}
                      stroke={isActive ? "url(#" + svgId + "-active-pulse)" : "rgba(255, 255, 255, 0.1)"}
                      strokeWidth={isActive ? "3" : "1.5"}
                      strokeDasharray={isActive ? "none" : "3 3"}
                      className="transition-all duration-200"
                    />

                    {/* Animated energy pulse on active hover */}
                    {isActive && (
                      <motion.circle
                        r="3.5"
                        fill="#38bdf8"
                        filter="drop-shadow(0 0 6px #38bdf8)"
                        initial={{ cx: 500, cy: 0 }}
                        animate={{ cx: branch.x, cy: 180 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.1,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Platform Leaf Nodes Grid (4 on row 1, 4 on row 2, or clean responsive grid) */}
            <div className="relative z-10 pt-28 grid grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5">
              {PLATFORM_TREE.map((platform, idx) => {
                const isActive = activePlatformId === platform.id;
                return (
                  <motion.div
                    key={platform.id}
                    initial={
                      prefersReducedMotion
                        ? undefined
                        : { opacity: 0, y: 15, scale: 0.94 }
                    }
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      type: "spring",
                      bounce: 0.14,
                      duration: 0.45,
                      delay: idx * 0.04,
                    }}
                    onMouseEnter={() => setActivePlatformId(platform.id)}
                    onMouseLeave={() => setActivePlatformId(null)}
                    whileHover={
                      prefersReducedMotion
                        ? undefined
                        : { y: -3, scale: 1.03 }
                    }
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    className="group relative cursor-pointer focus:outline-none"
                  >
                    <div
                      className={`relative p-3.5 sm:p-4 rounded-xl border bg-[#111317] flex flex-col items-center text-center justify-between gap-3 transition-all duration-200 shadow-lg ${
                        isActive
                          ? "border-brand-400 bg-[#161a22] shadow-[0_0_24px_rgba(44,109,162,0.3)] -translate-y-1"
                          : "border-white/[0.08] hover:border-white/[0.2] hover:bg-[#15181e]"
                      }`}
                      style={
                        isActive
                          ? {
                              boxShadow: `0 8px 30px ${platform.glowColor}`,
                            }
                          : undefined
                      }
                    >
                      {/* Brand Logo Node Frame */}
                      <div className="relative size-11 rounded-xl bg-[#090a0c] border border-white/[0.1] flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                        {platform.iconSvg}
                        {isActive && (
                          <div
                            className="absolute -inset-1 rounded-xl blur-sm opacity-50 pointer-events-none"
                            style={{ backgroundColor: platform.brandColor }}
                          />
                        )}
                      </div>

                      {/* Platform Identity */}
                      <div className="w-full">
                        <h4 className="text-xs font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
                          {platform.name}
                        </h4>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-medium">
                          {platform.description}
                        </p>
                      </div>

                      {/* Ready indicator */}
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 group-hover:text-brand-300 transition-colors">
                        <CheckCircle2Icon className="size-3 text-emerald-400 shrink-0" />
                        <span>Ready</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* =================================================================
              MOBILE VERTICAL BRANCHING TREE (Spine & Spoke Layout)
             ================================================================= */}
          <div className="relative w-full block md:hidden mt-6 space-y-3">
            {/* Vertical central trunk spine line */}
            <div className="absolute left-6 top-0 bottom-6 w-[2px] bg-gradient-to-b from-brand-400/80 via-white/10 to-transparent pointer-events-none" />

            {PLATFORM_TREE.map((platform, idx) => (
              <motion.div
                key={`mobile-${platform.id}`}
                initial={prefersReducedMotion ? undefined : { opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className="relative pl-12"
              >
                {/* Horizontal spoke connector from vertical spine */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-[1.5px] bg-white/[0.15]" />

                <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#111317] flex items-center justify-between gap-3 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-[#090a0c] border border-white/[0.08] flex items-center justify-center shrink-0">
                      {platform.iconSvg}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-zinc-100 truncate">
                        {platform.name}
                      </h4>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {platform.description}
                      </p>
                    </div>
                  </div>

                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium shrink-0">
                    <CheckCircle2Icon className="size-3" />
                    <span>Auto-Framed</span>
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom Footnote on Native Pipeline */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="mt-12 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111317] border border-white/[0.08] text-xs text-zinc-300"
          >
            <CheckCircle2Icon className="size-3.5 text-brand-400" />
            <span>
              All 8 destination channels dynamically routed with zero manual re-framing
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
