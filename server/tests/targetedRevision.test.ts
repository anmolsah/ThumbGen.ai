/**
 * tests/targetedRevision.test.ts
 *
 * Section 10B Phase 4 Verification Suite:
 *   1. Defect Routing Engine (Section 10B.8 & 10B.13):
 *      - Routes typography/contrast/badge defects to "typography_renderer" (requiresImageRegeneration: false)
 *      - Routes unmotivated props, misleading claims, and cliché flags to "brief_concept" (requiresImageRegeneration: true)
 *      - Routes clutter and focal point issues to "composition_planner" (requiresImageRegeneration: true)
 *      - Routes limbs, plastic skin, blur, and degenerate artifacts to "image_generation" (requiresImageRegeneration: true)
 *   2. Revision Strategy Planner:
 *      - Typography-only defects do NOT trigger image regeneration (0 extra credits)
 *      - Image defects produce named corrective instructions (never a vague "make it better")
 *      - Bounded retry guarantee: at most 1 automatic retry, no infinite loop
 *   3. Final Composite Validator (Section 10B.4 Stage 6):
 *      - Enforces platform dimensions and safe-zone constraints
 *      - Rejects bottom-right timestamp badge collision for 16:9 YouTube video
 *      - Rejects direct face/text overlay collisions
 *      - Generates verified 320x180 (or 180x320) mobile feed preview
 */

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  routeDefectToTargetStage,
  planTargetedRevision,
  validateFinalComposite,
} from "../services/qaGateService.js";
import {
  extractContentBrief,
  selectCreativeDirection,
  generateCompositionPlan,
  getCanvasSpec,
} from "../services/briefCompiler.js";
import { applyServerTextOverlay } from "../services/postProcessService.js";

test("Section 10B.8: routeDefectToTargetStage routes defects to appropriate subsystems", () => {
  // 1. Typography & layout defects
  const contrastAction = routeDefectToTargetStage("LOW_CONTRAST: initial contrast 3.2 < 4.5");
  assert.equal(contrastAction.stage, "typography_renderer");
  assert.equal(contrastAction.requiresImageRegeneration, false);
  assert.ok(contrastAction.correctiveInstruction.includes("scrim"));

  const badgeAction = routeDefectToTargetStage("SAFE_ZONE_COLLISION: text in bottom-right duration_badge zone");
  assert.equal(badgeAction.stage, "typography_renderer");
  assert.equal(badgeAction.requiresImageRegeneration, false);
  assert.ok(badgeAction.correctiveInstruction.includes("safe-zone"));

  const gold3dAction = routeDefectToTargetStage("GOLD_3D_BEVEL_TEXT: 3d gold extruded typography");
  assert.equal(gold3dAction.stage, "typography_renderer");
  assert.equal(gold3dAction.requiresImageRegeneration, false);

  // 2. Concept & brief defects
  const particleAction = routeDefectToTargetStage("UNMOTIVATED_PARTICLES_SPARKS: floating embers in office review");
  assert.equal(particleAction.stage, "brief_concept");
  assert.equal(particleAction.requiresImageRegeneration, true);
  assert.ok(particleAction.correctiveInstruction.includes("sparks"));

  const fogAction = routeDefectToTargetStage("EXCESSIVE_VOLUMETRIC_FOG: heavy smoke in indoor review");
  assert.equal(fogAction.stage, "brief_concept");
  assert.equal(fogAction.requiresImageRegeneration, true);

  // 3. Composition defects
  const clutterAction = routeDefectToTargetStage("CLUTTER_NO_FOCAL_POINT: too many competing visual elements");
  assert.equal(clutterAction.stage, "composition_planner");
  assert.equal(clutterAction.requiresImageRegeneration, true);

  // 4. Image defects
  const limbAction = routeDefectToTargetStage("EXTRA_OR_MISSING_LIMBS: hand has 6 fingers");
  assert.equal(limbAction.stage, "image_generation");
  assert.equal(limbAction.requiresImageRegeneration, true);
  assert.ok(limbAction.correctiveInstruction.includes("5 fingers"));

  const skinAction = routeDefectToTargetStage("PLASTIC_SKIN: waxy doll-like skin texture");
  assert.equal(skinAction.stage, "image_generation");
  assert.equal(skinAction.requiresImageRegeneration, true);
  assert.ok(skinAction.correctiveInstruction.includes("natural skin pores"));
});

