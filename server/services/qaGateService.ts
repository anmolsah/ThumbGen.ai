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
import type { BoundingBox } from "./postProcessService.js";

export interface CalibratedQaThresholds {
  min_stdev: number; // default calibrated: 4.5 (rejects blank/solid-color degenerate outputs)
  min_sharpness: number; // default calibrated: 1.2 (rejects extreme blur while allowing dark studio scenes)
  min_text_contrast: number; // WCAG 4.5
  min_phash_hamming_distance: number; // default calibrated: 6 bits out of 64
  min_vision_overall_score: number; // default calibrated: 3 (on 1-5 scale)
}

export const DEFAULT_CALIBRATED_THRESHOLDS: CalibratedQaThresholds = {
  min_stdev: 4.5,
  min_sharpness: 1.2,
  min_text_contrast: 4.5,
  min_phash_hamming_distance: 6,
  min_vision_overall_score: 3,
};

export interface VisionRubricResult {
  overall_score: number; // 1..5
  composition_score: number; // 1..5
  realism_score: number; // 1..5
  defects: {
    extra_or_missing_limbs: boolean;
    warped_face_or_eyes: boolean;
    plastic_skin: boolean;
    garbled_pseudo_text: boolean;
    incoherent_background: boolean;
    clutter_no_focal_point: boolean;
    generic_centered_stock_look: boolean;
    text_region_not_clear: boolean;
  };
}

export interface DeterministicQaResult {
  passed: boolean;
  width: number;
  height: number;
  bytes: number;
  channel_stdev: number;
  sharpness_score: number;
  phash_64: string;
  min_hamming_distance: number | null;
  defects: string[];
}

