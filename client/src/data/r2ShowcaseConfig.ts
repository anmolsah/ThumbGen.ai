/**
 * data/r2ShowcaseConfig.ts
 *
 * Single source of truth for the 30 Cloudflare R2 Showcase Thumbnails
 * rendered across HeroSection and ShowcaseSection.
 *
 * How to connect your Cloudflare R2 bucket:
 *   1. Set `VITE_R2_PUBLIC_URL=https://pub-<your-hash>.r2.dev` (or your custom R2 domain)
 *      in `client/.env`, OR paste your base URL into `DEFAULT_R2_BASE_URL` below.
 *   2. If your 30 files in R2 use custom filenames instead of `thumb-01.webp`..`thumb-30.webp`,
 *      update the `key` field in `R2_SHOWCASE_30` below (or pass full URLs).
 */

export const DEFAULT_R2_BASE_URL =
  (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined)?.replace(
    /\/+$/,
    ""
  ) || "";

export type ShowcaseCategory =
  | "All"
  | "Photoreal Candid"
  | "Bold & Graphic"
  | "Product Hero"
  | "Tech & Systems"
  | "Minimal Clean";

export interface R2ShowcaseItem {
  id: string;
  index: number; // 1..30
  key: string; // Object key inside Cloudflare R2 bucket (or full https:// URL)
  title: string;
  category: Exclude<ShowcaseCategory, "All">;
  mode: "Fastest 2K" | "Standard 2K" | "Text & Reference" | "Ultra 4K";
  dimensions: string;
  credits: 1 | 2 | 3 | 5;
  accentHex: string;
}

/**
 * Generates a crisp, deterministic darkroom studio SVG fallback data URI
 * when `VITE_R2_PUBLIC_URL` is not yet configured or if an R2 object key is still uploading.
 */
export function buildR2FallbackDataUri(item: R2ShowcaseItem): string {
  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg_${item.index}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#090a0c"/>
        <stop offset="55%" stop-color="#111318"/>
        <stop offset="100%" stop-color="${item.accentHex}28"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg_${item.index})"/>
    <circle cx="980" cy="340" r="240" fill="${item.accentHex}18" stroke="${item.accentHex}55" stroke-width="2"/>
    <rect x="72" y="72" width="240" height="42" rx="8" fill="#171a20" stroke="rgba(255,255,255,0.12)"/>
    <text x="92" y="99" fill="#e4e4e7" font-family="monospace" font-size="18" font-weight="600">R2 #${String(
      item.index
    ).padStart(2, "0")} · ${item.mode}</text>
    <text x="72" y="340" fill="#f4f4f5" font-family="sans-serif" font-size="54" font-weight="800" letter-spacing="-1">${item.title
      .replace(/&/g, "&amp;")
      .slice(0, 28)}</text>
    <text x="72" y="405" fill="#a1a1aa" font-family="monospace" font-size="22">${
      item.category
    } · ${item.dimensions} · ${item.credits} cr</text>
    <rect x="72" y="590" width="420" height="48" rx="8" fill="rgba(9,10,12,0.82)" stroke="rgba(255,255,255,0.1)"/>
    <text x="92" y="620" fill="#a1a1aa" font-family="monospace" font-size="17">Cloudflare R2 Key: ${
      item.key
    }</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolveR2ThumbnailUrl(item: R2ShowcaseItem): string {
  if (item.key.startsWith("http://") || item.key.startsWith("https://")) {
    return item.key;
  }
  if (DEFAULT_R2_BASE_URL) {
    return `${DEFAULT_R2_BASE_URL}/${item.key.replace(/^\/+/, "")}`;
  }
  return buildR2FallbackDataUri(item);
}