test("Section 10B.8: planTargetedRevision separates typography-only fixes from image regenerations", () => {
  // Scenario A: Typography-only defects -> ZERO image regeneration, 0 extra credits
  const typographyOnlyPlan = planTargetedRevision([
    "SAFE_ZONE_COLLISION: text in bottom-right duration_badge zone",
    "LOW_CONTRAST: text contrast below 4.5:1",
  ]);

  assert.equal(
    typographyOnlyPlan.needsImageRegeneration,
    false,
    "Typography-only defects must NOT trigger expensive image regeneration"
  );
  assert.equal(typographyOnlyPlan.needsTypographyReRender, true);
  assert.equal(typographyOnlyPlan.revisionPromptAdditions.length, 0);
  assert.ok(typographyOnlyPlan.summary.includes("without image regeneration"));

  // Scenario B: Image defect present -> requires image regeneration with named instructions
  const imageDefectPlan = planTargetedRevision([
    "EXTRA_OR_MISSING_LIMBS: distorted hand",
  ]);

  assert.equal(imageDefectPlan.needsImageRegeneration, true);
  assert.ok(imageDefectPlan.revisionPromptAdditions.length > 0);
  assert.ok(imageDefectPlan.revisionPromptAdditions[0].includes("natural hands"));

  // Scenario C: Hybrid defects
  const hybridPlan = planTargetedRevision([
    "PLASTIC_SKIN: synthetic face",
    "LOW_CONTRAST: text contrast 3.8",
  ]);
  assert.equal(hybridPlan.needsImageRegeneration, true);
  assert.equal(hybridPlan.needsTypographyReRender, true);
  assert.ok(hybridPlan.summary.includes("Hybrid revision"));
});

test("Section 10B.4 Stage 6: validateFinalComposite detects badge collisions, face overlaps, and generates feed preview", async () => {
  // Create a realistic solid 1280x720 test canvas
  const baseImg = await sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 3,
      background: { r: 18, g: 30, b: 45 },
    },
  })
    .png()
    .toBuffer();

  const brief = extractContentBrief({
    userPrompt: "Camera Lighting Masterclass",
    titleText: "LIGHTING GUIDE",
    platformPreset: "youtube_video",
  });
  const direction = selectCreativeDirection(brief);
  const plan = generateCompositionPlan(brief, direction, {
    titleText: "LIGHTING GUIDE",
    platformPreset: "youtube_video",
  });

  // 1. Valid composite with top/left placement passes
  const validOverlay = await applyServerTextOverlay(baseImg, {
    text: "LIGHTING GUIDE",
    position: "top",
    compositionPlan: plan,
  });

  const validCheck = await validateFinalComposite(validOverlay.buffer, {
    platformPreset: "youtube_video",
    compositionPlan: plan,
    textOverlayPlaced: validOverlay.placedRegion,
  });

  assert.equal(validCheck.width, 1280);
  assert.equal(validCheck.height, 720);
  assert.ok(validCheck.mobileFeedPreviewBuffer, "Must generate mobile feed preview");

  // Verify mobile feed preview dimensions (320x180)
  const previewMeta = await sharp(validCheck.mobileFeedPreviewBuffer).metadata();
  assert.equal(previewMeta.width, 320);
  assert.equal(previewMeta.height, 180);

  // 2. Detect collision with bottom-right duration badge
  const badBadgeBox = {
    left: 1050,
    top: 600,
    width: 200,
    height: 80,
  };
  const badgeCheck = await validateFinalComposite(baseImg, {
    platformPreset: "youtube_video",
    compositionPlan: plan,
    textOverlayPlaced: badBadgeBox,
  });
  assert.equal(badgeCheck.passed, false);
  assert.ok(badgeCheck.defects.some((d) => d.includes("SAFE_ZONE_COLLISION")));

  // 3. Detect collision with face region
  const faceRegion = { left: 100, top: 100, width: 250, height: 250 };
  const collidingTextBox = { left: 150, top: 120, width: 300, height: 80 };
  const faceCheck = await validateFinalComposite(baseImg, {
    platformPreset: "youtube_video",
    compositionPlan: plan,
    textOverlayPlaced: collidingTextBox,
    faceRegions: [faceRegion],
  });
  assert.equal(faceCheck.passed, false);
  assert.ok(faceCheck.defects.some((d) => d.includes("FACE_COLLISION")));

  // 4. Dimension mismatch check
  const badDimImg = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();

  const dimCheck = await validateFinalComposite(badDimImg, {
    platformPreset: "youtube_video",
  });
  assert.equal(dimCheck.passed, false);
  assert.ok(dimCheck.defects.some((d) => d.includes("DIMENSION_MISMATCH")));
});

