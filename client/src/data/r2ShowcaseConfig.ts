/**
 * data/r2ShowcaseConfig.ts
 *
 * Single source of truth for Cloudflare R2 Showcase Thumbnails
 * rendered across HeroSection and ShowcaseSection.
 * Dynamically synchronized with Cloudflare R2 bucket objects.
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
  index: number;
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
 * if the client is offline or an asset fails to load.
 */
export function buildR2FallbackDataUri(
  item?: (Partial<R2ShowcaseItem> & { url?: string; image_url?: string }) | null
): string {
  if (!item) return "";
  const index = item.index ?? 1;
  const accentHex = item.accentHex || "#38bdf8";
  const title = (item.title || "Showcase Thumbnail")
    .replace(/&/g, "&amp;")
    .slice(0, 32);
  const category = item.category || "Tech & Systems";
  const dimensions = item.dimensions || "1280×720";
  const credits = item.credits ?? 2;

  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg_${index}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#090a0c"/>
        <stop offset="55%" stop-color="#111318"/>
        <stop offset="100%" stop-color="${accentHex}28"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg_${index})"/>
    <circle cx="980" cy="340" r="240" fill="${accentHex}18" stroke="${accentHex}55" stroke-width="2"/>
    <text x="72" y="340" fill="#f4f4f5" font-family="sans-serif" font-size="48" font-weight="800" letter-spacing="-1">${title}</text>
    <text x="72" y="405" fill="#a1a1aa" font-family="monospace" font-size="22">${category} · ${dimensions} · ${credits} cr</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolves public Cloudflare R2 Edge CDN URL from item key or direct url.
 * Handles missing key, direct URLs, Mongo image_url, and offline fallbacks safely.
 */