export interface FullQaEvaluation {
  passed: boolean;
  qualityScore: number;
  defects: string[];
  layer1: DeterministicQaResult;
  layer2: VisionRubricResult | null;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

/**
 * Computes a 64-bit average perceptual hash (`aHash`) from an image buffer using Sharp
 * (resized to 8x8 grayscale).
 */
export async function computePerceptualHash64(
  imageBuffer: Buffer
): Promise<string> {
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
export function computeHammingDistance(hashA: string, hashB: string): number {
  const len = Math.min(hashA.length, hashB.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    if (hashA[i] !== hashB[i]) dist++;
  }
  return dist + Math.abs(hashA.length - hashB.length);
}

/**
 * Computes mean local gradient magnitude on a 64x64 grayscale sample as a fast,
 * deterministic sharpness metric.
 */
export async function computeSharpnessMetric(
  imageBuffer: Buffer
): Promise<number> {
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

export interface Layer1CheckInput {
  imageBuffer: Buffer;
  expectedAspectRatio?: "16:9" | "9:16" | "1:1" | "4:5";
  minWidth?: number;
  maxBytes?: number;
  textContrastRatio?: number;
  placedTextRegion?: BoundingBox;
  faceRegions?: BoundingBox[];
  recentUserPhashes?: string[];
  thresholds?: Partial<CalibratedQaThresholds>;
}

/**
 * Runs Layer 1 deterministic checks on an image buffer (Section 10A.7).
 */
export async function runLayer1DeterministicQa(
  input: Layer1CheckInput
): Promise<DeterministicQaResult> {
  const thresholds: CalibratedQaThresholds = {
    ...DEFAULT_CALIBRATED_THRESHOLDS,
    ...(input.thresholds ?? {}),
  };
  const defects: string[] = [];

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
      defects.push(
        `aspect_ratio_mismatch_expected_${input.expectedAspectRatio}`
      );
    }
  }

  const stats = await sharp(input.imageBuffer).stats();
  const maxChannelStdev = Math.max(
    ...stats.channels.map((c) => c.stdev ?? 0),
    0
  );
  if (maxChannelStdev < thresholds.min_stdev) {
    defects.push("blank_or_degenerate_flat_image");
  }

  const sharpnessScore = await computeSharpnessMetric(input.imageBuffer);
  if (sharpnessScore < thresholds.min_sharpness) {
    defects.push("excessive_blur_below_sharpness_threshold");
  }

  if (
    typeof input.textContrastRatio === "number" &&
    input.textContrastRatio < thresholds.min_text_contrast
  ) {
    defects.push("text_contrast_below_wcag_4_5");
  }

  if (input.placedTextRegion && width > 0 && height > 0) {
    // Check bottom-right YouTube duration badge collision (x >= 0.82*width, y >= 0.82*height)
    const badgeBox: BoundingBox = {
      left: Math.round(width * 0.82),
      top: Math.round(height * 0.82),
      width: Math.round(width * 0.18),
      height: Math.round(height * 0.18),
    };
    if (boxesOverlap(input.placedTextRegion, badgeBox)) {
      defects.push("safe_zone_violation_duration_badge_overlap");
    }

    if (input.faceRegions && input.faceRegions.length > 0) {
      const overlapsFace = input.faceRegions.some((face) =>
        boxesOverlap(input.placedTextRegion!, face)
      );
      if (overlapsFace) {
        defects.push("text_overlaps_detected_face");
      }
    }
  }

  const phash64 = await computePerceptualHash64(input.imageBuffer);
  let minHammingDistance: number | null = null;
  if (input.recentUserPhashes && input.recentUserPhashes.length > 0) {
    for (const prevHash of input.recentUserPhashes) {
      const dist = computeHammingDistance(phash64, prevHash);
      if (minHammingDistance === null || dist < minHammingDistance) {
        minHammingDistance = dist;
      }
    }
    if (
      minHammingDistance !== null &&
      minHammingDistance < thresholds.min_phash_hamming_distance
    ) {
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
export function evaluateVisionRubric(
  rubric: VisionRubricResult,
  thresholds: CalibratedQaThresholds = DEFAULT_CALIBRATED_THRESHOLDS
): { passed: boolean; defects: string[] } {
  const defects: string[] = [];

  for (const [flagName, triggered] of Object.entries(rubric.defects)) {
    if (triggered) {
      defects.push(flagName);
    }
  }

  if (rubric.overall_score < thresholds.min_vision_overall_score) {
    defects.push(
      `vision_overall_score_below_${thresholds.min_vision_overall_score}`
    );
  }

  return {
    passed: defects.length === 0,
    defects,
  };
}

export interface QaGateExecutionOptions<TAttemptResult> {
  generateAttempt: (
    attemptNumber: 1 | 2,
    correctiveDefects: string[]
  ) => Promise<{
    result: TAttemptResult;
    qaEvaluation: FullQaEvaluation;
  }>;
  onSecondFailure?: "deliver_best_flagged" | "refund";
}

export interface QaGateExecutionOutcome<TAttemptResult> {
  status: "passed" | "delivered_flagged" | "refund_required";
  attemptsRun: 1 | 2;
  autoRetried: boolean;
  extraCreditsChargedForRetry: 0; // Invariant: retry is absorbed by ThumbGen.ai, NEVER charged
  selectedResult: TAttemptResult | null;
  selectedEvaluation: FullQaEvaluation;
  qaFlagged: boolean;
}

/**
 * Orchestrates the Section 10A.7 QA Gate with AT MOST ONE auto-retry (`attemptsRun <= 2`):
 *   - Never enters an infinite loop.
 *   - Retry is absorbed (`extraCreditsChargedForRetry: 0`).
 *   - If attempt 2 also fails, either delivers the higher-scoring attempt with `qaFlagged: true`
 *     or returns `status: "refund_required"` per `onSecondFailure` (owner decision Q12).
 */
export async function executeWithQaGate<TAttemptResult>(
  options: QaGateExecutionOptions<TAttemptResult>
): Promise<QaGateExecutionOutcome<TAttemptResult>> {
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
  const secondIsBetter =
    second.qaEvaluation.qualityScore >= first.qaEvaluation.qualityScore;
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

