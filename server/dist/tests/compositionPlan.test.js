/**
 * tests/compositionPlan.test.ts
 *
 * Section 10B Phase 2 Verification Suite:
 *   1. Composition Plan schema validation (Section 10B.4 Stage 3):
 *      - Enforces required fields, verified canvas dimensions, and element budget
 *      - Detects and rejects face/text collisions (strictly prohibited)
 *      - Detects and rejects bottom-right badge violations for YouTube 16:9
 *      - Detects and rejects direct spatial overlap between text and subject position
 *   2. Composition Planner across all 6 creative direction families:
 *      - Adapts layouts (editorial, documentary, investigative, bold graphic, product, typographic)
 *      - Guarantees composition is not locked to one single universal template
 *      - Element budget is constrained (<= 3 meaningful visual elements)
 *      - Deterministic reproduction with pinned seed across 50 runs
 *   3. Platform presets & safe zones:
 *      - Verified dimensions for YouTube 16:9 (1280x720) and Shorts 9:16 (1080x1920)
 *      - Verified mobile preview dimensions (320x180 and 180x320)
 *   4. Compiler & post-process integration:
 *      - compileThumbnailBrief outputs valid CompositionPlan
 *      - applyServerTextOverlay respects compositionPlan text_region and avoids bottom-right badge
 */
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { getCanvasSpec, validateCompositionPlan, generateCompositionPlan, extractContentBrief, selectCreativeDirection, compileThumbnailBrief, } from "../services/briefCompiler.js";
import { applyServerTextOverlay } from "../services/postProcessService.js";
test("Section 10B.4 Stage 3: Canvas specifications from verified platform presets", () => {
    const ytVideo = getCanvasSpec("youtube_video");
    assert.equal(ytVideo.width, 1280);
    assert.equal(ytVideo.height, 720);
    assert.equal(ytVideo.aspect_ratio, "16:9");
    assert.equal(ytVideo.safe_zone_center_ratio, 0.8);
    assert.equal(ytVideo.mobile_preview_width, 320);
    assert.equal(ytVideo.mobile_preview_height, 180);
    const ytShorts = getCanvasSpec("youtube_shorts");
    assert.equal(ytShorts.width, 1080);
    assert.equal(ytShorts.height, 1920);
    assert.equal(ytShorts.aspect_ratio, "9:16");
    assert.equal(ytShorts.safe_zone_center_ratio, 0.8);
    assert.equal(ytShorts.mobile_preview_width, 180);
    assert.equal(ytShorts.mobile_preview_height, 320);
});
test("Section 10B.4 Stage 3: Composition Plan schema validation & collision rejection", () => {
    const brief = extractContentBrief({
        userPrompt: "Sony A7IV Camera In-Depth Review",
        titleText: "BUY OR PASS?",
        platformPreset: "youtube_video",
    });
    const direction = selectCreativeDirection(brief);
    const validPlan = generateCompositionPlan(brief, direction, {
        titleText: "BUY OR PASS?",
        platformPreset: "youtube_video",
    });
    // 1. Valid plan passes
    const check = validateCompositionPlan(validPlan);
    assert.equal(check.valid, true, check.errors.join("; "));
    assert.equal(validPlan.canvas.width, 1280);
    assert.equal(validPlan.canvas.height, 720);
    assert.ok(validPlan.element_budget <= 3);
    // 2. Reject face/text collision: face_text_collision=true is strictly prohibited
    const badCollisionPlan = {
        ...validPlan,
        overlap_constraints: {
            ...validPlan.overlap_constraints,
            face_text_collision: true,
        },
    };
    const collisionCheck = validateCompositionPlan(badCollisionPlan);
    assert.equal(collisionCheck.valid, false);
    assert.ok(collisionCheck.errors.some((e) => e.includes("face_text_collision cannot be true")));
    // 3. Reject missing avoid_bottom_right_badge for 16:9 YouTube video
    const badBadgePlan = {
        ...validPlan,
        canvas: getCanvasSpec("youtube_video"),
        overlap_constraints: {
            ...validPlan.overlap_constraints,
            avoid_bottom_right_badge: false,
        },
    };
    const badgeCheck = validateCompositionPlan(badBadgePlan);
    assert.equal(badgeCheck.valid, false);
    assert.ok(badgeCheck.errors.some((e) => e.includes("avoid_bottom_right_badge must be true")));
    // 4. Reject direct spatial collision: left-third text + left-two-thirds subject
    const spatialConflictPlan = {
        ...validPlan,
        subject_position: "left-two-thirds",
        text_region: {
            region: "left-third",
            max_area_ratio: 0.35,
            safe_zone_padding: 0.08,
        },
    };
    const spatialCheck = validateCompositionPlan(spatialConflictPlan);
    assert.equal(spatialCheck.valid, false);
    assert.ok(spatialCheck.errors.some((e) => e.includes("collides with subject_position")));
});
test("Section 10B.4 Stage 3: Composition Planner adapts distinctly across all 6 families", () => {
    const families = [
        "editorial_photography",
        "documentary_storytelling",
        "investigative_editorial",
        "bold_graphic_design",
        "product_focused",
        "typographic_led",
    ];
    const generatedPositions = new Set();
    const generatedTextRegions = new Set();
    for (const familyId of families) {
        const brief = extractContentBrief({
            userPrompt: `Testing layout adaptability for family ${familyId}`,
            titleText: "KEY STATEMENT",
            platformPreset: "youtube_video",
        });
        const direction = selectCreativeDirection(brief, { forceFamily: familyId });
        const plan = generateCompositionPlan(brief, direction, {
            titleText: "KEY STATEMENT",
            platformPreset: "youtube_video",
        });
        const check = validateCompositionPlan(plan);
        assert.equal(check.valid, true, `Family ${familyId} must produce a valid plan: ${check.errors.join("; ")}`);
        assert.ok(plan.element_budget <= 3, `Family ${familyId} element budget must be <= 3`);
        assert.ok(plan.focal_point.length > 0, `Family ${familyId} must identify a focal point`);
        assert.ok(plan.negative_space.purpose.length > 0, `Family ${familyId} must justify negative space`);
        generatedPositions.add(plan.subject_position);
        generatedTextRegions.add(plan.text_region.region);
    }
    // Verify diversity: not locked to one single universal template
    assert.ok(generatedPositions.size >= 2, "Composition engine must produce diverse subject positions across families");
    assert.ok(generatedTextRegions.size >= 3, "Composition engine must produce diverse text regions across families");
});
test("Section 10B.4 Stage 3: Pinned seed determinism for composition planning", () => {
    const brief = extractContentBrief({
        userPrompt: "How NVIDIA CUDA works under the hood",
        titleText: "CUDA SECRETS",
        platformPreset: "youtube_video",
    });
    const direction = selectCreativeDirection(brief, { seed: 54321 });
    const seed = 54321;
    const initialPlan = generateCompositionPlan(brief, direction, {
        seed,
        titleText: "CUDA SECRETS",
    });
    for (let i = 0; i < 50; i++) {
        const iteration = generateCompositionPlan(brief, direction, {
            seed,
            titleText: "CUDA SECRETS",
        });
        assert.deepEqual(iteration, initialPlan, `Run ${i} must produce identical composition plan`);
    }
});
test("Section 10B Pipeline Integration: compileThumbnailBrief and applyServerTextOverlay with CompositionPlan", async () => {
    const compiled = await compileThumbnailBrief({
        userPrompt: "Deep dive: Why quantum computers cannot break AES-256 today",
        stylePreset: "product_focus",
        platformPreset: "youtube_video",
        titleText: "QUANTUM MYTH",
        seed: 33333,
    });
    assert.ok(compiled.compositionPlan, "compileThumbnailBrief must output compositionPlan");
    const planCheck = validateCompositionPlan(compiled.compositionPlan);
    assert.equal(planCheck.valid, true, planCheck.errors.join("; "));
    // Directives reflect composition plan
    const directives = compiled.structuredBrief.constraints.join(" ");
    assert.ok(directives.includes("COMPOSITION_PLAN:"), "Directives must include COMPOSITION_PLAN");
    assert.ok(directives.includes("focal_point="), "Directives must describe focal_point");
    // Code overlay integration: test applyServerTextOverlay using compositionPlan
    const testCanvas = await sharp({
        create: {
            width: 1280,
            height: 720,
            channels: 4,
            background: { r: 30, g: 30, b: 35, alpha: 1 },
        },
    })
        .png()
        .toBuffer();
    const overlayOut = await applyServerTextOverlay(testCanvas, {
        text: "QUANTUM MYTH",
        compositionPlan: compiled.compositionPlan,
    });
    assert.ok(overlayOut.buffer.length > 0, "Overlay buffer must not be empty");
    assert.ok(overlayOut.placedRegion.width > 0, "Overlay must place in a valid bounding box");
    // Ensure placed text does not land in the bottom-right badge zone
    const inBottomRightZone = overlayOut.placedRegion.left > 1280 * 0.78 && overlayOut.placedRegion.top > 720 * 0.78;
    assert.equal(inBottomRightZone, false, "Text overlay must avoid bottom-right timestamp badge");
});
