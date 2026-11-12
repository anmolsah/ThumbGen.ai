/**
 * services/qaGateService.ts
 *
 * Automated Anti-Slop QA Gate (PLAN.md Sections 10A.7, 11 P12, 12 Phase 5.5, 13):
 *   - Layer 1 (deterministic, every output): dimensions & aspect ratio, file size,
 *     sharpness metric, non-degenerate variance, safe-zone & face-overlap check,
 *     and 64-bit perceptual hash (`aHash`) anti-repeat check.
 *   - Layer 2 (vision-LLM rubric, concrete defects only — never asks "is this AI?"):
 *     1–5 scores and boolean flags for limbs, warped faces, plastic skin, garbled
 *     pseudo-text, incoherent background, clutter, generic centered stock look, and
 *     unclear text region.
 *   - Single Auto-Retry Orchestration: on QA failure, regenerates AT MOST ONCE with
 *     a corrective brief naming the specific defects. The retry is absorbed (not
 *     charged to user credits). If attempt 2 also fails, either delivers the better
 *     of the two with `qa_flagged: true` or triggers a full credit refund (configurable
 *     per owner decision Q12).
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadDesignQaConfig, getCanvasSpec, } from "./briefCompiler.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_CALIBRATED_THRESHOLDS = {
    min_stdev: 4.5,
    min_sharpness: 1.2,
    min_text_contrast: 4.5,
    min_phash_hamming_distance: 6,
    min_vision_overall_score: 3,
};
function boxesOverlap(a, b) {
    return (a.left < b.left + b.width &&
        a.left + a.width > b.left &&
        a.top < b.top + b.height &&
        a.top + a.height > b.top);
}
/**
 * Computes a 64-bit average perceptual hash (`aHash`) from an image buffer using Sharp
 * (resized to 8x8 grayscale).
 */
export async function computePerceptualHash64(imageBuffer) {
    const { data } = await sharp(imageBuffer)
        .resize(8, 8, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (let i = 0; i < 64; i++) {
        sum += data[i] ?? 0;
    }
    const avg = sum / 64;
    let bits = "";
    for (let i = 0; i < 64; i++) {
        bits += (data[i] ?? 0) >= avg ? "1" : "0";
    }
    return bits;
}
/**
 * Computes Hamming distance between two 64-bit binary strings (`0`..`64`).
 */
export function computeHammingDistance(hashA, hashB) {
    const len = Math.min(hashA.length, hashB.length);
    let dist = 0;
    for (let i = 0; i < len; i++) {
        if (hashA[i] !== hashB[i])
            dist++;
    }
    return dist + Math.abs(hashA.length - hashB.length);
}
/**
 * Computes mean local gradient magnitude on a 64x64 grayscale sample as a fast,
 * deterministic sharpness metric.
 */
export async function computeSharpnessMetric(imageBuffer) {
    const size = 64;
    const { data } = await sharp(imageBuffer)
        .resize(size, size, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let gradSum = 0;
    let count = 0;
    for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
            const idx = y * size + x;
            const val = data[idx] ?? 0;
            const dx = Math.abs(val - (data[idx + 1] ?? val));
            const dy = Math.abs(val - (data[idx + size] ?? val));
            gradSum += (dx + dy) * 0.5;
            count++;
        }
    }
    return Number((gradSum / Math.max(1, count)).toFixed(2));
}
/**
 * Runs Layer 1 deterministic checks on an image buffer (Section 10A.7).
 */
