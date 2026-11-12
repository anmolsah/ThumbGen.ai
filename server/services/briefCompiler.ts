/**
 * services/briefCompiler.ts
 *
 * Server-side Brief Compiler (PLAN.md Sections 10A.2, 10A.3, 10A.8, 10B.4, 10B.5, 12 Phase 5.5, 13):
 *   - Turns a user prompt + style preset + platform preset + optional brand kit
 *     into a validated JSON ContentBrief (10B Stage 1) and CreativeDirection (10B Stage 2),
 *     then synthesizes a validated StructuredBrief and deterministic model prompt.
 *   - Loads `config/slop_lexicon.yaml`: constrains ONLY what the compiler adds;
 *     NEVER censors, alters, or removes words typed by the user.
 *   - Loads `config/creative_direction_presets.yaml`: owner-editable 6 creative direction families
 *     (Editorial Photography, Documentary Storytelling, Investigative Editorial,
 *     Bold Graphic Design, Product-Focused, Typographic-Led).
 *   - Loads `config/design_qa_config.yaml`: configures QA mode (shadow/enforce) and thresholds.
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

export type CreativeDirectionFamilyId =
  | "editorial_photography"
  | "documentary_storytelling"
  | "investigative_editorial"
  | "bold_graphic_design"
  | "product_focused"
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

/**
 * Section 10B.4 Stage 1: Structured Content Brief
 */
export interface ContentBrief {
  topic: string;
  specific_story: string;
  audience: string;
  viewer_curiosity: string;
  emotional_tone: string;
  content_format: string;
  must_show: string[];
  must_not_imply: string[];
  title_text?: string;
  platform_preset: string;
  reference_assets?: string[];
  truthfulness_notes?: string[];
}

/**
 * Section 10B.4 Stage 2: Creative Direction
 */
export interface CreativeDirection {
  concept_name: string;
  family_id: CreativeDirectionFamilyId;
  visual_thesis: string;
  story_device: string;
  primary_subject: string;
  supporting_element?: string;
  emotional_tone: string;
  visual_language: string;
  composition_intent: string;
  typography_intent: string;
  palette_intent: string;
  why_this_fits: string;
  risks: string[];
  user_override_applied: boolean;
}

export interface CreativeDirectionFamilyConfig {
  id: CreativeDirectionFamilyId;
  label: string;
  description: string;
  best_for_formats: string[];
  emotional_tones: string[];
  visual_language: string;
  composition_intent: string;
  typography_intent: string;
  palette_intent: string;
  common_risks: string[];
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
  forceCreativeFamily?: CreativeDirectionFamilyId;
  creativeDirectionFamily?: CreativeDirectionFamilyId;
  contentBriefOverride?: Partial<ContentBrief>;
  llmBriefGenerator?: (
    input: BriefCompilerInput,
    attempt: number
  ) => Promise<unknown>;
}

