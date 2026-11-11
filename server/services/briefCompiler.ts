/**
 * services/briefCompiler.ts
 *
 * Server-side Brief Compiler (PLAN.md Sections 10A.2, 10A.3, 10A.8, 12 Phase 5.5, 13):
 *   - Turns a short user prompt + style preset + platform preset + optional brand kit
 *     into a validated JSON StructuredBrief, then renders a deterministic model prompt.
 *   - Loads `config/slop_lexicon.yaml`: constrains ONLY what the compiler adds;
 *     NEVER censors, alters, or removes words typed by the user.
 *   - Uses a seeded PRNG (`mulberry32`) for controlled randomness on `light` and
 *     `background_detail`, avoiding fragments used in the user's last N generations.
 *   - Validates LLM brief JSON output and retries at most once on invalid JSON before
 *     falling back to deterministic synthesis.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type StylePresetId =
  | "photoreal_candid"
  | "bold_graphic"
  | "product_focus"
  | "minimal_clean"
  | "typographic_led";

export interface BrandKitInput {
  palette?: string[];
  fonts?: string[];
  logoPlacement?: "top-left" | "top-right" | "bottom-left" | "none";
}

export interface StructuredBrief {
  subject_and_action: string;
  expression_or_pose: string;
  light: string;
  surface_detail: string;
  background_detail: string;
  camera: string;
  composition: {
    focal_point: string;
    reserved_text_region: "left-third" | "top-band" | "bottom-band" | "none";
    safe_zone_center_ratio: number;
    avoid_bottom_right_badge: boolean;
  };
  palette: string[];
  constraints: string[];
}

export interface BriefCompilerInput {
  userPrompt: string;
  stylePreset?: StylePresetId | string;
  platformPreset?: "youtube_video" | "youtube_shorts" | string;
  brandKit?: BrandKitInput;
  hasReferenceImage?: boolean;
  titleText?: string; // Title text is for the code overlay renderer, NOT sent to the image model by default
  seed?: number;
  userId?: string;
  supportsNegativePrompt?: boolean;
  correctiveDefects?: string[];
  llmBriefGenerator?: (
    input: BriefCompilerInput,
    attempt: number
  ) => Promise<unknown>;
}

export interface CompiledBriefResult {
  structuredBrief: StructuredBrief;
  finalPrompt: string;
  negativePrompt: string | null;
  seedUsed: number;
  stylePresetUsed: StylePresetId;
  llmAttempts: number;
  usedFallbackSynthesis: boolean;
}

interface StylePresetConfig {
  id: StylePresetId;
  label: string;
  is_person_preset: boolean;
  allowed_layouts: string[];
  default_camera: string;
  default_surface_detail: string;
  person_directives: string[];
  default_palette: string[];
}

interface StylePresetsFile {
  version: number;
  llm_brief_model: string | null;
  presets: Record<StylePresetId, StylePresetConfig>;
  curated_light_pools: string[];
  curated_background_pools: string[];
}

const SLOP_LEXICON_PATH = path.join(__dirname, "../config/slop_lexicon.yaml");
const STYLE_PRESETS_PATH = path.join(__dirname, "../config/style_presets.json");

let cachedSlopTerms: string[] | null = null;
let cachedPresetsFile: StylePresetsFile | null = null;

/**
 * Parses `config/slop_lexicon.yaml` without external YAML runtime dependencies.
 */
export function loadSlopLexicon(): string[] {
  if (cachedSlopTerms) return cachedSlopTerms;
  if (!fs.existsSync(SLOP_LEXICON_PATH)) {
    cachedSlopTerms = [
      "masterpiece",
      "ultra-detailed",
      "8k",
      "hyper-realistic",
      "cinematic lighting",
      "volumetric",
      "glowing",
      "trending on artstation",
      "soft even studio lighting",
    ];
    return cachedSlopTerms;
  }
  const raw = fs.readFileSync(SLOP_LEXICON_PATH, "utf8");
  const terms: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*["']?([^"'#]+)["']?\s*$/);
    if (match && match[1]) {
      terms.push(match[1].trim().toLowerCase());
    }
  }
  cachedSlopTerms = terms;
  return terms;
}

export function loadStylePresets(): StylePresetsFile {
  if (cachedPresetsFile) return cachedPresetsFile;
  const raw = fs.readFileSync(STYLE_PRESETS_PATH, "utf8");
  cachedPresetsFile = JSON.parse(raw) as StylePresetsFile;
  return cachedPresetsFile;
}

/**
 * Strips banned slop modifiers ONLY from compiler-generated fragments.
 * User-typed text is NEVER passed through this filter (Section 10A.2).
 */
export function stripSlopFromCompilerFragment(fragment: string): string {
  const lexicon = loadSlopLexicon();
  let cleaned = fragment;
  for (const term of lexicon) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    cleaned = cleaned.replace(regex, "");
  }
  return cleaned
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

/**
 * Deterministic 32-bit PRNG (`mulberry32`) so the same seed always produces the exact same prompt.
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Validates that an unknown object conforms to the `StructuredBrief` JSON schema (Section 10A.2).
 */