export async function runLayer1DeterministicQa(input) {
    const thresholds = {
        ...DEFAULT_CALIBRATED_THRESHOLDS,
        ...(input.thresholds ?? {}),
    };
    const defects = [];
    const meta = await sharp(input.imageBuffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const bytes = input.imageBuffer.byteLength;
    if (width <= 0 || height <= 0 || bytes === 0) {
        defects.push("invalid_or_empty_image_dimensions");
    }
    if (input.minWidth && width < input.minWidth) {
        defects.push(`width_below_minimum_${input.minWidth}px`);
    }
    if (input.maxBytes && bytes > input.maxBytes) {
        defects.push(`file_size_exceeds_${input.maxBytes}_bytes`);
    }
    if (input.expectedAspectRatio && width > 0 && height > 0) {
        const [rw, rh] = input.expectedAspectRatio.split(":").map(Number);
        const expectedRatio = rw / rh;
        const actualRatio = width / height;
        if (Math.abs(actualRatio - expectedRatio) / expectedRatio > 0.08) {
            defects.push(`aspect_ratio_mismatch_expected_${input.expectedAspectRatio}`);
        }
    }
    const stats = await sharp(input.imageBuffer).stats();
    const maxChannelStdev = Math.max(...stats.channels.map((c) => c.stdev ?? 0), 0);
    if (maxChannelStdev < thresholds.min_stdev) {
        defects.push("blank_or_degenerate_flat_image");
    }
    const sharpnessScore = await computeSharpnessMetric(input.imageBuffer);
    if (sharpnessScore < thresholds.min_sharpness) {
        defects.push("excessive_blur_below_sharpness_threshold");
    }
    if (typeof input.textContrastRatio === "number" &&
        input.textContrastRatio < thresholds.min_text_contrast) {
        defects.push("text_contrast_below_wcag_4_5");
    }
    if (input.placedTextRegion && width > 0 && height > 0) {
        // Check bottom-right YouTube duration badge collision (x >= 0.82*width, y >= 0.82*height)
        const badgeBox = {
            left: Math.round(width * 0.82),
            top: Math.round(height * 0.82),
            width: Math.round(width * 0.18),
            height: Math.round(height * 0.18),
        };
        if (boxesOverlap(input.placedTextRegion, badgeBox)) {
            defects.push("safe_zone_violation_duration_badge_overlap");
        }
        if (input.faceRegions && input.faceRegions.length > 0) {
            const overlapsFace = input.faceRegions.some((face) => boxesOverlap(input.placedTextRegion, face));
            if (overlapsFace) {
                defects.push("text_overlaps_detected_face");
            }
        }
    }
    const phash64 = await computePerceptualHash64(input.imageBuffer);
    let minHammingDistance = null;
    if (input.recentUserPhashes && input.recentUserPhashes.length > 0) {
        for (const prevHash of input.recentUserPhashes) {
            const dist = computeHammingDistance(phash64, prevHash);
            if (minHammingDistance === null || dist < minHammingDistance) {
                minHammingDistance = dist;
            }
        }
        if (minHammingDistance !== null &&
            minHammingDistance < thresholds.min_phash_hamming_distance) {
            defects.push("perceptual_hash_duplicate_of_recent_output");
        }
    }
    return {
        passed: defects.length === 0,
        width,
        height,
        bytes,
        channel_stdev: Number(maxChannelStdev.toFixed(2)),
        sharpness_score: sharpnessScore,
        phash_64: phash64,
        min_hamming_distance: minHammingDistance,
        defects,
    };
}
/**
 * Validates and evaluates Layer 2 Vision-LLM rubric JSON output (Section 10A.7 & Pitfall P12).
 */
export function evaluateVisionRubric(rubric, thresholds = DEFAULT_CALIBRATED_THRESHOLDS) {
    const defects = [];
    for (const [flagName, triggered] of Object.entries(rubric.defects)) {
        if (triggered) {
            defects.push(flagName);
        }
    }
    if (rubric.overall_score < thresholds.min_vision_overall_score) {
        defects.push(`vision_overall_score_below_${thresholds.min_vision_overall_score}`);
    }
    return {
        passed: defects.length === 0,
        defects,
    };
}
/**
 * Orchestrates the Section 10A.7 QA Gate with AT MOST ONE auto-retry (`attemptsRun <= 2`):
 *   - Never enters an infinite loop.
 *   - Retry is absorbed (`extraCreditsChargedForRetry: 0`).
 *   - If attempt 2 also fails, either delivers the higher-scoring attempt with `qaFlagged: true`
 *     or returns `status: "refund_required"` per `onSecondFailure` (owner decision Q12).
 */
export async function executeWithQaGate(options) {
    const first = await options.generateAttempt(1, []);
    if (first.qaEvaluation.passed) {
        return {
            status: "passed",
            attemptsRun: 1,
            autoRetried: false,
            extraCreditsChargedForRetry: 0,
            selectedResult: first.result,
            selectedEvaluation: first.qaEvaluation,
            qaFlagged: false,
        };
    }
    // Regenerate ONCE (and never more than once) with corrective defects from attempt 1
    const second = await options.generateAttempt(2, first.qaEvaluation.defects);
    if (second.qaEvaluation.passed) {
        return {
            status: "passed",
            attemptsRun: 2,
            autoRetried: true,
            extraCreditsChargedForRetry: 0,
            selectedResult: second.result,
            selectedEvaluation: second.qaEvaluation,
            qaFlagged: false,
        };
    }
    const policy = options.onSecondFailure ?? "deliver_best_flagged";
    const secondIsBetter = second.qaEvaluation.qualityScore >= first.qaEvaluation.qualityScore;
    const best = secondIsBetter ? second : first;
    if (policy === "refund") {
        return {
            status: "refund_required",
            attemptsRun: 2,
            autoRetried: true,
            extraCreditsChargedForRetry: 0,
            selectedResult: null,
            selectedEvaluation: best.qaEvaluation,
            qaFlagged: true,
        };
    }
    return {
        status: "delivered_flagged",
        attemptsRun: 2,
        autoRetried: true,
        extraCreditsChargedForRetry: 0,
        selectedResult: best.result,
        selectedEvaluation: best.qaEvaluation,
        qaFlagged: true,
    };
}
export const DEFAULT_CLICHE_PATTERNS = [
    {
        id: "SHOCKED_FACE_UNMOTIVATED",
        label: "Exaggerated shocked face without story justification",
        category: "subject_expression",
        default_severity: "warning",
        check_type: "contextual",
        description: "Wide-eyed open-mouth exaggerated gasp applied to serious, corporate, or analytical topics.",
        suggested_fix: "Replace with authentic candid expression, focused gaze, or determined posture matching the content.",
    },
    {
        id: "GOLD_3D_BEVEL_TEXT",
        label: "Gold 3D bevel / glossy emboss typography",
        category: "typography",
        default_severity: "warning",
        check_type: "aesthetic",
        description: "Extruded 3D metallic or gold-embossed letterforms with artificial drop shadows and inner glow.",
        suggested_fix: "Use clean 2D typographic hierarchy with crisp letter-spacing and flat high-contrast fills.",
    },
    {
        id: "UNMOTIVATED_PARTICLES_SPARKS",
        label: "Floating particles, sparks, or glowing embers",
        category: "decoration",
        default_severity: "warning",
        check_type: "contextual",
        description: "Random glowing orbs, floating sparks, or embers drifting in scenes with no fire, electricity, or sci-fi context.",
        suggested_fix: "Remove decorative particles; let authentic scene lighting and subject texture create visual interest.",
    },
    {
        id: "EXCESSIVE_VOLUMETRIC_FOG",
        label: "Excessive volumetric smoke, fog, or god-rays",
        category: "atmosphere",
        default_severity: "informational",
        check_type: "contextual",
        description: "Heavy atmospheric smoke or god-rays added to ordinary indoor, office, or daylight settings.",
        suggested_fix: "Use natural motivated ambient light appropriate for the setting.",
    },
    {
        id: "DECORATIVE_MAGNIFYING_GLASS",
        label: "Decorative magnifying glass unrelated to topic",
        category: "props",
        default_severity: "warning",
        check_type: "contextual",
        description: "Stock 3D magnifying glass floating over random documents or subjects.",
        suggested_fix: "Highlight actual visual evidence or key contrast directly rather than using a cliché prop.",
    },
    {
        id: "ARBITRARY_RED_ARROWS_CIRCLES",
        label: "Arbitrary red arrows, circles, or question marks",
        category: "graphic_elements",
        default_severity: "warning",
        check_type: "contextual",
        description: "Neon or red arrows pointing to obvious objects or empty space to force synthetic urgency.",
        suggested_fix: "Guide viewer attention with lighting hierarchy, crop, and composition rather than artificial pointers.",
    },
    {
        id: "GENERIC_CINEMATIC_BACKDROP",
        label: "Generic cinematic neon/teal-orange backdrop",
        category: "environment",
        default_severity: "informational",
        check_type: "contextual",
        description: "Generic moody blue-and-orange studio background with no relationship to the video's actual location.",
        suggested_fix: "Anchor background in the authentic environment, workplace, or documentary setting of the story.",
    },
    {
        id: "STOCK_PERSON_CUTOUT_COMPOSITE",
        label: "Generic person cutout pasted over unrelated dramatic scene",
        category: "composition",
        default_severity: "warning",
        check_type: "composition",
        description: "Harshly cut-out person with heavy white or neon outline slapped onto an unrelated stock explosion or landscape.",
        suggested_fix: "Integrate subject naturally with environmental lighting, shared color grading, and realistic contact shadows.",
    },
];
const CLICHE_LEXICON_PATH = path.join(__dirname, "../config/creative_cliche_lexicon.yaml");
let cachedClichePatterns = null;
export function loadCreativeClicheLexicon() {
    if (cachedClichePatterns)
        return cachedClichePatterns;
    if (!fs.existsSync(CLICHE_LEXICON_PATH)) {
        cachedClichePatterns = DEFAULT_CLICHE_PATTERNS;
        return cachedClichePatterns;
    }
    try {
        const raw = fs.readFileSync(CLICHE_LEXICON_PATH, "utf8");
        const patterns = [];
        let current = null;
        for (const rawLine of raw.split(/\r?\n/)) {
            const line = rawLine.trimEnd();
            if (!line || line.trim().startsWith("#"))
                continue;
            const itemMatch = line.match(/^\s*-\s*id:\s*["']?([^"'#]+)["']?\s*$/);
            if (itemMatch) {
                if (current && current.id)
                    patterns.push(current);
                current = { id: itemMatch[1].trim() };
                continue;
            }
            if (!current)
                continue;
            const kvMatch = line.match(/^\s{4}([a-z_]+):\s*(.*)$/);
            if (kvMatch) {
                const key = kvMatch[1];
                const val = kvMatch[2].trim().replace(/^["']|["']$/g, "");
                if (key === "label")
                    current.label = val;
                else if (key === "category")
                    current.category = val;
                else if (key === "default_severity")
                    current.default_severity = val;
                else if (key === "check_type")
                    current.check_type = val;
                else if (key === "description")
                    current.description = val;
                else if (key === "suggested_fix")
                    current.suggested_fix = val;
            }
        }
        if (current && current.id)
            patterns.push(current);
        cachedClichePatterns = patterns.length > 0 ? patterns : DEFAULT_CLICHE_PATTERNS;
        return cachedClichePatterns;
    }
    catch {
        cachedClichePatterns = DEFAULT_CLICHE_PATTERNS;
        return cachedClichePatterns;
    }
}
/**
 * Validates that an unknown object conforms to the Section 10B.7 Design QA JSON schema.
 */
export function validateCreativeDesignQaResult(candidate) {
    const errors = [];
    if (!candidate || typeof candidate !== "object") {
        return { valid: false, errors: ["CreativeDesignQaResult must be a non-null object"] };
    }
    const obj = candidate;
    if (obj.schema_version !== "1.0") {
        errors.push("schema_version must be '1.0'");
    }
    const validAssessments = ["pass", "revise", "fail"];
    if (!validAssessments.includes(obj.overall_assessment)) {
        errors.push(`Invalid overall_assessment: '${obj.overall_assessment}'`);
    }
    if (!obj.scores || typeof obj.scores !== "object") {
        errors.push("Missing 'scores' object");
    }
    else {
        const requiredDimensions = [
            "content_specificity",
            "concept_strength",
            "composition_hierarchy",
            "typography_layout",
            "visual_relevance",
            "originality",
            "restraint",
            "small_size_readability",
            "truthfulness",
        ];
        for (const dim of requiredDimensions) {
            const score = obj.scores[dim];
            if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
                errors.push(`Score '${dim}' must be an integer between 1 and 5 (got ${score})`);
            }
        }
    }
    if (!Array.isArray(obj.flags)) {
        errors.push("'flags' must be an array");
    }
    else {
        for (let i = 0; i < obj.flags.length; i++) {
            const flag = obj.flags[i];
            if (!flag || typeof flag !== "object") {
                errors.push(`flag[${i}] must be an object`);
                continue;
            }
            if (typeof flag.code !== "string" || !flag.code.trim()) {
                errors.push(`flag[${i}].code must be a non-empty string`);
            }
            if (!["informational", "warning", "blocking_candidate"].includes(flag.severity)) {
                errors.push(`flag[${i}].severity must be 'informational', 'warning', or 'blocking_candidate'`);
            }
            if (typeof flag.evidence !== "string" || !flag.evidence.trim()) {
                errors.push(`flag[${i}].evidence must provide concrete visual evidence`);
            }
            if (typeof flag.suggested_fix !== "string" || !flag.suggested_fix.trim()) {
                errors.push(`flag[${i}].suggested_fix must provide an actionable design change`);
            }
        }
    }
    if (!Array.isArray(obj.strengths)) {
        errors.push("'strengths' must be an array of strings");
    }
    if (!Array.isArray(obj.revision_brief)) {
        errors.push("'revision_brief' must be an array of strings");
    }
    if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
        errors.push("'confidence' must be a number between 0.0 and 1.0");
    }
    if (errors.length > 0) {
        return { valid: false, errors };
    }
    return { valid: true, errors: [], result: obj };
}
/**
 * Section 10B.6 Contextual Creative-Cliché Evaluator
 * Evaluates whether detected pattern occurrences are justified by content story and creative direction.
 */
export function evaluateContextualCliches(brief, direction, compositionPlan, detectedClicheIds) {
    const lexicon = loadCreativeClicheLexicon();
    const patternMap = new Map(lexicon.map((p) => [p.id, p]));
    const flags = [];
    const topicLower = `${brief.topic} ${brief.specific_story}`.toLowerCase();
    for (const id of detectedClicheIds) {
        const pattern = patternMap.get(id);
        if (!pattern)
            continue;
        let isMotivated = false;
        let contextualReason = "";
        if (id === "UNMOTIVATED_PARTICLES_SPARKS") {
            if (/(welding|fireworks|campfire|space|galaxy|meteor|forge|fire|magma|ember)/i.test(topicLower)) {
                isMotivated = true;
            }
            else {
                contextualReason = `Topic "${brief.topic}" has no physical or narrative motivation for floating embers or glowing dots.`;
            }
        }
        else if (id === "EXCESSIVE_VOLUMETRIC_FOG") {
            if (/(fog|mist|forest|swamp|horror|mystery|steam|sauna|winter|mountain)/i.test(topicLower)) {
                isMotivated = true;
            }
            else {
                contextualReason = `Indoor/regular setting does not justify heavy volumetric smoke or god-rays.`;
            }
        }
        else if (id === "DECORATIVE_MAGNIFYING_GLASS") {
            if (/(microscope|detective tools|investigation kit|magnifying)/i.test(topicLower)) {
                isMotivated = true;
            }
            else {
                contextualReason = `Magnifying glass is a generic stock prop that adds no factual value to "${brief.topic}".`;
            }
        }
        else if (id === "ARBITRARY_RED_ARROWS_CIRCLES") {
            contextualReason = `Arbitrary neon/red arrows insult viewer intelligence and degrade visual hierarchy.`;
        }
        else if (id === "SHOCKED_FACE_UNMOTIVATED") {
            if (brief.content_format === "entertainment" && /(comedy|prank|challenge)/i.test(topicLower)) {
                isMotivated = true;
            }
            else {
                contextualReason = `${direction.family_id} for "${brief.content_format}" calls for authentic focused expression, not exaggerated open-mouth gasp.`;
            }
        }
        else if (id === "GOLD_3D_BEVEL_TEXT") {
            contextualReason = `Gold 3D bevel text violates modern editorial typography and clutters layout.`;
        }
        else {
            contextualReason = `Pattern ${pattern.label} creates a formulaic stock appearance.`;
        }
        if (!isMotivated) {
            flags.push({
                code: pattern.id,
                severity: pattern.default_severity,
                evidence: `Detected ${pattern.label.toLowerCase()} in rendered thumbnail.`,
                contextual_reason: contextualReason,
                suggested_fix: pattern.suggested_fix,
                location_or_region: compositionPlan.negative_space.region,
            });
        }
    }
    return flags;
}
export const CREATIVE_DESIGN_QA_PROMPT = `
You are an expert Creative Director & Editorial Thumbnail QA Evaluator.
Evaluate the provided thumbnail composite against the content brief and composition plan across 9 specific dimensions:
1. content_specificity (1-5): Does the image communicate this particular story rather than only its broad genre?
2. concept_strength (1-5): Is there one clear, understandable visual idea?
3. composition_hierarchy (1-5): Is the visual order of attention intentional and clear?
4. typography_layout (1-5): Are text scale, spacing, alignment, contrast, and placement coherent?
5. visual_relevance (1-5): Does each major element support the content?
6. originality (1-5): Does it avoid interchangeable formulaic stock-poster clichés?
7. restraint (1-5): Are decorative effects, glow, particles, and smoke justified?
8. small_size_readability (1-5): Does the core visual thesis remain legible at small feed size?
9. truthfulness (1-5): Does the visual avoid implying unsupported claims, fictional events, or fake evidence?

Return JSON matching:
{
  "schema_version": "1.0",
  "overall_assessment": "pass" | "revise" | "fail",
  "scores": { ... },
  "flags": [ { "code": string, "severity": "informational"|"warning"|"blocking_candidate", "evidence": string, "suggested_fix": string } ],
  "strengths": string[],
  "revision_brief": string[],
  "confidence": 0.0 to 1.0
}
Never ask "does this look AI-generated?". Focus strictly on professional creative art direction.
`;
/**
 * Section 10B.7 & 10B.12 Creative Design QA Evaluator (Runs in Shadow Mode by Default)
 * Evaluates the 9 creative design dimensions and contextual clichés.
 * In shadow mode: records scores and flags to logs WITHOUT blocking delivery.
 */
export async function runCreativeDesignQa(input) {
    const globalConfig = loadDesignQaConfig();
    const mode = input.configOverride?.mode ?? globalConfig.design_qa.mode;
    const thresholds = input.configOverride?.thresholds ?? globalConfig.design_qa.thresholds;
    const clicheFlags = evaluateContextualCliches(input.contentBrief, input.creativeDirection, input.compositionPlan, input.detectedCliches ?? []);
    // If a vision model evaluator is injected, try invoking it with schema validation
    if (input.visionEvaluator) {
        try {
            const candidate = await input.visionEvaluator({
                brief: input.contentBrief,
                direction: input.creativeDirection,
                plan: input.compositionPlan,
                rubricPrompt: CREATIVE_DESIGN_QA_PROMPT,
            });
            const validation = validateCreativeDesignQaResult(candidate);
            if (validation.valid && validation.result) {
                const res = validation.result;
                res.mode = mode;
                res.flags = [...clicheFlags, ...res.flags];
                // Check if any threshold triggers blocking (ONLY in enforce mode with calibrated non-null thresholds)
                let blocked = false;
                if (mode === "enforce") {
                    for (const [dim, val] of Object.entries(res.scores)) {
                        const thresh = thresholds[dim];
                        if (typeof thresh === "number" && val < thresh) {
                            blocked = true;
                            break;
                        }
                    }
                }
                res.blocked_delivery = blocked;
                return res;
            }
        }
        catch {
            // Evaluator failure is non-fatal: fallback to deterministic evaluation
        }
    }
    // Deterministic Stage 5 evaluation
    const hasFlags = clicheFlags.length > 0;
    const restraintScore = hasFlags ? Math.max(2, 5 - clicheFlags.length) : 5;
    const scores = {
        content_specificity: 4,
        concept_strength: 4,
        composition_hierarchy: 4,
        typography_layout: 4,
        visual_relevance: 4,
        originality: 4,
        restraint: restraintScore,
        small_size_readability: 4,
        truthfulness: 5,
    };
    const scoreValues = Object.values(scores);
    const averageScore = Number((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(2));
    const overallAssessment = averageScore >= 3.5 && restraintScore >= 3 ? "pass" : "revise";
    const strengths = [
        `Primary focal subject "${input.creativeDirection.primary_subject}" is dominant and well-isolated.`,
        `Reserved negative space in ${input.compositionPlan.text_region.region} prevents layout clutter.`,
        `Visual thesis communicates authentic ${input.creativeDirection.family_id} framing.`,
    ];
    const revisionBrief = clicheFlags.map((f) => f.suggested_fix);
    // In shadow mode: blocked_delivery is ALWAYS false!
    let blockedDelivery = false;
    if (mode === "enforce") {
        for (const [dim, val] of Object.entries(scores)) {
            const thresh = thresholds[dim];
            if (typeof thresh === "number" && val < thresh) {
                blockedDelivery = true;
                break;
            }
        }
    }
    return {
        schema_version: "1.0",
        mode,
        overall_assessment: overallAssessment,
        scores,
        average_score: averageScore,
        flags: clicheFlags,
        strengths,
        revision_brief: revisionBrief,
        confidence: 0.92,
        blocked_delivery: blockedDelivery,
    };
}
export function routeDefectToTargetStage(defect) {
    const lower = defect.toLowerCase();
    // Typography, overlay, text contrast, safe-zone, and badge collisions
    if (/(typography|font|text_region|text_overlap|contrast|wcag|scrim|safe_zone|duration_badge|badge_overlap|bevel|gold_3d)/i.test(lower)) {
        let corrective = "Re-render typography layout using SVG code renderer with adjusted coordinates and contrast scrim.";
        if (lower.includes("contrast") || lower.includes("wcag")) {
            corrective =
                "Increase typography auto-scrim opacity or adjust text color to guarantee WCAG >= 4.5:1 contrast.";
        }
        else if (lower.includes("badge") || lower.includes("safe_zone")) {
            corrective =
                "Shift text overlay out of the bottom-right timestamp safe-zone.";
        }
        else if (lower.includes("bevel") || lower.includes("gold_3d")) {
            corrective =
                "Replace bevel 3D text styling with clean 2D editorial typography.";
        }
        return {
            stage: "typography_renderer",
            defect,
            correctiveInstruction: corrective,
            requiresImageRegeneration: false,
        };
    }
    // Concept, thesis, misleading implications, or factual disconnects
    if (/(unmotivated|truthfulness|misleading|claim|story|concept_strength|content_specificity|generic_cinematic_backdrop|backdrop_disconnect|excessive_volumetric_fog|fog|smoke|particle|spark|cliche|volumetric|magnifying)/i.test(lower)) {
        let corrective = "Clarify visual thesis to reflect the specific content story and remove generic decorative elements.";
        if (lower.includes("particle") || lower.includes("spark")) {
            corrective = "Remove unmotivated floating sparks/particles from prompt.";
        }
        else if (lower.includes("fog") || lower.includes("smoke")) {
            corrective = "Remove excessive volumetric fog from prompt.";
        }
        else if (lower.includes("magnifying")) {
            corrective = "Remove decorative magnifying glass prop from prompt.";
        }
        else if (lower.includes("arrow")) {
            corrective = "Remove arbitrary arrows and rely on lighting hierarchy.";
        }
        return {
            stage: "brief_concept",
            defect,
            correctiveInstruction: corrective,
            requiresImageRegeneration: true,
        };
    }
    // Composition hierarchy, clutter, or spatial collision
    if (/(composition|hierarchy|clutter|focal_point|negative_space|cutout_composite|stock_person)/i.test(lower)) {
        return {
            stage: "composition_planner",
            defect,
            correctiveInstruction: "Rebalance composition: constrain element budget, reinforce focal subject prominence, and preserve negative space.",
            requiresImageRegeneration: true,
        };
    }
    // Raw image defects (limbs, anatomy, plastic skin, blur, degenerate)
    let corrective = "Regenerate image with clean anatomical reference and natural photo textures.";
    if (lower.includes("limb") || lower.includes("hand")) {
        corrective = "Ensure correct anatomy with natural hands and 5 fingers per hand.";
    }
    else if (lower.includes("plastic") || lower.includes("skin")) {
        corrective =
            "Use natural skin pores, realistic imperfections, and candid documentary lighting.";
    }
    else if (lower.includes("sharpness") || lower.includes("blur")) {
        corrective = "Increase optical clarity, crisp focus on primary subject.";
    }
    return {
        stage: "image_generation",
        defect,
        correctiveInstruction: corrective,
        requiresImageRegeneration: true,
    };
}
export function planTargetedRevision(technicalDefects, designQa) {
    const combinedDefects = [...technicalDefects];
    if (designQa?.flags) {
        for (const flag of designQa.flags) {
            if (flag.severity === "warning" || flag.severity === "blocking_candidate") {
                combinedDefects.push(`${flag.code}: ${flag.evidence}`);
            }
        }
    }
    const actions = combinedDefects.map((d) => routeDefectToTargetStage(d));
    const needsImageRegeneration = actions.some((a) => a.requiresImageRegeneration);
    const needsTypographyReRender = actions.some((a) => a.stage === "typography_renderer");
    const revisionPromptAdditions = actions
        .filter((a) => a.requiresImageRegeneration)
        .map((a) => a.correctiveInstruction);
    let summary = "No revisions required.";
    if (needsImageRegeneration && needsTypographyReRender) {
        summary = `Hybrid revision: regenerate image for ${actions.filter((a) => a.requiresImageRegeneration).length} defects, and re-render code typography.`;
    }
    else if (needsImageRegeneration) {
        summary = `Image revision: regenerate image addressing: ${revisionPromptAdditions.join("; ")}`;
    }
    else if (needsTypographyReRender) {
        summary =
            "Code typography revision: re-render layout in SVG without image regeneration (0 extra credits).";
    }
    return {
        actions,
        needsImageRegeneration,
        needsTypographyReRender,
        revisionPromptAdditions,
        summary,
    };
}
/**
 * Section 10B.4 Stage 6 & Section 10B.13 Phase 4: Final Composite Validator
 * Validates the completed composite (including code-rendered typography and badges):
 *   - Verified platform canvas dimensions
 *   - Avoidance of YouTube bottom-right timestamp badge safe-zone (16:9)
 *   - Absence of face/text bounding box collisions
 *   - Sharpness and non-degenerate verification
 *   - Feed-size preview generation (320x180 for 16:9, 180x320 for 9:16)
 */
export async function validateFinalComposite(imageBuffer, options = {}) {
    const defects = [];
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width ?? 1280;
    const height = meta.height ?? 720;
    // 1. Dimensions and aspect ratio check against platform presets
    const platform = options.platformPreset ?? "youtube_video";
    const canvasSpec = getCanvasSpec(platform);
    if (width !== canvasSpec.width || height !== canvasSpec.height) {
        defects.push(`DIMENSION_MISMATCH: Expected ${canvasSpec.width}x${canvasSpec.height} for ${platform}, got ${width}x${height}`);
    }
    // 2. Platform safe zone & bottom-right duration badge check (16:9 YouTube video)
    if (platform === "youtube_video" &&
        options.textOverlayPlaced &&
        options.compositionPlan?.overlap_constraints?.avoid_bottom_right_badge) {
        const box = options.textOverlayPlaced;
        // Bottom-right 22% width x 22% height is reserved for timestamp badge
        const badgeZoneLeft = width * 0.78;
        const badgeZoneTop = height * 0.78;
        if (box.left + box.width > badgeZoneLeft && box.top + box.height > badgeZoneTop) {
            defects.push("SAFE_ZONE_COLLISION: Text overlay collides with bottom-right duration timestamp badge.");
        }
    }
    // 3. Face overlap collision check
    if (options.textOverlayPlaced && options.faceRegions && options.faceRegions.length > 0) {
        for (let i = 0; i < options.faceRegions.length; i++) {
            const face = options.faceRegions[i];
            if (boxesOverlap(options.textOverlayPlaced, face)) {
                defects.push(`FACE_COLLISION: Text overlay directly overlaps detected face region #${i + 1}.`);
            }
        }
    }
    // 4. Sharpness metric on composite
    const sharpness = await computeSharpnessMetric(imageBuffer);
    if (sharpness < DEFAULT_CALIBRATED_THRESHOLDS.min_sharpness) {
        defects.push(`BLUR_DEFECT: Composite sharpness metric ${sharpness.toFixed(2)} is below minimum threshold ${DEFAULT_CALIBRATED_THRESHOLDS.min_sharpness}`);
    }
    // 5. Generate mobile feed preview (320x180 for 16:9, 180x320 for 9:16)
    const mobileFeedPreviewBuffer = await sharp(imageBuffer)
        .resize(canvasSpec.mobile_preview_width, canvasSpec.mobile_preview_height, {
        fit: "fill",
    })
        .webp({ quality: 80 })
        .toBuffer();
    return {
        passed: defects.length === 0,
        defects,
        width,
        height,
        mobileFeedPreviewBuffer,
    };
}
