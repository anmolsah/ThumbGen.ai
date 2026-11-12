/**
 * services/showcaseService.ts
 *
 * Dynamically queries Cloudflare R2 bucket for showcase thumbnails,
 * parses object keys into structured items, and caches results in memory.
 */

import { listR2BucketObjects, getR2ConfigFromEnv } from "./r2StorageService.js";

export type ShowcaseCategory =
  | "All"
  | "Photoreal Candid"
  | "Bold & Graphic"
  | "Product Hero"
  | "Tech & Systems"
  | "Minimal Clean";

export interface ShowcaseThumbnailItem {
  id: string;
  index: number;
  key: string;
  url: string;
  title: string;
  category: Exclude<ShowcaseCategory, "All">;
  mode: "Fastest 2K" | "Standard 2K" | "Text & Reference" | "Ultra 4K";
  dimensions: string;
  credits: 1 | 2 | 3 | 5;
  accentHex: string;
}

let cachedShowcase: { items: ShowcaseThumbnailItem[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper to clean key into human title
export function parseCleanTitle(key: string): string {
  let s = key.replace(/^\d+_\[.*?\]_/, "");
  s = s.replace(/_[\d\.]+K?\s+views\.(?:jpg|jpeg|png|webp)$/i, "");
  s = s.replace(/\.(?:jpg|jpeg|png|webp)$/i, "");
  s = s.replace(/[_\s\(\-]+$/, "").trim();
  return s;
}

export function mapKeyToShowcaseItem(
  key: string,
  idx: number,
  baseUrl: string
): ShowcaseThumbnailItem {
  const clean = parseCleanTitle(key);
  const matchNum = key.match(/^(\d+)/);
  const num = matchNum ? parseInt(matchNum[1], 10) : idx + 1;

  let category: Exclude<ShowcaseCategory, "All"> = "Tech & Systems";
  let mode: "Fastest 2K" | "Standard 2K" | "Text & Reference" | "Ultra 4K" = "Standard 2K";
  let dimensions = "2560×1440";
  let credits: 1 | 2 | 3 | 5 = 2;
  let accentHex = "#38bdf8";
  let title = clean;

  if (num >= 1 && num <= 6) {
    category = "Product Hero";
    if (num === 1) { title = "17 Coolest Tech Gadgets Worth Buying in 2026"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#38bdf8"; }
    else if (num === 2) { title = "Coolest Tech of the Month — Ep. 107"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#f97316"; }
    else if (num === 3) { title = "50 Favorite Tech Gadgets You Can Buy"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#10b981"; }
    else if (num === 4) { title = "20 Cool New Tech Actually Worth Buying"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#3b82f6"; }
    else if (num === 5) { title = "40 Genius AI Gadgets You Have to See"; category = "Tech & Systems"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#f59e0b"; }
    else if (num === 6) { title = "41 Amazing Gadgets You Can Actually Buy"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#f43f5e"; }
  } else if (num >= 7 && num <= 12) {
    if (num === 7) { title = "The Secret SS Science Experiments Documentary"; category = "Photoreal Candid"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#ef4444"; }
    else if (num === 8) { title = "The Ahnenerbe Experiments — Full Documentary"; category = "Photoreal Candid"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#eab308"; }
    else if (num === 9) { title = "The SNAPTRAN Reactor Experiments Documentary"; category = "Photoreal Candid"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#f59e0b"; }
    else if (num === 10) { title = "The 1960 Visual Cliff Science Experiment"; category = "Photoreal Candid"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#06b6d4"; }
    else if (num === 11) { title = "The Stern-Gerlach Quantum Physics Experiment"; category = "Minimal Clean"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#38bdf8"; }
    else if (num === 12) { title = "Neutrino Oscillations Explained — Davis Experiment"; category = "Tech & Systems"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#06b6d4"; }
  } else if (num >= 16 && num <= 21) {
    if (num === 16) { title = "5 AI Workflows to Grow Faster Than 99%"; category = "Bold & Graphic"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#f97316"; }
    else if (num === 17) { title = "YouTube Growth Secrets: Editing & Strategy Tools"; category = "Bold & Graphic"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#10b981"; }
    else if (num === 18) { title = "18 Psychology Principles for High-Retention Video"; category = "Bold & Graphic"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#f43f5e"; }
    else if (num === 19) { title = "If I Started Creating in 2026, I'd Do This"; category = "Photoreal Candid"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#10b981"; }
    else if (num === 20) { title = "The Exact System to Scale YouTube in 90 Days"; category = "Bold & Graphic"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#ef4444"; }
    else if (num === 21) { title = "The New Rules of Creator Distribution (2026)"; category = "Minimal Clean"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#a1a1aa"; }
  } else if (num >= 28 && num <= 33) {
    if (num === 28) { title = "The Truth About Career Gaps on Your Resume"; category = "Bold & Graphic"; mode = "Fastest 2K"; dimensions = "2048×1152"; credits = 1; accentHex = "#eab308"; }
    else if (num === 29) { title = "How to Prove Job Skills in Engineering Interviews"; category = "Minimal Clean"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#38bdf8"; }
    else if (num === 30) { title = "Write a Standout Resume in the AI Era"; category = "Minimal Clean"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#38bdf8"; }
    else if (num === 31) { title = "Myth Busting 5 Pieces of Career Advice"; category = "Photoreal Candid"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#14b8a6"; }
    else if (num === 32) { title = "The Storytelling Formula for Technical Interviews"; category = "Photoreal Candid"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#f59e0b"; }
    else if (num === 33) { title = "Ex-Google Recruiter Teaches Resume Masterclass"; category = "Bold & Graphic"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#3b82f6"; }
  } else if (num >= 34 && num <= 39) {
    if (num === 34) { title = "Full Metal Jacket (1987) Cinematography Breakdown"; category = "Photoreal Candid"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#f97316"; }
    else if (num === 35) { title = "How Godzilla Minus One Humbled Modern VFX"; category = "Photoreal Candid"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#0ea5e9"; }
    else if (num === 36) { title = "Psycho (1960) Masterclass: Visual Suspense & Framing"; category = "Photoreal Candid"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#e11d48"; }
    else if (num === 37) { title = "Children of Men (2006) Long-Take Film Analysis"; category = "Photoreal Candid"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#10b981"; }
    else if (num === 38) { title = "Get Out — How Every Frame Was Foreshadowing"; category = "Minimal Clean"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#f43f5e"; }
    else if (num === 39) { title = "The Odyssey: Cinematic Screenplay & Visual Breakdown"; category = "Photoreal Candid"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#8b5cf6"; }
  } else if (num >= 40 && num <= 45) {
    if (num === 40) { title = "How to Get Ahead of 99% of People in Tech"; category = "Bold & Graphic"; mode = "Fastest 2K"; dimensions = "2048×1152"; credits = 1; accentHex = "#f59e0b"; }
    else if (num === 41) { title = "How to Master Any Technical Skill in 2 Weeks"; category = "Minimal Clean"; mode = "Fastest 2K"; dimensions = "2048×1152"; credits = 1; accentHex = "#22c55e"; }
    else if (num === 42) { title = "25 High-Leverage Skills to Learn Early"; category = "Minimal Clean"; mode = "Fastest 2K"; dimensions = "2048×1152"; credits = 1; accentHex = "#38bdf8"; }
    else if (num === 43) { title = "Superfast Skill Acquisition Protocol"; category = "Bold & Graphic"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#e11d48"; }
    else if (num === 44) { title = "The Dangerously Self-Educated Playbook"; category = "Bold & Graphic"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#10b981"; }
    else if (num === 45) { title = "The Ultralearning Blueprint: Master Hard Skills"; category = "Minimal Clean"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#3b82f6"; }
  } else if (num >= 46 && num <= 51) {
    category = "Tech & Systems";
    if (num === 46) { title = "7 Open-Source GitHub Repos Every Engineer Should Know"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#10b981"; }
    else if (num === 47) { title = "Understand Any Codebase — Maintainer's Guide"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#3b82f6"; }
    else if (num === 48) { title = "Contributing to Open Source: The Complete Guide"; mode = "Fastest 2K"; dimensions = "2048×1152"; credits = 1; accentHex = "#8b5cf6"; }
    else if (num === 49) { title = "Reverse Engineering Systems Architecture Explained"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#f43f5e"; }
    else if (num === 50) { title = "Next-Gen Open-Source Version Control Workflow"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#f59e0b"; }
    else if (num === 51) { title = "Top 10 High-Impact Developer Repositories"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#06b6d4"; }
  } else if (num >= 52 && num <= 57) {
    if (num === 52) { title = "How to Get Interviews at Every Tier-1 Tech Company"; category = "Bold & Graphic"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#38bdf8"; }
    else if (num === 53) { title = "The End of LeetCode: How AI Transformed Tech Hiring"; category = "Tech & Systems"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#f97316"; }
    else if (num === 54) { title = "Ex-Google Staff Engineer: Fast-Track Tech Hiring"; category = "Bold & Graphic"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#10b981"; }
    else if (num === 55) { title = "Software Engineering Interviews Are Evolving"; category = "Tech & Systems"; mode = "Standard 2K"; dimensions = "2560×1440"; credits = 2; accentHex = "#f43f5e"; }
    else if (num === 56) { title = "Systems & Coding Interviews in 2026"; category = "Tech & Systems"; mode = "Ultra 4K"; dimensions = "3840×2160"; credits = 5; accentHex = "#38bdf8"; }
    else if (num === 57) { title = "The 90-Day Systems & Algorithms Interview Plan"; category = "Tech & Systems"; mode = "Text & Reference"; dimensions = "2752×1536"; credits = 3; accentHex = "#a855f7"; }
  } else if (key.includes("healthcheck")) {
    title = "Cloudflare R2 Edge Verification Live Probe";
    category = "Tech & Systems";
    mode = "Fastest 2K";
    dimensions = "1920×1080";
    credits = 1;
    accentHex = "#10b981";
  }

  const encodedKey = key
    .replace(/^\/+/, "")
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");

  const url = `${baseUrl.replace(/\/+$/, "")}/${encodedKey}`;

  return {
    id: `r2-${String(idx + 1).padStart(2, "0")}`,
    index: idx + 1,
    key,
    url,
    title,
    category,
    mode,
    dimensions,
    credits,
    accentHex,
  };
}

export const STATIC_49_KEYS = [
  "01_[0-200K]_17 Coolest Tech Gadgets That Are Totally Worth Buying in 2026!_45.8K views.jpg",
  "02_[0-200K]_Coolest Tech of the Month 🔥 October 2026! Ep. 107_48.4K views.jpg",
  "03_[200K-300K]_My 50 Favorite Tech Gadgets You Can Buy (2025 Ultimate Gift Guide_245.3K views.jpg",
  "04_[200K-300K]_20 Cool New Tech That Are Actually Worth Buying!_266.7K views.jpg",
  "05_[300K-400K]_40 Genius AI Gadgets on Amazon You Have to See to Believe_398.4K views.jpg",
  "06_[300K-400K]_41 AMAZING Gadgets You Can Actually Buy_305.3K views.jpg",
  "07_[0-200K]_The Sinister Experiments of Heinrich Himmler's Secret SS Scientis_18.4K views.jpg",
  "08_[0-200K]_The Sinister Experiments of Nazi Germany’s Ahnenerbe FULL DOCUMEN_62.2K views.jpg",
  "09_[300K-400K]_A Brief History of The SNAPTRAN Reactor destruction Experiments (_394.1K views.jpg",
  "10_[300K-400K]_The Dark side of Science The Baby Cliff Experiment 1960 Short Doc_399.5K views.jpg",
  "11_[300K-400K]_The Stern-Gerlach Experiment (ESI College Physics Film Program 19_355.1K views.jpg",
  "12_[0-200K]_Neutrino Oscillations Explained The Davis Experiment Documentary_24 views.jpg",
  "16_[0-200K]_5 Claude Skills To Grow Faster Than 99% of People on Social Media_149.1K views.jpg",
  "17_[0-200K]_YouTube Growth Tips w PK Adventure Travels Ideas, Editing Tools &_71 views.jpg",
  "18_[200K-300K]_18 Psychology Tricks to Get Viewers Addicted to Your Videos_262.1K views.jpg",
  "19_[200K-300K]_If I Started Social Media In 2026, I'd Do This_214.0K views.jpg",
  "20_[300K-400K]_The EXACT System to Blow Up on YouTube in 90 Days_318.5K views.jpg",
  "21_[300K-400K]_The New Rules of Social Media (2026)_335.2K views.jpg",
  "28_[0-200K]_THE TRUTH ABOUT LYING ON YOUR RESUME (JOB GAPS DO IT)_87.6K views.jpg",
  "29_[0-200K]_How to Prove Your Job Skills on a Resume and in Interviews Indeed_1.5K views.jpg",
  "30_[200K-300K]_Write a Killer Résumé in the AI Era 5 New Rules!_223.6K views.jpg",
  "31_[200K-300K]_Myth Busting 5 Common Pieces of Advice About Switching Jobs The H_292.8K views.jpg",
  "32_[300K-400K]_The Storytelling Formula That Makes You Unforgettable in Intervie_381.0K views.jpg",
  "33_[300K-400K]_Ex-Google Recruiter Teaches Resume Masterclass to get FAANG Inter_368.4K views.jpg",
  "34_[0-200K]_FULL Metal Jacket Breakdown (1987) Ending Explained, True Story, _158.1K views.jpg",
  "35_[0-200K]_How Godzilla Minus Zero Humbled Hollywood Again_47.9K views.jpg",
  "36_[200K-300K]_PSYCHO (1960) Breakdown Film Analysis, Easter Eggs, Making Of & E_204.2K views.jpg",
  "37_[200K-300K]_CHILDREN OF MEN (2006) Breakdown Film Analysis, Ending Explained,_276.2K views.jpg",
  "38_[300K-400K]_Get Out Breakdown How Every Detail Was Foreshadowing_392.8K views.jpg",
  "39_[300K-400K]_The Odyssey (2026) Breakdown & Ending Explained Full Movie Review_384.7K views.jpg",
  "40_[0-200K]_How to Get Ahead of 99% of People Before 2027_26.6K views.jpg",
  "41_[0-200K]_How To Master Any Skill Fast (Give Yourself 2 Weeks)_182.4K views.jpg",
  "42_[200K-300K]_25 Skills to Learn Before you're 25_211.9K views.jpg",
  "43_[0-200K]_How to Master Any Skill, SUPERFAST ⏩ Self Improvement Skill Devel_10 views.jpg",
  "44_[0-200K]_HOW TO BECOME DANGEROUSLY SELF-EDUCATED MASTER ANY SKILL & CHANGE_200 views.jpg",
  "45_[0-200K]_Ultralearning Blueprint - Master Any Skill Fast (English Listenin_38 views.jpg",
  "46_[0-200K]_7 GitHub Repos the FBI Wishes It Could Ban (2026)_163.7K views.jpg",
  "47_[0-200K]_understand ANY programming project (from an open source maintaine_144.4K views.jpg",
  "48_[200K-300K]_Contributing To Open Source – Beginner's Guide_217.6K views.jpg",
  "49_[200K-300K]_Reverse Engineer Anything (REA) Explained The Software Industry W_256.9K views.jpg",
  "50_[300K-400K]_Google's Git Killer Is INSANELY Better (and it's open source)_326.2K views.jpg",
  "51_[300K-400K]_Top 10 Repos explained Archify, Omarchi, OpenMAIC, and more_338.9K views.jpg",
  "52_[0-200K]_How He Got Interviews at Every FAANG Company (Copy This)_7.6K views.jpg",
  "53_[0-200K]_The End of LeetCode How AI Changed FAANG Interviews in 2026_67.7K views.jpg",
  "54_[200K-300K]_ex-Google Senior Engineer How to Get Hired So Fast It Feels Illeg_227.4K views.jpg",
  "55_[200K-300K]_Software interviews are getting insane..._252.8K views.jpg",
  "56_[300K-400K]_Coding Interviews in 2026_358.1K views.jpg",
  "57_[300K-400K]_Study plan to crack FAANG job interviews MAANG interview preparat_322.8K views.jpg",
  "healthcheck/r2_verify_probe.webp",
];

export async function fetchLiveShowcaseThumbnails(): Promise<ShowcaseThumbnailItem[]> {
  const now = Date.now();
  if (cachedShowcase && now - cachedShowcase.timestamp < CACHE_TTL_MS) {
    return cachedShowcase.items;
  }

  const cfg = getR2ConfigFromEnv();
  const baseUrl =
    cfg?.publicBaseUrl ||
    "https://pub-8ac5b71703ef48afa4b9f02603e3ba50.r2.dev";

  try {
    const rawKeys = await listR2BucketObjects();
    const imageKeys = rawKeys.filter((k) => /\.(jpg|jpeg|png|webp)$/i.test(k));

    if (imageKeys.length > 0) {
      // Sort numerically by prefix index if present
      imageKeys.sort((a, b) => {
        const numA = parseInt(a.slice(0, 2), 10) || 999;
        const numB = parseInt(b.slice(0, 2), 10) || 999;
        return numA - numB;
      });

      const items = imageKeys.map((k, i) => mapKeyToShowcaseItem(k, i, baseUrl));
      cachedShowcase = { items, timestamp: now };
      return items;
    }
  } catch (err) {
    // If listing fails (e.g. offline or DNS resolution in sandbox), fall back to curated 49 items
  }

  // Guaranteed fallback with all 49 items
  const fallbackItems = STATIC_49_KEYS.map((k, i) =>
    mapKeyToShowcaseItem(k, i, baseUrl)
  );
  cachedShowcase = { items: fallbackItems, timestamp: now };
  return fallbackItems;
}