export function validateStructuredBrief(
  candidate: unknown
): { valid: boolean; errors: string[]; brief?: StructuredBrief } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, errors: ["Brief must be a non-null JSON object"] };
  }
  const obj = candidate as Record<string, any>;
  const requiredStrings = [
    "subject_and_action",
    "expression_or_pose",
    "light",
    "surface_detail",
    "background_detail",
    "camera",
  ];
  for (const field of requiredStrings) {
    if (typeof obj[field] !== "string" || !obj[field].trim()) {
      errors.push(`Missing or empty string field '${field}'`);
    }
  }

  if (!obj.composition || typeof obj.composition !== "object") {
    errors.push("Missing 'composition' object");
  } else {
    if (
      typeof obj.composition.focal_point !== "string" ||
      !obj.composition.focal_point.trim()
    ) {
      errors.push("Missing 'composition.focal_point'");
    }
    const validRegions = ["left-third", "top-band", "bottom-band", "none"];
    if (!validRegions.includes(obj.composition.reserved_text_region)) {
      errors.push("Invalid 'composition.reserved_text_region'");
    }
  }

  if (
    !Array.isArray(obj.palette) ||
    obj.palette.length < 2 ||
    obj.palette.length > 4 ||
    !obj.palette.every((c: unknown) => typeof c === "string" && c.trim().length > 0)
  ) {
    errors.push("'palette' must be an array of 2-4 color strings");
  }

  if (
    !Array.isArray(obj.constraints) ||
    !obj.constraints.every((c: unknown) => typeof c === "string")
  ) {
    errors.push("'constraints' must be an array of strings");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    brief: obj as StructuredBrief,
  };
}

/**
 * Per-user history tracker (Section 10A.8): avoids reusing the same light or background-detail
 * fragments within the last N generations (default 10) when no explicit deterministic seed is pinned.
 */
export class UserVariationHistory {
  private readonly maxHistory: number;
  private readonly recentByUser = new Map<
    string,
    Array<{ light: string; background: string }>
  >();

  constructor(maxHistory = 10) {
    this.maxHistory = maxHistory;
  }

  public getRecent(userId: string): Array<{ light: string; background: string }> {
    return this.recentByUser.get(userId) ?? [];
  }

  public record(userId: string, light: string, background: string): void {
    const list = this.recentByUser.get(userId) ?? [];
    list.push({ light, background });
    while (list.length > this.maxHistory) {
      list.shift();
    }
    this.recentByUser.set(userId, list);
  }

  public reset(): void {
    this.recentByUser.clear();
  }
}

export const defaultVariationHistory = new UserVariationHistory(10);

function resolveStylePresetId(raw?: string): StylePresetId {
  const presets = loadStylePresets().presets;
  if (raw && raw in presets) {
    return raw as StylePresetId;
  }
  return "photoreal_candid";
}

function synthesizeDeterministicBrief(
  input: BriefCompilerInput,
  preset: StylePresetConfig,
  seed: number
): StructuredBrief {
  const presetsFile = loadStylePresets();
  const rng = createSeededRng(seed);

  const lights = presetsFile.curated_light_pools;
  const backgrounds = presetsFile.curated_background_pools;

  let lightIdx = Math.floor(rng() * lights.length);
  let bgIdx = Math.floor(rng() * backgrounds.length);

  // If userId is provided and no explicit seed was locked by caller, avoid recent fragments
  if (input.userId && input.seed === undefined) {
    const recent = defaultVariationHistory.getRecent(input.userId);
    const recentLights = new Set(recent.map((r) => r.light));
    const recentBgs = new Set(recent.map((r) => r.background));

    for (let offset = 0; offset < lights.length; offset++) {
      const candidate = lights[(lightIdx + offset) % lights.length];
      if (!recentLights.has(candidate)) {
        lightIdx = (lightIdx + offset) % lights.length;
        break;
      }
    }
    for (let offset = 0; offset < backgrounds.length; offset++) {
      const candidate = backgrounds[(bgIdx + offset) % backgrounds.length];
      if (!recentBgs.has(candidate)) {
        bgIdx = (bgIdx + offset) % backgrounds.length;
        break;
      }
    }
  }

  const chosenLight = stripSlopFromCompilerFragment(lights[lightIdx]);
  const chosenBg = stripSlopFromCompilerFragment(backgrounds[bgIdx]);

  if (input.userId && input.seed === undefined) {
    defaultVariationHistory.record(input.userId, chosenLight, chosenBg);
  }

  const hasTitle = Boolean(input.titleText && input.titleText.trim().length > 0);
  const reservedRegion = hasTitle ? "left-third" : "none";

  const baseConstraints = [
    "one primary focal subject, maximum 3 visual elements",
    "keep key subject within center 80% safe zone and clear of bottom-right duration badge",
    "no AI-rendered pseudo-text, no watermarks, no random logos, accurate hand anatomy",
  ];

  if (preset.is_person_preset) {
    baseConstraints.push(
      ...preset.person_directives.map((d) => stripSlopFromCompilerFragment(d))
    );
  }

  if (input.hasReferenceImage) {
    baseConstraints.push(
      "preserve the exact facial identity and bone structure of the reference subject"
    );
  }

  if (input.correctiveDefects && input.correctiveDefects.length > 0) {
    for (const defect of input.correctiveDefects) {
      baseConstraints.push(`CORRECTION: fix ${stripSlopFromCompilerFragment(defect)}`);
    }
  }

  const palette =
    input.brandKit?.palette && input.brandKit.palette.length >= 2
      ? input.brandKit.palette.slice(0, 3)
      : preset.default_palette;

  return {
    // NEVER alter or strip words from input.userPrompt (Section 10A.2)
    subject_and_action: input.userPrompt.trim(),
    expression_or_pose: preset.is_person_preset
      ? "asymmetric candid expression, gaze slightly off-camera, natural posture"
      : "clean three-quarter hero angle with deliberate asymmetry",
    light: chosenLight,
    surface_detail: stripSlopFromCompilerFragment(preset.default_surface_detail),
    background_detail: chosenBg,
    camera: stripSlopFromCompilerFragment(preset.default_camera),
    composition: {
      focal_point:
        reservedRegion === "left-third"
          ? "primary subject positioned on right two-thirds, clean negative space on left-third reserved for code typography"
          : "primary subject positioned off-center following rule of thirds inside 80% safe zone",
      reserved_text_region: reservedRegion,
      safe_zone_center_ratio: 0.8,
      avoid_bottom_right_badge: true,
    },
    palette,
    constraints: baseConstraints,
  };
}