export interface CompiledBriefResult {
  structuredBrief: StructuredBrief;
  contentBrief: ContentBrief;
  creativeDirection: CreativeDirection;
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
const CREATIVE_PRESETS_PATH = path.join(__dirname, "../config/creative_direction_presets.yaml");
const DESIGN_QA_CONFIG_PATH = path.join(__dirname, "../config/design_qa_config.yaml");

let cachedSlopTerms: string[] | null = null;
let cachedPresetsFile: StylePresetsFile | null = null;
let cachedCreativePresets: Record<CreativeDirectionFamilyId, CreativeDirectionFamilyConfig> | null = null;
let cachedDesignQaConfig: any = null;

export const DEFAULT_CREATIVE_FAMILIES: Record<CreativeDirectionFamilyId, CreativeDirectionFamilyConfig> = {
  editorial_photography: {
    id: "editorial_photography",
    label: "Editorial Photography",
    description: "Credible, authentic, magazine-cover realism with natural motivated lighting, deliberate negative space, and disciplined typography.",
    best_for_formats: ["documentary", "essay", "interview", "biography", "travel", "general"],
    emotional_tones: ["curiosity", "authenticity", "reflection", "gravity", "calm"],
    visual_language: "authentic editorial photography with natural ambient light and realistic lens depth",
    composition_intent: "asymmetric hero placement with deliberate negative space reserved for typography",
    typography_intent: "understated editorial serif or high-contrast clean sans, strictly non-decorative",
    palette_intent: "restrained contextual tones, warm or cool based on environment, avoiding saturated neon",
    common_risks: [
      "overly cinematic stock-photo polish that looks generic",
      "insufficient contrast between subject and background",
    ],
  },
  documentary_storytelling: {
    id: "documentary_storytelling",
    label: "Documentary Storytelling",
    description: "Scene-specific visual evidence and observational framing for real-world events, places, investigations, and experiences.",
    best_for_formats: ["documentary", "history", "geography", "true_crime", "investigation"],
    emotional_tones: ["urgency", "wonder", "concern", "intrigue", "historical_gravity"],
    visual_language: "observational documentary framing with environmental evidence and genuine texture",
    composition_intent: "context-rich framing where the environment provides factual weight to the subject",
    typography_intent: "authoritative clean sans-serif or archival stencil, placed in safe negative space",
    palette_intent: "grounded documentary color grade derived from the authentic location",
    common_risks: [
      "inventing fake evidence or historical inaccuracies",
      "cluttering the frame with decorative overlays",
    ],
  },
  investigative_editorial: {
    id: "investigative_editorial",
    label: "Investigative Editorial",
    description: "Visual thesis built around a single meaningful clue, contrast, or reveal. Avoids decorative arrows, arbitrary circles, and cartoon warning signs.",
    best_for_formats: ["investigation", "business_breakdown", "finance", "deep_dive", "commentary"],
    emotional_tones: ["skepticism", "curiosity", "revelation", "analytical_clarity"],
    visual_language: "high-contrast conceptual still life or stark evidentiary subject composition",
    composition_intent: "sharp visual contrast or juxtaposition between two states or one dominant clue",
    typography_intent: "bold, high-impact headline with high contrast against clean negative space",
    palette_intent: "monochromatic or dual-tone with one surgical accent color (e.g. warning yellow or crimson)",
    common_risks: [
      "arbitrary magnifying glasses, question marks, or red circles that insult viewer intelligence",
      "sensationalist claims unsupported by the content",
    ],
  },
  bold_graphic_design: {
    id: "bold_graphic_design",
    label: "Bold Graphic Design",
    description: "Graphic-first visual communication using strong typographic hierarchy, disciplined geometric framing, and intentional color blocking.",
    best_for_formats: ["tutorial", "coding", "tech_explainer", "educational", "productivity"],
    emotional_tones: ["clarity", "confidence", "energy", "focus"],
    visual_language: "flat or semi-flat graphic design with intentional geometric shapes and vector discipline",
    composition_intent: "grid-aligned visual hierarchy balancing large typographic anchor with clean iconography",
    typography_intent: "dominant geometric sans-serif with crisp tracking",
    palette_intent: "controlled 2-to-3 color brand palette with strong WCAG contrast",
    common_risks: [
      "dated 3D bevels, glossy emboss, or neon drop-shadow slop",
      "visual chaos from too many competing shapes",
    ],
  },
  product_focused: {
    id: "product_focused",
    label: "Product-Focused",
    description: "Accurate, recognizable product presentation with subordinate background and truthful comparison framing for reviews and tech demos.",
    best_for_formats: ["product_review", "hardware_comparison", "unboxing", "gear_guide", "commerce"],
    emotional_tones: ["objectivity", "excitement", "practical_utility", "scrutiny"],
    visual_language: "crisp studio-grade or natural in-hand hero perspective showing authentic hardware texture",
    composition_intent: "isolated or three-quarter hero angle with product at center-right; background softly blurred",
    typography_intent: "clean technical sans-serif with short model moniker or key question",
    palette_intent: "clean neutral backdrop allowing product finishes to pop",
    common_risks: [
      "exaggerated fictional hardware features or misleading comparison cues",
      "cluttered spec badges that destroy mobile feed legibility",
    ],
  },
  typographic_led: {
    id: "typographic_led",
    label: "Typographic-Led",
    description: "The headline or core phrase is the dominant visual hook. Supporting imagery is minimal and strictly subordinate to the statement.",
    best_for_formats: ["opinion", "manifesto", "podcast", "motivational", "thought_leadership"],
    emotional_tones: ["provocation", "conviction", "urgency", "directness"],
    visual_language: "bold typography integrated into a minimalist or textured photographic backdrop",
    composition_intent: "large headline anchoring 50-60% of canvas; single minimal visual anchor in remaining space",
    typography_intent: "extra-bold display typography with precise line-height and letter-spacing",
    palette_intent: "high-contrast binary or stark 2-color scheme",
    common_risks: [
      "text collision with busy photographic elements",
      "multiple competing headlines or inconsistent font weights",
    ],
  },
};

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
 * Loads and parses `config/creative_direction_presets.yaml` without external dependencies.
 */
export function loadCreativeDirectionPresets(): Record<
  CreativeDirectionFamilyId,
  CreativeDirectionFamilyConfig
> {
  if (cachedCreativePresets) return cachedCreativePresets;
  if (!fs.existsSync(CREATIVE_PRESETS_PATH)) {
    cachedCreativePresets = DEFAULT_CREATIVE_FAMILIES;
    return cachedCreativePresets;
  }

  try {
    const raw = fs.readFileSync(CREATIVE_PRESETS_PATH, "utf8");
    const families: Partial<Record<CreativeDirectionFamilyId, CreativeDirectionFamilyConfig>> = {};
    let currentId: CreativeDirectionFamilyId | null = null;
    let currentField: string | null = null;

    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (!line || line.trim().startsWith("#")) continue;

      const familyMatch = line.match(/^\s{2}([a-z_]+):\s*$/);
      if (familyMatch && familyMatch[1] in DEFAULT_CREATIVE_FAMILIES) {
        currentId = familyMatch[1] as CreativeDirectionFamilyId;
        families[currentId] = {
          ...DEFAULT_CREATIVE_FAMILIES[currentId],
          best_for_formats: [],
          emotional_tones: [],
          common_risks: [],
        };
        currentField = null;
        continue;
      }

      if (!currentId || !families[currentId]) continue;

      const arrayItemMatch = line.match(/^\s{4,8}-\s*["']?([^"'#]+)["']?\s*$/);
      if (arrayItemMatch && currentField) {
        const item = arrayItemMatch[1].trim();
        if (currentField === "best_for_formats") {
          families[currentId]!.best_for_formats.push(item);
        } else if (currentField === "emotional_tones") {
          families[currentId]!.emotional_tones.push(item);
        } else if (currentField === "common_risks") {
          families[currentId]!.common_risks.push(item);
        }
        continue;
      }

      const kvMatch = line.match(/^\s{4}([a-z_]+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim().replace(/^["']|["']$/g, "");
        if (
          key === "best_for_formats" ||
          key === "emotional_tones" ||
          key === "common_risks"
        ) {
          currentField = key;
        } else {
          currentField = null;
          if (key === "id") families[currentId]!.id = val as CreativeDirectionFamilyId;
          else if (key === "label") families[currentId]!.label = val;
          else if (key === "description") families[currentId]!.description = val;
          else if (key === "visual_language") families[currentId]!.visual_language = val;
          else if (key === "composition_intent") families[currentId]!.composition_intent = val;
          else if (key === "typography_intent") families[currentId]!.typography_intent = val;
          else if (key === "palette_intent") families[currentId]!.palette_intent = val;
        }
      }
    }

    // Fill missing arrays with default fallback
    for (const id of Object.keys(DEFAULT_CREATIVE_FAMILIES) as CreativeDirectionFamilyId[]) {
      if (!families[id]) {
        families[id] = DEFAULT_CREATIVE_FAMILIES[id];
      } else {
        if (!families[id]!.best_for_formats.length)
          families[id]!.best_for_formats = DEFAULT_CREATIVE_FAMILIES[id].best_for_formats;
        if (!families[id]!.emotional_tones.length)
          families[id]!.emotional_tones = DEFAULT_CREATIVE_FAMILIES[id].emotional_tones;
        if (!families[id]!.common_risks.length)
          families[id]!.common_risks = DEFAULT_CREATIVE_FAMILIES[id].common_risks;
      }
    }

    cachedCreativePresets = families as Record<
      CreativeDirectionFamilyId,
      CreativeDirectionFamilyConfig
    >;
    return cachedCreativePresets;
  } catch {
    cachedCreativePresets = DEFAULT_CREATIVE_FAMILIES;
    return cachedCreativePresets;
  }
}

/**
 * Loads `config/design_qa_config.yaml` without external dependencies.
 */
export function loadDesignQaConfig(): {
  version: string;
  design_qa: {
    mode: "shadow" | "enforce";
    schema_version: string;
    thresholds: Record<string, number | null>;
    max_automatic_image_retries: number;
    require_evidence_for_blocking_flags: boolean;
  };
  creative_direction: {
    enabled: boolean;
    allow_user_style_override: boolean;
    avoid_repeated_direction_when_unjustified: boolean;
    preserve_user_intent: boolean;
  };
} {
  if (cachedDesignQaConfig) return cachedDesignQaConfig;
  const defaultConfig = {
    version: "1.0",
    design_qa: {
      mode: "shadow" as "shadow" | "enforce",
      schema_version: "1.0",
      thresholds: {
        content_specificity: null,
        concept_strength: null,
        composition_hierarchy: null,
        typography_layout: null,
        visual_relevance: null,
        originality: null,
        restraint: null,
        small_size_readability: null,
        truthfulness: null,
      },
      max_automatic_image_retries: 1,
      require_evidence_for_blocking_flags: true,
    },
    creative_direction: {
      enabled: true,
      allow_user_style_override: true,
      avoid_repeated_direction_when_unjustified: true,
      preserve_user_intent: true,
    },
  };

  if (!fs.existsSync(DESIGN_QA_CONFIG_PATH)) {
    cachedDesignQaConfig = defaultConfig;
    return cachedDesignQaConfig;
  }

  try {
    const raw = fs.readFileSync(DESIGN_QA_CONFIG_PATH, "utf8");
    const modeMatch = raw.match(/mode:\s*["']?(shadow|enforce)["']?/i);
    if (modeMatch && modeMatch[1]) {
      defaultConfig.design_qa.mode = modeMatch[1].toLowerCase() as "shadow" | "enforce";
    }
    cachedDesignQaConfig = defaultConfig;
    return cachedDesignQaConfig;
  } catch {
    cachedDesignQaConfig = defaultConfig;
    return cachedDesignQaConfig;
  }
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
 * Validates that an unknown object conforms to the `ContentBrief` JSON schema (Section 10B.4 Stage 1).
 */
export function validateContentBrief(
  candidate: unknown
): { valid: boolean; errors: string[]; brief?: ContentBrief } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, errors: ["ContentBrief must be a non-null JSON object"] };
  }
  const obj = candidate as Record<string, any>;
  const requiredFields = [
    "topic",
    "specific_story",
    "audience",
    "viewer_curiosity",
    "emotional_tone",
    "content_format",
    "platform_preset",
  ];
  for (const field of requiredFields) {
    if (typeof obj[field] !== "string" || !obj[field].trim()) {
      errors.push(`Missing or empty ContentBrief field '${field}'`);
    }
  }

  if (
    !Array.isArray(obj.must_show) ||
    !obj.must_show.every((x: unknown) => typeof x === "string")
  ) {
    errors.push("ContentBrief 'must_show' must be an array of strings");
  }

  if (
    !Array.isArray(obj.must_not_imply) ||
    !obj.must_not_imply.every((x: unknown) => typeof x === "string")
  ) {
    errors.push("ContentBrief 'must_not_imply' must be an array of strings");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    brief: obj as ContentBrief,
  };
}

/**
 * Validates that an unknown object conforms to the `CreativeDirection` JSON schema (Section 10B.4 Stage 2).
 */
export function validateCreativeDirection(
  candidate: unknown
): { valid: boolean; errors: string[]; direction?: CreativeDirection } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, errors: ["CreativeDirection must be a non-null JSON object"] };
  }
  const obj = candidate as Record<string, any>;
  const validFamilies: CreativeDirectionFamilyId[] = [
    "editorial_photography",
    "documentary_storytelling",
    "investigative_editorial",
    "bold_graphic_design",
    "product_focused",
    "typographic_led",
  ];

