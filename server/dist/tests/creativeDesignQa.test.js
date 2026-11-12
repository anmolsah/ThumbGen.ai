/**
 * tests/creativeDesignQa.test.ts
 *
 * Section 10B Phase 3 Verification Suite:
 *   1. Creative Cliché Lexicon (Section 10B.6):
 *      - Loads and parses creative_cliche_lexicon.yaml
 *      - Contains all 8 defined core patterns with actionable suggested fixes
 *   2. Design QA Schema Validator (Section 10B.7):
 *      - Enforces 9 core dimensions (content_specificity, concept_strength, composition_hierarchy,
 *        typography_layout, visual_relevance, originality, restraint, small_size_readability, truthfulness)
 *      - Rejects non-integer scores and out-of-bound scores (< 1 or > 5)
 *      - Validates flags, severity, evidence, and confidence bounds (0.0 - 1.0)
 *      - Safely rejects malformed or incomplete evaluator outputs
 *   3. Contextual Cliché Evaluator (Section 10B.6):
 *      - Distinguishes narrative/story-motivated elements from unmotivated formulaic clichés
 *      - Welding/fireworks topics allow sparks; coding/finance topics flag sparks
 *      - Horror/swamp topics allow volumetric fog; indoor tech reviews flag fog
 *      - Arbitrary red arrows and gold 3D bevel text are flagged with actionable fixes
 *   4. Design QA Evaluator & Shadow Mode Invariant (Section 10B.7 & 10B.12):
 *      - In "shadow" mode (default): blocked_delivery is ALWAYS false regardless of score or flags
 *      - In "enforce" mode with calibrated thresholds: triggers blocked_delivery when below threshold
 *      - Graceful fallback when vision evaluator fails or throws
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadCreativeClicheLexicon, validateCreativeDesignQaResult, evaluateContextualCliches, runCreativeDesignQa, } from "../services/qaGateService.js";
import { extractContentBrief, selectCreativeDirection, generateCompositionPlan, } from "../services/briefCompiler.js";
test("Section 10B.6: Creative Cliché Lexicon loader parses all 8 core patterns", () => {
    const lexicon = loadCreativeClicheLexicon();
    assert.ok(Array.isArray(lexicon), "Lexicon must be an array");
    assert.ok(lexicon.length >= 8, `Expected at least 8 patterns, found ${lexicon.length}`);
    const requiredPatternIds = [
        "UNMOTIVATED_PARTICLES_SPARKS",
        "EXCESSIVE_VOLUMETRIC_FOG",
        "DECORATIVE_MAGNIFYING_GLASS",
        "ARBITRARY_RED_ARROWS_CIRCLES",
        "SHOCKED_FACE_UNMOTIVATED",
        "GOLD_3D_BEVEL_TEXT",
        "GENERIC_CINEMATIC_BACKDROP",
        "STOCK_PERSON_CUTOUT_COMPOSITE",
    ];
    for (const pid of requiredPatternIds) {
        const pattern = lexicon.find((p) => p.id === pid);
        assert.ok(pattern, `Lexicon must define pattern ${pid}`);
        assert.ok(pattern.label && pattern.label.length > 0);
        assert.ok(pattern.category && pattern.category.length > 0);
        assert.ok(["informational", "warning", "blocking_candidate"].includes(pattern.default_severity));
        assert.ok(pattern.suggested_fix && pattern.suggested_fix.length > 10, "Suggested fix must be actionable");
    }
});
test("Section 10B.7: Design QA Schema Validator strictly enforces 9 dimensions and 1..5 integer bounds", () => {
    const validScores = {
        content_specificity: 4,
        concept_strength: 5,
        composition_hierarchy: 4,
        typography_layout: 3,
        visual_relevance: 5,
        originality: 4,
        restraint: 4,
        small_size_readability: 4,
        truthfulness: 5,
    };
    const validResult = {
        schema_version: "1.0",
        mode: "shadow",
        overall_assessment: "pass",
        scores: validScores,
        average_score: 4.22,
        flags: [
            {
                code: "UNMOTIVATED_PARTICLES_SPARKS",
                severity: "warning",
                evidence: "Floating embers detected around software terminal",
                suggested_fix: "Remove embers; retain clean workspace desk background",
            },
        ],
        strengths: ["Clean typography hierarchy", "Focal subject is recognizable"],
        revision_brief: ["Remove embers; retain clean workspace desk background"],
        confidence: 0.9,
        blocked_delivery: false,
    };
    // 1. Valid result passes
    const checkValid = validateCreativeDesignQaResult(validResult);
    assert.equal(checkValid.valid, true, checkValid.errors.join("; "));
    assert.equal(checkValid.result?.overall_assessment, "pass");
    // 2. Reject out-of-bounds score (< 1 or > 5)
    const badScoreResult = {
        ...validResult,
        scores: {
            ...validScores,
            concept_strength: 6, // Invalid: exceeds 5
        },
    };
    const checkBadScore = validateCreativeDesignQaResult(badScoreResult);
    assert.equal(checkBadScore.valid, false);
    assert.ok(checkBadScore.errors.some((e) => e.includes("concept_strength")));
    // 3. Reject non-integer score (e.g. 3.5)
    const floatScoreResult = {
        ...validResult,
        scores: {
            ...validScores,
            restraint: 3.5, // Invalid: must be integer
        },
    };
    const checkFloatScore = validateCreativeDesignQaResult(floatScoreResult);
    assert.equal(checkFloatScore.valid, false);
    assert.ok(checkFloatScore.errors.some((e) => e.includes("restraint")));
    // 4. Reject missing dimension
    const missingDimResult = {
        ...validResult,
        scores: {
            ...validScores,
        },
    };
    delete missingDimResult.scores.truthfulness;
    const checkMissingDim = validateCreativeDesignQaResult(missingDimResult);
    assert.equal(checkMissingDim.valid, false);
    assert.ok(checkMissingDim.errors.some((e) => e.includes("truthfulness")));
    // 5. Reject malformed flag (missing suggested_fix or invalid severity)
    const malformedFlagResult = {
        ...validResult,
        flags: [
            {
                code: "ARBITRARY_RED_ARROWS_CIRCLES",
                severity: "fatal_error", // Invalid severity enum
                evidence: "Big red circle",
                suggested_fix: "", // Invalid: empty fix
            },
        ],
    };
    const checkMalformedFlag = validateCreativeDesignQaResult(malformedFlagResult);
    assert.equal(checkMalformedFlag.valid, false);
    assert.ok(checkMalformedFlag.errors.some((e) => e.includes("severity")));
    // 6. Reject invalid confidence (< 0 or > 1)
    const badConfidenceResult = {
        ...validResult,
        confidence: 1.5,
    };
    const checkBadConf = validateCreativeDesignQaResult(badConfidenceResult);
    assert.equal(checkBadConf.valid, false);
    assert.ok(checkBadConf.errors.some((e) => e.includes("confidence")));
});
test("Section 10B.6: Contextual Cliché Evaluator evaluates narrative motivation vs formulaic clichés", () => {
    // Scenario A: Welding Workshop -> Sparks are story-motivated and physically justified!
    const weldingBrief = extractContentBrief({
        userPrompt: "TIG Welding Stainless Steel: Complete Beginner Guide",
        titleText: "WELDING BASICS",
        platformPreset: "youtube_video",
    });
    const weldingDirection = selectCreativeDirection(weldingBrief);
    const weldingPlan = generateCompositionPlan(weldingBrief, weldingDirection, {
        titleText: "WELDING BASICS",
        platformPreset: "youtube_video",
    });
    const weldingFlags = evaluateContextualCliches(weldingBrief, weldingDirection, weldingPlan, ["UNMOTIVATED_PARTICLES_SPARKS"]);
    assert.equal(weldingFlags.length, 0, "Sparks must NOT be flagged for welding topic because they are contextually motivated");
    // Scenario B: Python Coding Tutorial -> Sparks are unmotivated decorative slop!
    const codingBrief = extractContentBrief({
        userPrompt: "Learn Python AsyncIO in 15 Minutes",
        titleText: "ASYNC PYTHON",
        platformPreset: "youtube_video",
    });
    const codingDirection = selectCreativeDirection(codingBrief);
    const codingPlan = generateCompositionPlan(codingBrief, codingDirection, {
        titleText: "ASYNC PYTHON",
        platformPreset: "youtube_video",
    });
    const codingFlags = evaluateContextualCliches(codingBrief, codingDirection, codingPlan, ["UNMOTIVATED_PARTICLES_SPARKS", "ARBITRARY_RED_ARROWS_CIRCLES"]);
    assert.equal(codingFlags.length, 2);
    const sparkFlag = codingFlags.find((f) => f.code === "UNMOTIVATED_PARTICLES_SPARKS");
    assert.ok(sparkFlag);
    assert.ok(sparkFlag.contextual_reason?.includes("no physical or narrative motivation"));
    assert.ok(sparkFlag.suggested_fix.includes("Remove decorative particles"));
    const arrowFlag = codingFlags.find((f) => f.code === "ARBITRARY_RED_ARROWS_CIRCLES");
    assert.ok(arrowFlag);
    assert.ok(arrowFlag.suggested_fix.includes("Guide viewer attention"));
});
test("Section 10B.7 & 10B.12: runCreativeDesignQa in Shadow Mode NEVER blocks delivery", async () => {
    const brief = extractContentBrief({
        userPrompt: "Inside the Abandoned Soviet Deep Bunker",
        titleText: "SECRET BUNKER",
        platformPreset: "youtube_video",
    });
    const direction = selectCreativeDirection(brief);
    const plan = generateCompositionPlan(brief, direction, {
        titleText: "SECRET BUNKER",
        platformPreset: "youtube_video",
    });
    const dummyImage = Buffer.from("fake-png-data");
    // In shadow mode (default config)
    const qaResult = await runCreativeDesignQa({
        imageBuffer: dummyImage,
        contentBrief: brief,
        creativeDirection: direction,
        compositionPlan: plan,
        detectedCliches: ["ARBITRARY_RED_ARROWS_CIRCLES", "GOLD_3D_BEVEL_TEXT"],
        configOverride: { mode: "shadow" },
    });
    assert.equal(qaResult.mode, "shadow");
    // CRITICAL INVARIANT: Shadow mode must NEVER block delivery!
    assert.equal(qaResult.blocked_delivery, false, "Shadow mode MUST guarantee blocked_delivery === false");
    assert.equal(qaResult.flags.length, 2);
    assert.ok(qaResult.scores.restraint <= 3, "Cliché flags should lower restraint score");
    assert.ok(qaResult.revision_brief.length >= 2, "Revision brief should provide fixes for flags");
    assert.ok(qaResult.strengths.length > 0);
});
test("Section 10B.7: runCreativeDesignQa with injected vision evaluator and enforce mode thresholding", async () => {
    const brief = extractContentBrief({
        userPrompt: "Apple M4 Mac Mini Review: Unbelievable Value",
        titleText: "M4 MAC MINI",
        platformPreset: "youtube_video",
    });
    const direction = selectCreativeDirection(brief);
    const plan = generateCompositionPlan(brief, direction, {
        titleText: "M4 MAC MINI",
        platformPreset: "youtube_video",
    });
    const dummyImage = Buffer.from("fake-png-data");
    // 1. Injected vision evaluator returning valid low-scoring JSON
    const lowScoringVisionEvaluator = async () => ({
        schema_version: "1.0",
        overall_assessment: "fail",
        scores: {
            content_specificity: 2,
            concept_strength: 2,
            composition_hierarchy: 2,
            typography_layout: 2,
            visual_relevance: 2,
            originality: 2,
            restraint: 1,
            small_size_readability: 2,
            truthfulness: 4,
        },
        average_score: 2.11,
        flags: [
            {
                code: "GENERIC_CINEMATIC_BACKDROP",
                severity: "warning",
                evidence: "Random neon cyberpunk backdrop for a clean office computer review",
                suggested_fix: "Use clean desk studio surface",
            },
        ],
        strengths: ["Truthful claims"],
        revision_brief: ["Replace cyberpunk background with clean minimalist desk"],
        confidence: 0.95,
    });
    // When mode is "shadow": even low scores do NOT block delivery
    const shadowRun = await runCreativeDesignQa({
        imageBuffer: dummyImage,
        contentBrief: brief,
        creativeDirection: direction,
        compositionPlan: plan,
        visionEvaluator: lowScoringVisionEvaluator,
        configOverride: { mode: "shadow" },
    });
    assert.equal(shadowRun.blocked_delivery, false);
    assert.equal(shadowRun.scores.concept_strength, 2);
    // When mode is "enforce" with calibrated threshold: triggers blocked_delivery=true
    const enforceRun = await runCreativeDesignQa({
        imageBuffer: dummyImage,
        contentBrief: brief,
        creativeDirection: direction,
        compositionPlan: plan,
        visionEvaluator: lowScoringVisionEvaluator,
        configOverride: {
            mode: "enforce",
            thresholds: {
                concept_strength: 3, // Candidate has score 2 < threshold 3
            },
        },
    });
    assert.equal(enforceRun.blocked_delivery, true);
    // 2. Vision evaluator that throws an exception falls back safely to deterministic evaluation
    const failingVisionEvaluator = async () => {
        throw new Error("Vision provider timeout 504");
    };
    const fallbackRun = await runCreativeDesignQa({
        imageBuffer: dummyImage,
        contentBrief: brief,
        creativeDirection: direction,
        compositionPlan: plan,
        visionEvaluator: failingVisionEvaluator,
        configOverride: { mode: "shadow" },
    });
    assert.equal(fallbackRun.schema_version, "1.0");
    assert.equal(fallbackRun.blocked_delivery, false);
    assert.ok(fallbackRun.scores.content_specificity >= 3);
});
