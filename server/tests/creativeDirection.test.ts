/**
 * tests/creativeDirection.test.ts
 *
 * Section 10B Phase 1 Verification Suite:
 *   1. Creative direction library loads all 6 families (Section 10B.5):
 *      - editorial_photography
 *      - documentary_storytelling
 *      - investigative_editorial
 *      - bold_graphic_design
 *      - product_focused
 *      - typographic_led
 *   2. Content understanding (Section 10B.4 Stage 1):
 *      - Validates against ContentBrief schema
 *      - Vague prompts produce conservative brief without fabricated facts/scandals
 *      - Inferred format matching (product review, investigation, tutorial, documentary, commentary)
 *   3. Creative direction selection (Section 10B.4 Stage 2):
 *      - Validates against CreativeDirection schema
 *      - Respects user manual style override when requested
 *      - Automatic classification selects best-fit family when no override
 *      - Deterministic reproduction with pinned seed across multiple runs
 *   4. Compiler integration & slop-free guarantee:
 *      - Creative direction constraints injected into brief without slop lexicon leaks
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  loadCreativeDirectionPresets,
  loadDesignQaConfig,
  loadSlopLexicon,
  validateContentBrief,
  validateCreativeDirection,
  extractContentBrief,
  selectCreativeDirection,
  compileThumbnailBrief,
  type CreativeDirectionFamilyId,
} from "../services/briefCompiler.js";

test("Section 10B.5: Creative Direction Library loads all 6 preset families", () => {
  const families = loadCreativeDirectionPresets();
  const expectedFamilies: CreativeDirectionFamilyId[] = [
    "editorial_photography",
    "documentary_storytelling",
    "investigative_editorial",
    "bold_graphic_design",
    "product_focused",
    "typographic_led",
  ];

  for (const famId of expectedFamilies) {
    assert.ok(families[famId], `Preset family '${famId}' must exist in library`);
    const cfg = families[famId];
    assert.equal(cfg.id, famId);
    assert.ok(cfg.label.length > 0, `${famId} must have a non-empty label`);
    assert.ok(cfg.description.length > 0, `${famId} must have a description`);
    assert.ok(cfg.best_for_formats.length > 0, `${famId} must have best_for_formats`);
    assert.ok(cfg.emotional_tones.length > 0, `${famId} must have emotional_tones`);
    assert.ok(cfg.visual_language.length > 0, `${famId} must have visual_language`);
    assert.ok(cfg.composition_intent.length > 0, `${famId} must have composition_intent`);
    assert.ok(cfg.typography_intent.length > 0, `${famId} must have typography_intent`);
    assert.ok(cfg.palette_intent.length > 0, `${famId} must have palette_intent`);
    assert.ok(cfg.common_risks.length > 0, `${famId} must have common_risks`);
  }
});

test("Section 10B.12: Design QA config loads in shadow mode with null uncalibrated thresholds", () => {
  const cfg = loadDesignQaConfig();
  assert.equal(cfg.design_qa.mode, "shadow", "Initial Design QA must start in shadow mode");
  assert.equal(
    cfg.design_qa.thresholds.content_specificity,
    null,
    "Thresholds must be null until calibrated"
  );
  assert.equal(cfg.creative_direction.allow_user_style_override, true);
});

test("Section 10B.4 Stage 1: Content Understanding & Vague Prompt Safeguards", () => {
  // 1. Vague prompt safety test: must NOT hallucinate fake facts, scandals, or arrests
  const vagueBrief = extractContentBrief({
    userPrompt: "Finance",
    platformPreset: "youtube_video",
  });

  const vagueCheck = validateContentBrief(vagueBrief);
  assert.equal(vagueCheck.valid, true, vagueCheck.errors.join("; "));
  assert.ok(vagueBrief.truthfulness_notes, "Vague prompt must have truthfulness notes");
  assert.ok(
    vagueBrief.must_not_imply.some((r) => r.includes("unverified") || r.includes("fictional")),
    "Vague prompt must constrain against hallucinated facts"
  );

  // 2. Specific prompt parsing
  const specificBrief = extractContentBrief({
    userPrompt: "iPhone 16 Pro Review: Don't buy before watching this",
    titleText: "BUY OR PASS?",
    platformPreset: "youtube_video",
  });
  assert.equal(specificBrief.content_format, "product_review");
  assert.ok(specificBrief.viewer_curiosity.includes("claims"));
  assert.equal(validateContentBrief(specificBrief).valid, true);

  // 3. Investigative prompt parsing
  const investBrief = extractContentBrief({
    userPrompt: "Why the Silicon Valley Bank collapsed in 48 hours",
    platformPreset: "youtube_video",
  });
  assert.equal(investBrief.content_format, "investigation");
  assert.ok(investBrief.emotional_tone.includes("analytical"));
  assert.equal(validateContentBrief(investBrief).valid, true);

  // 4. Documentary prompt parsing
  const docBrief = extractContentBrief({
    userPrompt: "Expedition through the lost ruins of the Amazon rainforest",
    platformPreset: "youtube_video",
  });
  assert.equal(docBrief.content_format, "documentary");
  assert.equal(validateContentBrief(docBrief).valid, true);

  // 5. Commentary / Opinion prompt parsing
  const opinionBrief = extractContentBrief({
    userPrompt: "Why I am quitting social media forever - honest thoughts",
    platformPreset: "youtube_video",
  });
  assert.equal(opinionBrief.content_format, "commentary");
  assert.equal(validateContentBrief(opinionBrief).valid, true);
});

test("Section 10B.4 Stage 2: Creative Direction selection, override, and determinism", () => {
  const brief = extractContentBrief({
    userPrompt: "M3 Max MacBook Pro benchmark and thermal teardown",
    platformPreset: "youtube_video",
  });

  // 1. Automatic classification chooses product_focused for product review
  const autoDir = selectCreativeDirection(brief, { seed: 12345 });
  assert.equal(autoDir.family_id, "product_focused");
  assert.equal(autoDir.user_override_applied, false);
  const dirCheck = validateCreativeDirection(autoDir);
  assert.equal(dirCheck.valid, true, dirCheck.errors.join("; "));

  // 2. User style override: user forces bold_graphic
  const overrideDir = selectCreativeDirection(brief, {
    userStyleOverride: "bold_graphic",
    seed: 12345,
  });
  assert.equal(overrideDir.family_id, "bold_graphic_design");
  assert.equal(overrideDir.user_override_applied, true);

  // 3. User direct family override
  const directOverride = selectCreativeDirection(brief, {
    forceFamily: "editorial_photography",
  });
  assert.equal(directOverride.family_id, "editorial_photography");
  assert.equal(directOverride.user_override_applied, true);

  // 4. Deterministic reproduction: 50 runs with same seed must be 100% identical
  const seed = 987654321;
  const initial = selectCreativeDirection(brief, { seed });
  for (let i = 0; i < 50; i++) {
    const iteration = selectCreativeDirection(brief, { seed });
    assert.deepEqual(iteration, initial, `Run ${i} must produce identical creative direction`);
  }
});

test("Section 10B & 10A Pipeline Integration: compileThumbnailBrief with slop-free creative direction", async () => {
  const compiled = await compileThumbnailBrief({
    userPrompt: "How we scaled our PostgreSQL database to 10M writes per second",
    stylePreset: "bold_graphic",
    platformPreset: "youtube_video",
    titleText: "POSTGRES AT SCALE",
    seed: 77777,
  });

  // 1. Returns valid ContentBrief & CreativeDirection
  assert.ok(compiled.contentBrief, "Must return contentBrief");
  assert.ok(compiled.creativeDirection, "Must return creativeDirection");
  assert.equal(validateContentBrief(compiled.contentBrief).valid, true);
  assert.equal(validateCreativeDirection(compiled.creativeDirection).valid, true);
  assert.equal(compiled.creativeDirection.family_id, "bold_graphic_design");

  // 2. Directives contain creative direction & composition intent
  const directives = compiled.structuredBrief.constraints.join(" ");
  assert.ok(directives.includes("CREATIVE_DIRECTION: family=bold_graphic_design"));
  assert.ok(directives.includes("COMPOSITION_INTENT:"));
  assert.ok(directives.includes("TRUTHFULNESS:"));

  // 3. Slop lexicon terms are NEVER introduced by compiler fragments
  const slopTerms = loadSlopLexicon();
  for (const term of slopTerms) {
    // Check compiler-added constraints
    for (const constraint of compiled.structuredBrief.constraints) {
      if (constraint.startsWith("CREATIVE_DIRECTION:") || constraint.startsWith("COMPOSITION_INTENT:")) {
        const regex = new RegExp(`\\b${term}\\b`, "i");
        assert.equal(
          regex.test(constraint),
          false,
          `Compiler constraint '${constraint}' must not contain slop term '${term}'`
        );
      }
    }
  }
});