export function resolveR2ThumbnailUrl(
  item?: (Partial<R2ShowcaseItem> & { url?: string; image_url?: string }) | null
): string {
  if (!item) return "";

  // 1. Direct URL (from server API url or Mongo image_url)
  const directUrl = (item.url || item.image_url || "").trim();
  if (
    directUrl.startsWith("http://") ||
    directUrl.startsWith("https://") ||
    directUrl.startsWith("data:")
  ) {
    return directUrl;
  }

  // 2. Object key that is already an absolute URL
  const rawKey = (item.key || directUrl || "").trim();
  if (
    rawKey.startsWith("http://") ||
    rawKey.startsWith("https://") ||
    rawKey.startsWith("data:")
  ) {
    return rawKey;
  }

  // 3. Object key relative to Cloudflare R2 bucket
  if (rawKey && DEFAULT_R2_BASE_URL) {
    const encodedKey = rawKey
      .replace(/^\/+/, "")
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${DEFAULT_R2_BASE_URL}/${encodedKey}`;
  }

  if (directUrl) return directUrl;

  try {
    return buildR2FallbackDataUri(item);
  } catch {
    return "";
  }
}

export const R2_SHOWCASE_ITEMS: R2ShowcaseItem[] = [
  {
    "id": "r2-01",
    "index": 1,
    "key": "01_[0-200K]_17 Coolest Tech Gadgets That Are Totally Worth Buying in 2026!_45.8K views.jpg",
    "title": "17 Coolest Tech Gadgets Worth Buying in 2026",
    "category": "Product Hero",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#38bdf8"
  },
  {
    "id": "r2-02",
    "index": 2,
    "key": "02_[0-200K]_Coolest Tech of the Month 🔥 October 2026! Ep. 107_48.4K views.jpg",
    "title": "Coolest Tech of the Month — Ep. 107",
    "category": "Product Hero",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#f97316"
  },
  {
    "id": "r2-03",
    "index": 3,
    "key": "03_[200K-300K]_My 50 Favorite Tech Gadgets You Can Buy (2025 Ultimate Gift Guide_245.3K views.jpg",
    "title": "50 Favorite Tech Gadgets You Can Buy",
    "category": "Product Hero",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#10b981"
  },
  {
    "id": "r2-04",
    "index": 4,
    "key": "04_[200K-300K]_20 Cool New Tech That Are Actually Worth Buying!_266.7K views.jpg",
    "title": "20 Cool New Tech Actually Worth Buying",
    "category": "Product Hero",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#3b82f6"
  },
  {
    "id": "r2-05",
    "index": 5,
    "key": "05_[300K-400K]_40 Genius AI Gadgets on Amazon You Have to See to Believe_398.4K views.jpg",
    "title": "40 Genius AI Gadgets You Have to See",
    "category": "Tech & Systems",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#f59e0b"
  },
  {
    "id": "r2-06",
    "index": 6,
    "key": "06_[300K-400K]_41 AMAZING Gadgets You Can Actually Buy_305.3K views.jpg",
    "title": "41 Amazing Gadgets You Can Actually Buy",
    "category": "Product Hero",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#f43f5e"
  },
  {
    "id": "r2-07",
    "index": 7,
    "key": "07_[0-200K]_The Sinister Experiments of Heinrich Himmler's Secret SS Scientis_18.4K views.jpg",
    "title": "The Secret SS Science Experiments Documentary",
    "category": "Photoreal Candid",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#ef4444"
  },
  {
    "id": "r2-08",
    "index": 8,
    "key": "08_[0-200K]_The Sinister Experiments of Nazi Germany’s Ahnenerbe FULL DOCUMEN_62.2K views.jpg",
    "title": "The Ahnenerbe Experiments — Full Documentary",
    "category": "Photoreal Candid",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#eab308"
  },
  {
    "id": "r2-09",
    "index": 9,
    "key": "09_[300K-400K]_A Brief History of The SNAPTRAN Reactor destruction Experiments (_394.1K views.jpg",
    "title": "The SNAPTRAN Reactor Experiments Documentary",
    "category": "Photoreal Candid",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#f59e0b"
  },
  {
    "id": "r2-10",
    "index": 10,
    "key": "10_[300K-400K]_The Dark side of Science The Baby Cliff Experiment 1960 Short Doc_399.5K views.jpg",
    "title": "The 1960 Visual Cliff Science Experiment",
    "category": "Photoreal Candid",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#06b6d4"
  },
  {
    "id": "r2-11",
    "index": 11,
    "key": "11_[300K-400K]_The Stern-Gerlach Experiment (ESI College Physics Film Program 19_355.1K views.jpg",
    "title": "The Stern-Gerlach Quantum Physics Experiment",
    "category": "Minimal Clean",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#38bdf8"
  },
  {
    "id": "r2-12",
    "index": 12,
    "key": "12_[0-200K]_Neutrino Oscillations Explained The Davis Experiment Documentary_24 views.jpg",
    "title": "Neutrino Oscillations Explained — Davis Experiment",
    "category": "Tech & Systems",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#06b6d4"
  },
  {
    "id": "r2-13",
    "index": 13,
    "key": "16_[0-200K]_5 Claude Skills To Grow Faster Than 99% of People on Social Media_149.1K views.jpg",
    "title": "5 AI Workflows to Grow Faster Than 99%",
    "category": "Bold & Graphic",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#f97316"
  },
  {
    "id": "r2-14",
    "index": 14,
    "key": "17_[0-200K]_YouTube Growth Tips w PK Adventure Travels Ideas, Editing Tools &_71 views.jpg",
    "title": "YouTube Growth Secrets: Editing & Strategy Tools",
    "category": "Bold & Graphic",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#10b981"
  },
  {
    "id": "r2-15",
    "index": 15,
    "key": "18_[200K-300K]_18 Psychology Tricks to Get Viewers Addicted to Your Videos_262.1K views.jpg",
    "title": "18 Psychology Principles for High-Retention Video",
    "category": "Bold & Graphic",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#f43f5e"
  },
  {
    "id": "r2-16",
    "index": 16,
    "key": "19_[200K-300K]_If I Started Social Media In 2026, I'd Do This_214.0K views.jpg",
    "title": "If I Started Creating in 2026, I'd Do This",
    "category": "Photoreal Candid",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#10b981"
  },
  {
    "id": "r2-17",
    "index": 17,
    "key": "20_[300K-400K]_The EXACT System to Blow Up on YouTube in 90 Days_318.5K views.jpg",
    "title": "The Exact System to Scale YouTube in 90 Days",
    "category": "Bold & Graphic",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#ef4444"
  },
  {
    "id": "r2-18",
    "index": 18,
    "key": "21_[300K-400K]_The New Rules of Social Media (2026)_335.2K views.jpg",
    "title": "The New Rules of Creator Distribution (2026)",
    "category": "Minimal Clean",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#a1a1aa"
  },
  {
    "id": "r2-19",
    "index": 19,
    "key": "28_[0-200K]_THE TRUTH ABOUT LYING ON YOUR RESUME (JOB GAPS DO IT)_87.6K views.jpg",
    "title": "The Truth About Career Gaps on Your Resume",
    "category": "Bold & Graphic",
    "mode": "Fastest 2K",
    "dimensions": "2048×1152",
    "credits": 1,
    "accentHex": "#eab308"
  },
  {
    "id": "r2-20",
    "index": 20,
    "key": "29_[0-200K]_How to Prove Your Job Skills on a Resume and in Interviews Indeed_1.5K views.jpg",
    "title": "How to Prove Job Skills in Engineering Interviews",
    "category": "Minimal Clean",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#38bdf8"
  },
  {
    "id": "r2-21",
    "index": 21,
    "key": "30_[200K-300K]_Write a Killer Résumé in the AI Era 5 New Rules!_223.6K views.jpg",
    "title": "Write a Standout Resume in the AI Era",
    "category": "Minimal Clean",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#38bdf8"
  },
  {
    "id": "r2-22",
    "index": 22,
    "key": "31_[200K-300K]_Myth Busting 5 Common Pieces of Advice About Switching Jobs The H_292.8K views.jpg",
    "title": "Myth Busting 5 Pieces of Career Advice",
    "category": "Photoreal Candid",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#14b8a6"
  },
  {
    "id": "r2-23",
    "index": 23,
    "key": "32_[300K-400K]_The Storytelling Formula That Makes You Unforgettable in Intervie_381.0K views.jpg",
    "title": "The Storytelling Formula for Technical Interviews",
    "category": "Photoreal Candid",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#f59e0b"
  },
  {
    "id": "r2-24",
    "index": 24,
    "key": "33_[300K-400K]_Ex-Google Recruiter Teaches Resume Masterclass to get FAANG Inter_368.4K views.jpg",
    "title": "Ex-Google Recruiter Teaches Resume Masterclass",
    "category": "Bold & Graphic",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#3b82f6"
  },
  {
    "id": "r2-25",
    "index": 25,
    "key": "34_[0-200K]_FULL Metal Jacket Breakdown (1987) Ending Explained, True Story, _158.1K views.jpg",
    "title": "Full Metal Jacket (1987) Cinematography Breakdown",
    "category": "Photoreal Candid",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#f97316"
  },
  {
    "id": "r2-26",
    "index": 26,
    "key": "35_[0-200K]_How Godzilla Minus Zero Humbled Hollywood Again_47.9K views.jpg",
    "title": "How Godzilla Minus One Humbled Modern VFX",
    "category": "Photoreal Candid",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#0ea5e9"
  },
  {
    "id": "r2-27",
    "index": 27,
    "key": "36_[200K-300K]_PSYCHO (1960) Breakdown Film Analysis, Easter Eggs, Making Of & E_204.2K views.jpg",
    "title": "Psycho (1960) Masterclass: Visual Suspense & Framing",
    "category": "Photoreal Candid",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#e11d48"
  },
  {
    "id": "r2-28",
    "index": 28,
    "key": "37_[200K-300K]_CHILDREN OF MEN (2006) Breakdown Film Analysis, Ending Explained,_276.2K views.jpg",
    "title": "Children of Men (2006) Long-Take Film Analysis",
    "category": "Photoreal Candid",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#10b981"
  },
  {
    "id": "r2-29",
    "index": 29,
    "key": "38_[300K-400K]_Get Out Breakdown How Every Detail Was Foreshadowing_392.8K views.jpg",
    "title": "Get Out — How Every Frame Was Foreshadowing",
    "category": "Minimal Clean",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#f43f5e"
  },
  {
    "id": "r2-30",
    "index": 30,
    "key": "39_[300K-400K]_The Odyssey (2026) Breakdown & Ending Explained Full Movie Review_384.7K views.jpg",
    "title": "The Odyssey: Cinematic Screenplay & Visual Breakdown",
    "category": "Photoreal Candid",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#8b5cf6"
  },
  {
    "id": "r2-31",
    "index": 31,
    "key": "40_[0-200K]_How to Get Ahead of 99% of People Before 2027_26.6K views.jpg",
    "title": "How to Get Ahead of 99% of People in Tech",
    "category": "Bold & Graphic",
    "mode": "Fastest 2K",
    "dimensions": "2048×1152",
    "credits": 1,
    "accentHex": "#f59e0b"
  },
  {
    "id": "r2-32",
    "index": 32,
    "key": "41_[0-200K]_How To Master Any Skill Fast (Give Yourself 2 Weeks)_182.4K views.jpg",
    "title": "How to Master Any Technical Skill in 2 Weeks",
    "category": "Minimal Clean",
    "mode": "Fastest 2K",
    "dimensions": "2048×1152",
    "credits": 1,
    "accentHex": "#22c55e"
  },
  {
    "id": "r2-33",
    "index": 33,
    "key": "42_[200K-300K]_25 Skills to Learn Before you're 25_211.9K views.jpg",
    "title": "25 High-Leverage Skills to Learn Early",
    "category": "Minimal Clean",
    "mode": "Fastest 2K",
    "dimensions": "2048×1152",
    "credits": 1,
    "accentHex": "#38bdf8"
  },
  {
    "id": "r2-34",
    "index": 34,
    "key": "43_[0-200K]_How to Master Any Skill, SUPERFAST ⏩ Self Improvement Skill Devel_10 views.jpg",
    "title": "Superfast Skill Acquisition Protocol",
    "category": "Bold & Graphic",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#e11d48"
  },
  {
    "id": "r2-35",
    "index": 35,
    "key": "44_[0-200K]_HOW TO BECOME DANGEROUSLY SELF-EDUCATED MASTER ANY SKILL & CHANGE_200 views.jpg",
    "title": "The Dangerously Self-Educated Playbook",
    "category": "Bold & Graphic",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#10b981"
  },
  {
    "id": "r2-36",
    "index": 36,
    "key": "45_[0-200K]_Ultralearning Blueprint - Master Any Skill Fast (English Listenin_38 views.jpg",
    "title": "The Ultralearning Blueprint: Master Hard Skills",
    "category": "Minimal Clean",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#3b82f6"
  },
  {
    "id": "r2-37",
    "index": 37,
    "key": "46_[0-200K]_7 GitHub Repos the FBI Wishes It Could Ban (2026)_163.7K views.jpg",
    "title": "7 Open-Source GitHub Repos Every Engineer Should Know",
    "category": "Tech & Systems",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#10b981"
  },
  {
    "id": "r2-38",
    "index": 38,
    "key": "47_[0-200K]_understand ANY programming project (from an open source maintaine_144.4K views.jpg",
    "title": "Understand Any Codebase — Maintainer's Guide",
    "category": "Tech & Systems",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#3b82f6"
  },
  {
    "id": "r2-39",
    "index": 39,
    "key": "48_[200K-300K]_Contributing To Open Source – Beginner's Guide_217.6K views.jpg",
    "title": "Contributing to Open Source: The Complete Guide",
    "category": "Tech & Systems",
    "mode": "Fastest 2K",
    "dimensions": "2048×1152",
    "credits": 1,
    "accentHex": "#8b5cf6"
  },
  {
    "id": "r2-40",
    "index": 40,
    "key": "49_[200K-300K]_Reverse Engineer Anything (REA) Explained The Software Industry W_256.9K views.jpg",
    "title": "Reverse Engineering Systems Architecture Explained",
    "category": "Tech & Systems",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#f43f5e"
  },
  {
    "id": "r2-41",
    "index": 41,
    "key": "50_[300K-400K]_Google's Git Killer Is INSANELY Better (and it's open source)_326.2K views.jpg",
    "title": "Next-Gen Open-Source Version Control Workflow",
    "category": "Tech & Systems",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#f59e0b"
  },
  {
    "id": "r2-42",
    "index": 42,
    "key": "51_[300K-400K]_Top 10 Repos explained Archify, Omarchi, OpenMAIC, and more_338.9K views.jpg",
    "title": "Top 10 High-Impact Developer Repositories",
    "category": "Tech & Systems",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#06b6d4"
  },
  {
    "id": "r2-43",
    "index": 43,
    "key": "52_[0-200K]_How He Got Interviews at Every FAANG Company (Copy This)_7.6K views.jpg",
    "title": "How to Get Interviews at Every Tier-1 Tech Company",
    "category": "Bold & Graphic",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#38bdf8"
  },
  {
    "id": "r2-44",
    "index": 44,
    "key": "53_[0-200K]_The End of LeetCode How AI Changed FAANG Interviews in 2026_67.7K views.jpg",
    "title": "The End of LeetCode: How AI Transformed Tech Hiring",
    "category": "Tech & Systems",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#f97316"
  },
  {
    "id": "r2-45",
    "index": 45,
    "key": "54_[200K-300K]_ex-Google Senior Engineer How to Get Hired So Fast It Feels Illeg_227.4K views.jpg",
    "title": "Ex-Google Staff Engineer: Fast-Track Tech Hiring",
    "category": "Bold & Graphic",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#10b981"
  },
  {
    "id": "r2-46",
    "index": 46,
    "key": "55_[200K-300K]_Software interviews are getting insane..._252.8K views.jpg",
    "title": "Software Engineering Interviews Are Evolving",
    "category": "Tech & Systems",
    "mode": "Standard 2K",
    "dimensions": "2560×1440",
    "credits": 2,
    "accentHex": "#f43f5e"
  },
  {
    "id": "r2-47",
    "index": 47,
    "key": "56_[300K-400K]_Coding Interviews in 2026_358.1K views.jpg",
    "title": "Systems & Coding Interviews in 2026",
    "category": "Tech & Systems",
    "mode": "Ultra 4K",
    "dimensions": "3840×2160",
    "credits": 5,
    "accentHex": "#38bdf8"
  },
  {
    "id": "r2-48",
    "index": 48,
    "key": "57_[300K-400K]_Study plan to crack FAANG job interviews MAANG interview preparat_322.8K views.jpg",
    "title": "The 90-Day Systems & Algorithms Interview Plan",
    "category": "Tech & Systems",
    "mode": "Text & Reference",
    "dimensions": "2752×1536",
    "credits": 3,
    "accentHex": "#a855f7"
  },
  {
    "id": "r2-49",
    "index": 49,
    "key": "healthcheck/r2_verify_probe.webp",
    "title": "Cloudflare R2 Edge Verification Live Probe",
    "category": "Tech & Systems",
    "mode": "Fastest 2K",
    "dimensions": "1920×1080",
    "credits": 1,
    "accentHex": "#10b981"
  }
];

// Backward compatibility alias for any existing imports
export const R2_SHOWCASE_30 = R2_SHOWCASE_ITEMS;