export const R2_SHOWCASE_30: R2ShowcaseItem[] = [
  { id: "r2-01", index: 1, key: "thumb-01.webp", title: "Why We Left AWS for Bare Metal", category: "Tech & Systems", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#f43f5e" },
  { id: "r2-02", index: 2, key: "thumb-02.webp", title: "Inside a $40,000 Swiss Chronometer", category: "Product Hero", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#f59e0b" },
  { id: "r2-03", index: 3, key: "thumb-03.webp", title: "100 Hours Debugging Linux Kernel", category: "Photoreal Candid", mode: "Text & Reference", dimensions: "2752×1536", credits: 3, accentHex: "#10b981" },
  { id: "r2-04", index: 4, key: "thumb-04.webp", title: "Stop Buying Gaming Headsets", category: "Bold & Graphic", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#38bdf8" },
  { id: "r2-05", index: 5, key: "thumb-05.webp", title: "The Architecture of High-Speed Trading", category: "Minimal Clean", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#a855f7" },
  { id: "r2-06", index: 6, key: "thumb-06.webp", title: "Leica M11 vs Medium Format Film", category: "Product Hero", mode: "Text & Reference", dimensions: "2752×1536", credits: 3, accentHex: "#f43f5e" },
  { id: "r2-07", index: 7, key: "thumb-07.webp", title: "How Jet Engines Survive 2,000°C", category: "Tech & Systems", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#f97316" },
  { id: "r2-08", index: 8, key: "thumb-08.webp", title: "30 Days With Zero Notifications", category: "Photoreal Candid", mode: "Text & Reference", dimensions: "2752×1536", credits: 3, accentHex: "#14b8a6" },
  { id: "r2-09", index: 9, key: "thumb-09.webp", title: "Why Every EV Battery Degrades", category: "Bold & Graphic", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#eab308" },
  { id: "r2-10", index: 10, key: "thumb-10.webp", title: "Building a 100Gbps Home Lab", category: "Tech & Systems", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#3b82f6" },
  { id: "r2-11", index: 11, key: "thumb-11.webp", title: "The Perfect Espresso Extraction", category: "Product Hero", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#d97706" },
  { id: "r2-12", index: 12, key: "thumb-12.webp", title: "One Notebook System That Works", category: "Minimal Clean", mode: "Fastest 2K", dimensions: "2048×1152", credits: 1, accentHex: "#71717a" },
  { id: "r2-13", index: 13, key: "thumb-13.webp", title: "I Built a CNC Machine From Scrap", category: "Photoreal Candid", mode: "Text & Reference", dimensions: "2752×1536", credits: 3, accentHex: "#ef4444" },
  { id: "r2-14", index: 14, key: "thumb-14.webp", title: "PostgreSQL vs SQLite at 10M Rows", category: "Bold & Graphic", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#0ea5e9" },
  { id: "r2-15", index: 15, key: "thumb-15.webp", title: "Inside Tokyo's Smallest Roastery", category: "Photoreal Candid", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#f59e0b" },
  { id: "r2-16", index: 16, key: "thumb-16.webp", title: "Custom Split Mechanical Keyboard", category: "Product Hero", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#10b981" },
  { id: "r2-17", index: 17, key: "thumb-17.webp", title: "Why Acoustic Panels Fail", category: "Minimal Clean", mode: "Fastest 2K", dimensions: "2048×1152", credits: 1, accentHex: "#6366f1" },
  { id: "r2-18", index: 18, key: "thumb-18.webp", title: "Reverse Engineering a Satellite Modem", category: "Tech & Systems", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#ec4899" },
  { id: "r2-19", index: 19, key: "thumb-19.webp", title: "Forging a Damascus Chef Knife", category: "Product Hero", mode: "Text & Reference", dimensions: "2752×1536", credits: 3, accentHex: "#f97316" },
  { id: "r2-20", index: 20, key: "thumb-20.webp", title: "The Truth About Carbon Running Plates", category: "Bold & Graphic", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#22c55e" },
  { id: "r2-21", index: 21, key: "thumb-21.webp", title: "Solo Sailing Across the North Sea", category: "Photoreal Candid", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#06b6d4" },
  { id: "r2-22", index: 22, key: "thumb-22.webp", title: "Analog Synthesizer Repair Log", category: "Tech & Systems", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#eab308" },
  { id: "r2-23", index: 23, key: "thumb-23.webp", title: "Minimalist Desk Architecture 2026", category: "Minimal Clean", mode: "Standard 2K", dimensions: "2560×1440", credits: 2, accentHex: "#a1a1aa" },
  { id: "r2-24", index: 24, key: "thumb-24.webp", title: "Titanium Field Watch Teardown", category: "Product Hero", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#f43f5e" },
  { id: "r2-25", index: 25, key: "thumb-25.webp", title: "Why Most Startups Burn Seed Cash", category: "Bold & Graphic", mode: "Fastest 2K", dimensions: "2048×1152", credits: 1, accentHex: "#ef4444" },
  { id: "r2-26", index: 26, key: "thumb-26.webp", title: "Restoring a 1968 Braun Turntable", category: "Minimal Clean", mode: "Text & Reference", dimensions: "2752×1536", credits: 3, accentHex: "#f59e0b" },
  { id: "r2-27", index: 27, key: "thumb-27.webp", title: "How Submarine Fiber Cables Are Laid", category: "Tech & Systems", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#38bdf8" },
  { id: "r2-28", index: 28, key: "thumb-28.webp", title: "Cinema Lighting With One Softbox", category: "Photoreal Candid", mode: "Text & Reference", dimensions: "2752×1536", credits: 3, accentHex: "#a855f7" },
  { id: "r2-29", index: 29, key: "thumb-29.webp", title: "Zero-Dependency TypeScript Backend", category: "Bold & Graphic", mode: "Fastest 2K", dimensions: "2048×1152", credits: 1, accentHex: "#10b981" },
  { id: "r2-30", index: 30, key: "thumb-30.webp", title: "Solid State Battery Lab Test", category: "Product Hero", mode: "Ultra 4K", dimensions: "3840×2160", credits: 5, accentHex: "#f43f5e" },
];