/**
 * Compiles a user prompt + style/platform presets into a validated `StructuredBrief`
 * and deterministic final prompt string (Section 10A.2).
 */
export async function compileThumbnailBrief(
  input: BriefCompilerInput
): Promise<CompiledBriefResult> {
  const userPromptRaw = input.userPrompt.trim();
  if (!userPromptRaw) {
    throw new Error("User prompt cannot be empty");
  }

  const stylePresetUsed = resolveStylePresetId(input.stylePreset);
  const presetCfg = loadStylePresets().presets[stylePresetUsed];
  const seedUsed =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? Math.floor(input.seed)
      : 104729;

  let validatedBrief: StructuredBrief | null = null;
  let llmAttempts = 0;
  let usedFallbackSynthesis = false;

  // Step 1: If an LLM brief generator is configured/injected, try at most 2 attempts (1 initial + 1 retry)
  if (input.llmBriefGenerator) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      llmAttempts = attempt;
      try {
        const candidate = await input.llmBriefGenerator(input, attempt);
        const validation = validateStructuredBrief(candidate);
        if (validation.valid && validation.brief) {
          // Ensure user-typed words are preserved verbatim in subject_and_action
          const brief = validation.brief;
          if (!brief.subject_and_action.includes(userPromptRaw)) {
            brief.subject_and_action = `${userPromptRaw} — ${stripSlopFromCompilerFragment(
              brief.subject_and_action
            )}`;
          }
          brief.light = stripSlopFromCompilerFragment(brief.light);
          brief.surface_detail = stripSlopFromCompilerFragment(brief.surface_detail);
          brief.background_detail = stripSlopFromCompilerFragment(
            brief.background_detail
          );
          brief.camera = stripSlopFromCompilerFragment(brief.camera);
          validatedBrief = brief;
          break;
        }
      } catch {
        // Retry at most once, then fall back to deterministic synthesis
      }
    }
  }

  if (!validatedBrief) {
    usedFallbackSynthesis = true;
    validatedBrief = synthesizeDeterministicBrief(input, presetCfg, seedUsed);
  }

  // Step 2: Deterministic template turns the validated JSON into the final model prompt.
  // Notice: userPromptRaw is preserved intact inside subject_and_action; compiler sections are slop-free.
  const promptParts: string[] = [
    `Subject: ${validatedBrief.subject_and_action}.`,
    `Pose & Expression: ${validatedBrief.expression_or_pose}.`,
    `Lighting: ${validatedBrief.light}.`,
    `Surface & Material Texture: ${validatedBrief.surface_detail}.`,
    `Environment Detail: ${validatedBrief.background_detail}.`,
    `Camera: ${validatedBrief.camera}.`,
    `Composition: ${validatedBrief.composition.focal_point}.`,
    `Color Palette: ${validatedBrief.palette.join(", ")}.`,
  ];

  let negativePrompt: string | null = null;
  if (input.supportsNegativePrompt) {
    negativePrompt =
      "garbled text, watermark, logo, extra fingers, deformed hands, plastic skin, neon 3d wordart, cluttered background";
    promptParts.push(
      `Directives: ${validatedBrief.constraints.join("; ")}.`
    );
  } else {
    promptParts.push(
      `Strict Directives: ${validatedBrief.constraints.join("; ")}.`
    );
  }

  return {
    structuredBrief: validatedBrief,
    finalPrompt: promptParts.join(" "),
    negativePrompt,
    seedUsed,
    stylePresetUsed,
    llmAttempts,
    usedFallbackSynthesis,
  };
}

