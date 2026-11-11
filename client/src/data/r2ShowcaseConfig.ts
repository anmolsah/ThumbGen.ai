/**
 * data/r2ShowcaseConfig.ts
 *
 * Single source of truth for the 30 Cloudflare R2 Showcase Thumbnails
 * rendered across HeroSection and ShowcaseSection.
 */

export const DEFAULT_R2_BASE_URL =
  (import.meta.env?.VITE_R2_PUBLIC_URL as string | undefined)?.replace(
    /\/+$/,
    ""
  ) || "https://pub-8ac5b71703ef48afa4b9f02603e3ba50.r2.dev";

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
  key: string; // Exact object key inside Cloudflare R2 bucket `thumbgen`
  title: string;
  category: Exclude<ShowcaseCategory, "All">;
  mode: "Fastest 2K" | "Standard 2K" | "Text & Reference" | "Ultra 4K";
  dimensions: string;
  credits: 1 | 2 | 3 | 5;
  accentHex: string;
}

/**
 * Generates a crisp, deterministic darkroom studio SVG fallback data URI
 * if the client is offline.
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
    <text x="72" y="340" fill="#f4f4f5" font-family="sans-serif" font-size="48" font-weight="800" letter-spacing="-1">${item.title
      .replace(/&/g, "&amp;")
      .slice(0, 32)}</text>
    <text x="72" y="405" fill="#a1a1aa" font-family="monospace" font-size="22">${
      item.category
    } · ${item.dimensions} · ${item.credits} cr</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolveR2ThumbnailUrl(item: R2ShowcaseItem): string {
  if (item.key.startsWith("http://") || item.key.startsWith("https://")) {
    return item.key;
  }
  if (DEFAULT_R2_BASE_URL) {
    const encodedKey = item.key
      .replace(/^\/+/, "")
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${DEFAULT_R2_BASE_URL}/${encodedKey}`;
  }
  return buildR2FallbackDataUri(item);
}

export const R2_SHOWCASE_30: R2ShowcaseItem[] = [
  {
    id: "r2-01",
    index: 1,
    key: "01_[0-200K]_17 Coolest Tech Gadgets That Are Totally Worth Buying in 2026!_45.8K views.jpg",
    title: "17 Coolest Tech Gadgets Worth Buying in 2026",
    category: "Product Hero",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#38bdf8",
  },
  {
    id: "r2-02",
    index: 2,
    key: "02_[0-200K]_Coolest Tech of the Month 🔥 October 2026! Ep. 107_48.4K views.jpg",
    title: "Coolest Tech of the Month — Ep. 107",
    category: "Product Hero",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#f97316",
  },
  {
    id: "r2-03",
    index: 3,
    key: "03_[200K-300K]_My 50 Favorite Tech Gadgets You Can Buy (2025 Ultimate Gift Guide_245.3K views.jpg",
    title: "50 Favorite Tech Gadgets You Can Buy",
    category: "Product Hero",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#10b981",
  },
  {
    id: "r2-04",
    index: 4,
    key: "04_[200K-300K]_20 Cool New Tech That Are Actually Worth Buying!_266.7K views.jpg",
    title: "20 Cool New Tech Actually Worth Buying",
    category: "Product Hero",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#3b82f6",
  },
  {
    id: "r2-05",
    index: 5,
    key: "05_[300K-400K]_40 Genius AI Gadgets on Amazon You Have to See to Believe_398.4K views.jpg",
    title: "40 Genius AI Gadgets You Have to See",
    category: "Tech & Systems",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#f59e0b",
  },
  {
    id: "r2-06",
    index: 6,
    key: "06_[300K-400K]_41 AMAZING Gadgets You Can Actually Buy_305.3K views.jpg",
    title: "41 Amazing Gadgets You Can Actually Buy",
    category: "Product Hero",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#f43f5e",
  },
  {
    id: "r2-07",
    index: 7,
    key: "09_[300K-400K]_A Brief History of The SNAPTRAN Reactor destruction Experiments (_394.1K views.jpg",
    title: "The SNAPTRAN Reactor Experiments Documentary",
    category: "Photoreal Candid",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#eab308",
  },
  {
    id: "r2-08",
    index: 8,
    key: "11_[300K-400K]_The Stern-Gerlach Experiment (ESI College Physics Film Program 19_355.1K views.jpg",
    title: "The Stern-Gerlach Quantum Physics Experiment",
    category: "Minimal Clean",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#38bdf8",
  },
  {
    id: "r2-09",
    index: 9,
    key: "12_[0-200K]_Neutrino Oscillations Explained The Davis Experiment Documentary_24 views.jpg",
    title: "Neutrino Oscillations Explained — Davis Experiment",
    category: "Tech & Systems",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#06b6d4",
  },
  {
    id: "r2-10",
    index: 10,
    key: "16_[0-200K]_5 Claude Skills To Grow Faster Than 99% of People on Social Media_149.1K views.jpg",
    title: "5 AI Workflows to Grow Faster Than 99%",
    category: "Bold & Graphic",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#f97316",
  },
  {
    id: "r2-11",
    index: 11,
    key: "18_[200K-300K]_18 Psychology Tricks to Get Viewers Addicted to Your Videos_262.1K views.jpg",
    title: "18 Psychology Principles for High-Retention Video",
    category: "Bold & Graphic",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#f43f5e",
  },
  {
    id: "r2-12",
    index: 12,
    key: "19_[200K-300K]_If I Started Social Media In 2026, I'd Do This_214.0K views.jpg",
    title: "If I Started Creating in 2026, I'd Do This",
    category: "Photoreal Candid",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#10b981",
  },
  {
    id: "r2-13",
    index: 13,
    key: "20_[300K-400K]_The EXACT System to Blow Up on YouTube in 90 Days_318.5K views.jpg",
    title: "The Exact System to Scale YouTube in 90 Days",
    category: "Bold & Graphic",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#ef4444",
  },
  {
    id: "r2-14",
    index: 14,
    key: "21_[300K-400K]_The New Rules of Social Media (2026)_335.2K views.jpg",
    title: "The New Rules of Creator Distribution (2026)",
    category: "Minimal Clean",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#a1a1aa",
  },
  {
    id: "r2-15",
    index: 15,
    key: "28_[0-200K]_THE TRUTH ABOUT LYING ON YOUR RESUME (JOB GAPS DO IT)_87.6K views.jpg",
    title: "The Truth About Career Gaps on Your Resume",
    category: "Bold & Graphic",
    mode: "Fastest 2K",
    dimensions: "2048×1152",
    credits: 1,
    accentHex: "#eab308",
  },
  {
    id: "r2-16",
    index: 16,
    key: "30_[200K-300K]_Write a Killer Résumé in the AI Era 5 New Rules!_223.6K views.jpg",
    title: "Write a Standout Engineering Resume — 5 New Rules",
    category: "Minimal Clean",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#38bdf8",
  },
  {
    id: "r2-17",
    index: 17,
    key: "31_[200K-300K]_Myth Busting 5 Common Pieces of Advice About Switching Jobs The H_292.8K views.jpg",
    title: "Myth Busting 5 Pieces of Career Advice",
    category: "Photoreal Candid",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#14b8a6",
  },
  {
    id: "r2-18",
    index: 18,
    key: "32_[300K-400K]_The Storytelling Formula That Makes You Unforgettable in Intervie_381.0K views.jpg",
    title: "The Storytelling Formula for Technical Interviews",
    category: "Photoreal Candid",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#f59e0b",
  },
  {
    id: "r2-19",
    index: 19,
    key: "33_[300K-400K]_Ex-Google Recruiter Teaches Resume Masterclass to get FAANG Inter_368.4K views.jpg",
    title: "Ex-Google Recruiter Teaches Resume Masterclass",
    category: "Bold & Graphic",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#3b82f6",
  },
  {
    id: "r2-20",
    index: 20,
    key: "34_[0-200K]_FULL Metal Jacket Breakdown (1987) Ending Explained, True Story, _158.1K views.jpg",
    title: "Full Metal Jacket (1987) Cinematography Breakdown",
    category: "Photoreal Candid",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#f97316",
  },
  {
    id: "r2-21",
    index: 21,
    key: "35_[0-200K]_How Godzilla Minus Zero Humbled Hollywood Again_47.9K views.jpg",
    title: "How Godzilla Minus One Humbled Modern VFX",
    category: "Photoreal Candid",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#0ea5e9",
  },
  {
    id: "r2-22",
    index: 22,
    key: "37_[200K-300K]_CHILDREN OF MEN (2006) Breakdown Film Analysis, Ending Explained,_276.2K views.jpg",
    title: "Children of Men (2006) Long-Take Film Analysis",
    category: "Photoreal Candid",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#10b981",
  },
  {
    id: "r2-23",
    index: 23,
    key: "38_[300K-400K]_Get Out Breakdown How Every Detail Was Foreshadowing_392.8K views.jpg",
    title: "Get Out — How Every Frame Was Foreshadowing",
    category: "Minimal Clean",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#f43f5e",
  },
  {
    id: "r2-24",
    index: 24,
    key: "41_[0-200K]_How To Master Any Skill Fast (Give Yourself 2 Weeks)_182.4K views.jpg",
    title: "How to Master Any Technical Skill in 2 Weeks",
    category: "Minimal Clean",
    mode: "Fastest 2K",
    dimensions: "2048×1152",
    credits: 1,
    accentHex: "#22c55e",
  },
  {
    id: "r2-25",
    index: 25,
    key: "42_[200K-300K]_25 Skills to Learn Before you're 25_211.9K views.jpg",
    title: "25 High-Leverage Skills to Learn Early",
    category: "Minimal Clean",
    mode: "Fastest 2K",
    dimensions: "2048×1152",
    credits: 1,
    accentHex: "#38bdf8",
  },
  {
    id: "r2-26",
    index: 26,
    key: "46_[0-200K]_7 GitHub Repos the FBI Wishes It Could Ban (2026)_163.7K views.jpg",
    title: "7 Open-Source GitHub Repos Every Engineer Should Know",
    category: "Tech & Systems",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#10b981",
  },
  {
    id: "r2-27",
    index: 27,
    key: "47_[0-200K]_understand ANY programming project (from an open source maintaine_144.4K views.jpg",
    title: "Understand Any Codebase — Maintainer's Guide",
    category: "Tech & Systems",
    mode: "Standard 2K",
    dimensions: "2560×1440",
    credits: 2,
    accentHex: "#3b82f6",
  },
  {
    id: "r2-28",
    index: 28,
    key: "49_[200K-300K]_Reverse Engineer Anything (REA) Explained The Software Industry W_256.9K views.jpg",
    title: "Reverse Engineering Systems Architecture Explained",
    category: "Tech & Systems",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#f43f5e",
  },
  {
    id: "r2-29",
    index: 29,
    key: "50_[300K-400K]_Google's Git Killer Is INSANELY Better (and it's open source)_326.2K views.jpg",
    title: "Next-Gen Open-Source Version Control Workflow",
    category: "Tech & Systems",
    mode: "Text & Reference",
    dimensions: "2752×1536",
    credits: 3,
    accentHex: "#f59e0b",
  },
  {
    id: "r2-30",
    index: 30,
    key: "56_[300K-400K]_Coding Interviews in 2026_358.1K views.jpg",
    title: "Systems & Coding Interviews in 2026",
    category: "Tech & Systems",
    mode: "Ultra 4K",
    dimensions: "3840×2160",
    credits: 5,
    accentHex: "#38bdf8",
  },
];