  if (!validFamilies.includes(obj.family_id)) {
    errors.push(
      `Invalid 'family_id': '${obj.family_id}'. Must be one of ${validFamilies.join(", ")}`
    );
  }

  const requiredStrings = [
    "concept_name",
    "visual_thesis",
    "story_device",
    "primary_subject",
    "emotional_tone",
    "visual_language",
    "composition_intent",
    "typography_intent",
    "palette_intent",
    "why_this_fits",
  ];
  for (const field of requiredStrings) {
    if (typeof obj[field] !== "string" || !obj[field].trim()) {
      errors.push(`Missing or empty CreativeDirection field '${field}'`);
    }
  }

  if (!Array.isArray(obj.risks) || !obj.risks.every((x: unknown) => typeof x === "string")) {
    errors.push("CreativeDirection 'risks' must be an array of strings");
  }

  if (typeof obj.user_override_applied !== "boolean") {
    errors.push("CreativeDirection 'user_override_applied' must be a boolean");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    direction: obj as CreativeDirection,
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

/**
 * Section 10B.4 Stage 1: Content Understanding Engine
 * Converts user prompt, title, and assets into a structured ContentBrief.
 * Protects truthfulness: vague prompts produce conservative briefs rather than hallucinated facts.
 */
export function extractContentBrief(input: BriefCompilerInput): ContentBrief {
  const prompt = input.userPrompt.trim();
  const title = input.titleText?.trim() || "";
  const combined = `${prompt} ${title}`.toLowerCase();

  // Extract core topic
  let topic = prompt;
  if (prompt.includes(":")) {
    topic = prompt.split(":")[0].trim();
  } else if (prompt.includes("—")) {
    topic = prompt.split("—")[0].trim();
  } else if (prompt.includes(" - ")) {
    topic = prompt.split(" - ")[0].trim();
  }

  // Check if prompt is too brief/vague (<= 2 significant words)
  const words = prompt.split(/\s+/).filter((w) => w.length > 2);
  const isVaguePrompt = words.length <= 2;

  // Detect format based on content cues
  let contentFormat = "general";
  if (
    /(\b)(review|vs|versus|comparison|unboxing|specs|teardown|benchmark|buy or pass|hands-on)(\b)/i.test(
      combined
    ) ||
    /(\b)(iphone|macbook|gpu|laptop|gadget|camera|pixel)(\b)/i.test(combined)
  ) {
    contentFormat = "product_review";
  } else if (
    /(\b)(opinion|why i quit|why i am quitting|why i'm quitting|why i left|why i stopped|stop doing|hot take|manifesto|my thoughts|honest thoughts|reaction|rant)(\b)/i.test(
      combined
    )
  ) {
    contentFormat = "commentary";
  } else if (
    /(\b)(how to|tutorial|guide|tips|learn|course|building|code|programming|masterclass|step by step|architecture)(\b)/i.test(
      combined
    )
  ) {
    contentFormat = "tutorial";
  } else if (
    /(\b)(documentary|history|journey|expedition|story of|rise and fall|lost city|archaeology|survival|in the wild)(\b)/i.test(
      combined
    )
  ) {
    contentFormat = "documentary";
  } else if (
    /(\b)(why|exposed|truth about|collapse|investigation|scam|how it failed|fall of|secret behind|leak|deep dive)(\b)/i.test(
      combined
    )
  ) {
    contentFormat = "investigation";
  }

  // Audience & curiosity tailoring
  let audience = "General YouTube audience interested in engaging visual content";
  let viewerCuriosity = "Understanding the key insight or visual subject";
  let emotionalTone = "curiosity and authenticity";

  if (contentFormat === "product_review") {
    audience = "Consumers, buyers, and tech enthusiasts seeking an honest verdict";
    viewerCuriosity = "Whether the item delivers on its claims or has critical deal-breaking flaws";
    emotionalTone = "scrutiny and objective evaluation";
  } else if (contentFormat === "investigation") {
    audience = "Curious viewers seeking the hidden story, mechanics, and evidence";
    viewerCuriosity = "The specific hidden reasons and verifiable evidence behind the outcome";
    emotionalTone = "analytical curiosity and revelation";
  } else if (contentFormat === "documentary") {
    audience = "Enthusiasts of history, real-world events, and human stories";
    viewerCuriosity = "The authentic reality, human stakes, and historical truth of the event";
    emotionalTone = "wonder and historical gravity";
  } else if (contentFormat === "tutorial") {
    audience = "Learners and practitioners seeking actionable skills and clarity";
    viewerCuriosity = "Actionable techniques and clear mental models that save time";
    emotionalTone = "clarity and focus";
  } else if (contentFormat === "commentary") {
    audience = "Followers interested in strong perspectives and industry debate";
    viewerCuriosity = "A distinctive, honest perspective challenging a common assumption";
    emotionalTone = "provocation and conviction";
  }

  let specificStory: string;
  const mustNotImply: string[] = [
    "unsupported events or fictional claims not stated by the creator",
    "unmotivated stock poster clichés, decorative particles, or exaggerated shocked gasps",
  ];

  if (isVaguePrompt) {
    specificStory = `Focused, truthful visual overview of ${topic} emphasizing clean visual hierarchy without inventing unverified events or claims.`;
    mustNotImply.push(
      "unverified statistics, fake scandals, fabricated arrests, or fake evidence"
    );
  } else {
    specificStory = `Exploration of ${prompt} focusing on authentic scene-specific evidence and clear focal hierarchy.`;
    mustNotImply.push("sensationalized facial reactions disconnected from the subject");
  }

  const mustShow: string[] = [topic];
  if (input.hasReferenceImage) {
    mustShow.push("reference subject with authentic facial structure and bone geometry");
  }

  const baseBrief: ContentBrief = {
    topic,
    specific_story: specificStory,
    audience,
    viewer_curiosity: viewerCuriosity,
    emotional_tone: emotionalTone,
    content_format: contentFormat,
    must_show: mustShow,
    must_not_imply: mustNotImply,
    title_text: title || undefined,
    platform_preset: input.platformPreset || "youtube_video",
    reference_assets: input.hasReferenceImage ? ["user_reference_image"] : undefined,
    truthfulness_notes: isVaguePrompt
      ? [
          "Prompt is concise; conservative factual presentation applied to prevent hallucinated specifics (Section 10B.4).",
        ]
      : undefined,
  };

  if (input.contentBriefOverride) {
    return { ...baseBrief, ...input.contentBriefOverride };
  }

  return baseBrief;
}

/**
 * Section 10B.4 Stage 2: Creative Direction Selection Engine
 * Evaluates candidate directions against content format, story, and user override.
 * Uses deterministic PRNG seed for exact reproducibility.
 */
export function selectCreativeDirection(
  brief: ContentBrief,
  options?: {
    userStyleOverride?: string;
    seed?: number;
    forceFamily?: CreativeDirectionFamilyId;
  }
): CreativeDirection {
  const families = loadCreativeDirectionPresets();
  const validFamilyIds = Object.keys(families) as CreativeDirectionFamilyId[];

  let chosenFamilyId: CreativeDirectionFamilyId = "editorial_photography";
  let userOverrideApplied = false;

  // 1. Check direct forceFamily
  if (options?.forceFamily && validFamilyIds.includes(options.forceFamily)) {
    chosenFamilyId = options.forceFamily;
    userOverrideApplied = true;
  }
  // 2. Check legacy style preset override
  else if (options?.userStyleOverride) {
    const rawStyle = options.userStyleOverride.trim();
    if (rawStyle in families) {
      chosenFamilyId = rawStyle as CreativeDirectionFamilyId;
      userOverrideApplied = true;
    } else if (rawStyle === "product_focus") {
      chosenFamilyId = "product_focused";
      userOverrideApplied = true;
    } else if (rawStyle === "bold_graphic") {
      chosenFamilyId = "bold_graphic_design";
      userOverrideApplied = true;
    } else if (rawStyle === "typographic_led") {
      chosenFamilyId = "typographic_led";
      userOverrideApplied = true;
    } else if (rawStyle === "photoreal_candid" || rawStyle === "minimal_clean") {
      chosenFamilyId = "editorial_photography";
      userOverrideApplied = true;
    }
  }

  // 3. Automatic classification if no override
  if (!userOverrideApplied) {
    switch (brief.content_format) {
      case "product_review":
        chosenFamilyId = "product_focused";
        break;
      case "investigation":
        chosenFamilyId = "investigative_editorial";
        break;
      case "documentary":
        chosenFamilyId = "documentary_storytelling";
        break;
      case "tutorial":
        chosenFamilyId = "bold_graphic_design";
        break;
      case "commentary":
        chosenFamilyId = "typographic_led";
        break;
      default: {
        const seed = options?.seed ?? 104729;
        const rng = createSeededRng(seed);
        const fallbackFamilies: CreativeDirectionFamilyId[] = [
          "editorial_photography",
          "documentary_storytelling",
          "bold_graphic_design",
        ];
        chosenFamilyId = fallbackFamilies[Math.floor(rng() * fallbackFamilies.length)];
        break;
      }
    }
  }

  const familyConfig = families[chosenFamilyId] || DEFAULT_CREATIVE_FAMILIES.editorial_photography;

  // Synthesize concept thesis and story device
  let storyDevice = "Single high-contrast subject anchor with clean negative space";
  if (chosenFamilyId === "product_focused") {
    storyDevice = "Hero product angle highlighting authentic material finish and real-world scale";
  } else if (chosenFamilyId === "investigative_editorial") {
    storyDevice = "Evidentiary object or stark juxtaposition representing the core question";
  } else if (chosenFamilyId === "documentary_storytelling") {
    storyDevice = "Context-rich environmental setting providing historical and authentic gravity";
  } else if (chosenFamilyId === "bold_graphic_design") {
    storyDevice = "Disciplined geometric framing balancing typographic anchor with clean vector clarity";
  } else if (chosenFamilyId === "typographic_led") {
    storyDevice = "Dominant high-contrast typography anchoring the hook with minimal secondary visual";
  }

  const visualThesis = stripSlopFromCompilerFragment(
    `A disciplined ${familyConfig.label} composition for "${brief.topic}", using a ${storyDevice.toLowerCase()} with strict negative space discipline.`
  );

  const direction: CreativeDirection = {
    concept_name: `${familyConfig.label}: ${brief.topic.slice(0, 32)}`,
    family_id: chosenFamilyId,
    visual_thesis: visualThesis,
    story_device: storyDevice,
    primary_subject: brief.must_show[0] || brief.topic,
    supporting_element: brief.must_show.length > 1 ? brief.must_show[1] : undefined,
    emotional_tone: brief.emotional_tone,
    visual_language: stripSlopFromCompilerFragment(familyConfig.visual_language),
    composition_intent: stripSlopFromCompilerFragment(familyConfig.composition_intent),
    typography_intent: stripSlopFromCompilerFragment(familyConfig.typography_intent),
    palette_intent: stripSlopFromCompilerFragment(familyConfig.palette_intent),
    why_this_fits: `Selected for ${brief.content_format} format covering "${brief.topic}" with ${familyConfig.label} framing.`,
    risks: familyConfig.common_risks,
    user_override_applied: userOverrideApplied,
  };

  return direction;
}

function synthesizeDeterministicBrief(
  input: BriefCompilerInput,
  preset: StylePresetConfig,
  seed: number,
  contentBrief: ContentBrief,
  creativeDirection: CreativeDirection
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
    `CREATIVE_DIRECTION: family=${creativeDirection.family_id}, thesis=${stripSlopFromCompilerFragment(
      creativeDirection.visual_thesis
    )}`,
    `COMPOSITION_INTENT: ${stripSlopFromCompilerFragment(creativeDirection.composition_intent)}`,
    `TRUTHFULNESS: avoid ${contentBrief.must_not_imply.join(", ")}`,
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
 * Compiles a user prompt + style/platform presets into a validated `StructuredBrief`,
 * `ContentBrief`, `CreativeDirection`, and deterministic final prompt string (Section 10A.2 & 10B).
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

  // Stage 1: Content Understanding
  const contentBrief = extractContentBrief(input);

  // Stage 2: Creative Direction Selection Engine
  const creativeDirection = selectCreativeDirection(contentBrief, {
    userStyleOverride: typeof input.stylePreset === "string" ? input.stylePreset : undefined,
    forceFamily: input.forceCreativeFamily || input.creativeDirectionFamily,
    seed: seedUsed,
  });

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
    validatedBrief = synthesizeDeterministicBrief(
      input,
      presetCfg,
      seedUsed,
      contentBrief,
      creativeDirection
    );
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
    contentBrief,
    creativeDirection,
    finalPrompt: promptParts.join(" "),
    negativePrompt,
    seedUsed,
    stylePresetUsed,
    llmAttempts,
    usedFallbackSynthesis,
  };
}
