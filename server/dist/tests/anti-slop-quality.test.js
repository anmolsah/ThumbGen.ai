/**
 * tests/anti-slop-quality.test.ts
 *
 * Phase 5.5 / Section 10A & Section 13 Verification Suite:
 *   1. Brief compiler:
 *      - Output validates against StructuredBrief JSON schema
 *      - Invalid LLM output is rejected and retried at most once (max 2 LLM attempts)
 *      - User-typed words are NEVER removed (even if user types words in slop_lexicon.yaml)
 *      - Compiler-added fragments never contain slop_lexicon terms
 *      - Same seed produces the exact same prompt
 *      - Per-user variation history avoids repeating light/background fragments within last 10 runs
 *   2. Automated QA Gate:
 *      - Layer 1 deterministic checks detect degenerate blank images, blur, and duplicate perceptual hash
 *      - Single auto-retry invariant: retries at most once (never a loop), charges 0 extra credits
 *      - Second failure honors both "deliver_best_flagged" and "refund" policies (Section 15 Q12)
 *   3. Platform Preset Exporter (Section 10A.11 & Appendix A.3):
 *      - Produces primary sRGB asset at verified preset dimensions (1280x720 / 3840x2160)
 *      - Produces guaranteed <= 2 MB JPG fallback via quality loop
 *      - Produces 320x180 mobile feed preview for small-size legibility check
 *      - Rejects unverified platforms whose specs are null in config/platform_presets.yaml (Rule R3)
 */
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { compileThumbnailBrief, validateStructuredBrief, defaultVariationHistory, } from "../services/briefCompiler.js";
import { runLayer1DeterministicQa, executeWithQaGate, computePerceptualHash64, } from "../services/qaGateService.js";
import { exportForPlatformPreset, applyServerTextOverlay, } from "../services/postProcessService.js";
import { getR2ConfigFromEnv } from "../services/r2StorageService.js";
test("Section 13 Brief Compiler: schema validation, max 1 LLM retry, user words preserved verbatim, deterministic seed, and per-user variation", async () => {
    // 1. User types words that happen to be in slop_lexicon.yaml ("masterpiece", "8k", "glowing"):
    // Rule 10A.2: NEVER censor or rewrite words the user typed!
    const userPromptWithSlopWords = "My 8k glowing retro CRT monitor masterpiece teardown on workbench";
    const runA = await compileThumbnailBrief({
        userPrompt: userPromptWithSlopWords,
        stylePreset: "product_focus",
        platformPreset: "youtube_video",
        titleText: "CRT SECRET",
        seed: 424242,
    });
    const runB = await compileThumbnailBrief({
        userPrompt: userPromptWithSlopWords,
        stylePreset: "product_focus",
        platformPreset: "youtube_video",
        titleText: "CRT SECRET",
        seed: 424242,
    });
    // Same seed -> identical prompt
    assert.equal(runA.finalPrompt, runB.finalPrompt);
    // Output validates against JSON schema
    const schemaCheck = validateStructuredBrief(runA.structuredBrief);
    assert.equal(schemaCheck.valid, true, schemaCheck.errors.join("; "));
    // User-typed words are 100% preserved
    assert.ok(runA.finalPrompt.includes(userPromptWithSlopWords), "User-typed words must never be stripped or rewritten");
    // Title text is reserved for code overlay renderer and NOT injected as AI image text
    assert.equal(runA.structuredBrief.composition.reserved_text_region, "left-third");
    assert.equal(runA.finalPrompt.includes("CRT SECRET"), false);
    // 2. Invalid LLM JSON output is rejected and retried AT MOST ONCE (2 attempts total), then falls back
    let llmCallCount = 0;
    const badLlmRes = await compileThumbnailBrief({
        userPrompt: "Mechanic holding torque wrench in garage",
        stylePreset: "photoreal_candid",
        seed: 99,
        llmBriefGenerator: async () => {
            llmCallCount++;
            return { invalid_json: true }; // fails schema validation
        },
    });
    assert.equal(llmCallCount, 2, "Invalid LLM output must be retried at most once (1 initial + 1 retry = 2 calls)");
    assert.equal(badLlmRes.llmAttempts, 2);
    assert.equal(badLlmRes.usedFallbackSynthesis, true);
    assert.equal(validateStructuredBrief(badLlmRes.structuredBrief).valid, true);
    // 3. Per-user variation history avoids reusing the same light/background across consecutive runs
    defaultVariationHistory.reset();
    const seenLights = new Set();
    for (let i = 0; i < 5; i++) {
        const res = await compileThumbnailBrief({
            userPrompt: "Desk setup",
            userId: "user_variation_test",
        });
        seenLights.add(res.structuredBrief.light);
    }
    assert.equal(seenLights.size, 5, "Per-user variation history must pick distinct lighting fragments across consecutive runs");
});
test("Section 13 QA Gate: Layer 1 deterministic checks and single auto-retry (never a loop, 0 extra credits charged, Q12 policies)", async () => {
    // 1. Blank/solid image fails Layer 1 deterministic check (`blank_or_degenerate_flat_image`)
    const flatImage = await sharp({
        create: {
            width: 1280,
            height: 720,
            channels: 3,
            background: { r: 100, g: 100, b: 100 },
        },
    })
        .png()
        .toBuffer();
    const flatCheck = await runLayer1DeterministicQa({
        imageBuffer: flatImage,
        expectedAspectRatio: "16:9",
    });
    assert.equal(flatCheck.passed, false);
    assert.ok(flatCheck.defects.includes("blank_or_degenerate_flat_image"));
    // 2. High-contrast textured image passes Layer 1, and identical image is caught by perceptual hash anti-repeat
    const texturedSvg = `<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="720" fill="#111827"/>
    <rect x="80" y="80" width="520" height="560" fill="#F9FAFB" stroke="#E11D48" stroke-width="18"/>
    <circle cx="920" cy="360" r="220" fill="#F59E0B" stroke="#FFFFFF" stroke-width="14"/>
    <line x1="0" y1="0" x2="1280" y2="720" stroke="#10B981" stroke-width="12"/>
  </svg>`;
    const texturedBuffer = await sharp(Buffer.from(texturedSvg)).png().toBuffer();
    const goodCheck = await runLayer1DeterministicQa({
        imageBuffer: texturedBuffer,
        expectedAspectRatio: "16:9",
        minWidth: 640,
        textContrastRatio: 8.5,
    });
    assert.equal(goodCheck.passed, true, goodCheck.defects.join(", "));
    const phash = await computePerceptualHash64(texturedBuffer);
    const repeatCheck = await runLayer1DeterministicQa({
        imageBuffer: texturedBuffer,
        expectedAspectRatio: "16:9",
        recentUserPhashes: [phash],
    });
    assert.equal(repeatCheck.passed, false);
    assert.ok(repeatCheck.defects.includes("perceptual_hash_duplicate_of_recent_output"));
    // 3. Single auto-retry orchestration: fails attempt 1 -> retries once with corrective defects -> passes attempt 2
    const observedCorrectiveDefects = [];
    const retryPassOutcome = await executeWithQaGate({
        generateAttempt: async (attemptNum, correctiveDefects) => {
            observedCorrectiveDefects.push(correctiveDefects);
            const passed = attemptNum === 2;
            return {
                result: `asset_attempt_${attemptNum}`,
                qaEvaluation: {
                    passed,
                    qualityScore: passed ? 4 : 2,
                    defects: passed ? [] : ["extra_or_missing_limbs", "plastic_skin"],
                    layer1: goodCheck,
                    layer2: null,
                },
            };
        },
    });
    assert.equal(retryPassOutcome.status, "passed");
    assert.equal(retryPassOutcome.attemptsRun, 2);
    assert.equal(retryPassOutcome.autoRetried, true);
    assert.equal(retryPassOutcome.extraCreditsChargedForRetry, 0);
    assert.deepEqual(observedCorrectiveDefects[1], [
        "extra_or_missing_limbs",
        "plastic_skin",
    ]);
    // 4. Both attempts fail -> NEVER loops beyond 2 attempts; honors "deliver_best_flagged" and "refund"
    let totalCalls = 0;
    const flaggedOutcome = await executeWithQaGate({
        onSecondFailure: "deliver_best_flagged",
        generateAttempt: async (attemptNum) => {
            totalCalls++;
            return {
                result: `flagged_asset_${attemptNum}`,
                qaEvaluation: {
                    passed: false,
                    qualityScore: attemptNum === 1 ? 3 : 2,
                    defects: ["clutter_no_focal_point"],
                    layer1: goodCheck,
                    layer2: null,
                },
            };
        },
    });
    assert.equal(totalCalls, 2, "QA gate must never loop beyond 2 attempts");
    assert.equal(flaggedOutcome.status, "delivered_flagged");
    assert.equal(flaggedOutcome.qaFlagged, true);
    assert.equal(flaggedOutcome.selectedResult, "flagged_asset_1", "Delivers the higher-scoring attempt of the two");
    const refundOutcome = await executeWithQaGate({
        onSecondFailure: "refund",
        generateAttempt: async () => ({
            result: "bad_asset",
            qaEvaluation: {
                passed: false,
                qualityScore: 1,
                defects: ["garbled_pseudo_text"],
                layer1: goodCheck,
                layer2: null,
            },
        }),
    });
    assert.equal(refundOutcome.status, "refund_required");
    assert.equal(refundOutcome.attemptsRun, 2);
    assert.equal(refundOutcome.selectedResult, null);
});
test("Section 13 Platform Preset Exporter: YouTube 16:9 & Shorts 9:16 dimensions, <= 2 MB JPG fallback, and unverified platform rejection", async () => {
    const sourceSvg = `<svg width="3840" height="2160" xmlns="http://www.w3.org/2000/svg">
    <rect width="3840" height="2160" fill="#09090B"/>
    <circle cx="1920" cy="1080" r="700" fill="#E11D48"/>
  </svg>`;
    const master4kBuffer = await sharp(Buffer.from(sourceSvg)).png().toBuffer();
    // 1. YouTube Video 4K export: primary is 3840x2160, fallback JPG is 1280x720 and <= 2 MB, mobile preview is 320x180
    const yt4k = await exportForPlatformPreset(master4kBuffer, "youtube_video", "4K");
    assert.equal(yt4k.primaryWidth, 3840);
    assert.equal(yt4k.primaryHeight, 2160);
    assert.equal(yt4k.fallbackJpgWidth, 1280);
    assert.equal(yt4k.fallbackJpgHeight, 720);
    assert.ok(yt4k.fallbackJpgBytes <= 2 * 1024 * 1024, `Fallback JPG (${yt4k.fallbackJpgBytes} bytes) must be <= 2 MB`);
    assert.equal(yt4k.mobileFeedPreviewWidth, 320);
    assert.equal(yt4k.mobileFeedPreviewHeight, 180);
    // 2. YouTube Shorts export: primary 1080x1920, fallback <= 2 MB, mobile preview 180x320
    const shorts = await exportForPlatformPreset(master4kBuffer, "youtube_shorts", "2K");
    assert.equal(shorts.primaryWidth, 1080);
    assert.equal(shorts.primaryHeight, 1920);
    assert.ok(shorts.fallbackJpgBytes <= 2 * 1024 * 1024);
    assert.equal(shorts.mobileFeedPreviewWidth, 180);
    assert.equal(shorts.mobileFeedPreviewHeight, 320);
    // 3. Unverified platform preset in config/platform_presets.yaml is rejected (Rule R3)
    await assert.rejects(() => exportForPlatformPreset(master4kBuffer, "instagram_feed", "2K"), /UNVERIFIED_PLATFORM_PRESET/);
});
test("Studio Features 4, 5 & Cloudflare R2 Storage Config: draggable headline + vector pointer arrow overlay and R2 env detection", async () => {
    const baseBuffer = await sharp({
        create: {
            width: 1280,
            height: 720,
            channels: 3,
            background: { r: 18, g: 20, b: 28 },
        },
    })
        .png()
        .toBuffer();
    // Feature 5: Draggable custom (xPercent, yPercent) + accent color + pointer arrow ("right")
    const overlaid = await applyServerTextOverlay(baseBuffer, {
        text: "WHY WE SWITCHED",
        position: "left",
        xPercent: 34,
        yPercent: 42,
        textColorHex: "#F59E0B",
        pointerArrow: "right",
    });
    const meta = await sharp(overlaid.buffer).metadata();
    assert.equal(meta.width, 1280);
    assert.equal(meta.height, 720);
    assert.ok(overlaid.finalContrastRatio >= 4.5);
    // Verify R2 configuration detection when env vars are set
    const prevAccountId = process.env.R2_ACCOUNT_ID;
    const prevKey = process.env.R2_ACCESS_KEY_ID;
    const prevSecret = process.env.R2_SECRET_ACCESS_KEY;
    const prevBucket = process.env.R2_BUCKET_NAME;
    const prevPub = process.env.R2_PUBLIC_BASE_URL;
    try {
        process.env.R2_ACCOUNT_ID = "test_acc_123";
        process.env.R2_ACCESS_KEY_ID = "test_key_id";
        process.env.R2_SECRET_ACCESS_KEY = "test_secret";
        process.env.R2_BUCKET_NAME = "thumbgen-assets";
        process.env.R2_PUBLIC_BASE_URL = "https://pub-123.r2.dev/";
        const cfg = getR2ConfigFromEnv();
        assert.ok(cfg);
        assert.equal(cfg.bucketName, "thumbgen-assets");
        assert.equal(cfg.publicBaseUrl, "https://pub-123.r2.dev");
    }
    finally {
        if (prevAccountId === undefined)
            delete process.env.R2_ACCOUNT_ID;
        else
            process.env.R2_ACCOUNT_ID = prevAccountId;
        if (prevKey === undefined)
            delete process.env.R2_ACCESS_KEY_ID;
        else
            process.env.R2_ACCESS_KEY_ID = prevKey;
        if (prevSecret === undefined)
            delete process.env.R2_SECRET_ACCESS_KEY;
        else
            process.env.R2_SECRET_ACCESS_KEY = prevSecret;
        if (prevBucket === undefined)
            delete process.env.R2_BUCKET_NAME;
        else
            process.env.R2_BUCKET_NAME = prevBucket;
        if (prevPub === undefined)
            delete process.env.R2_PUBLIC_BASE_URL;
        else
            process.env.R2_PUBLIC_BASE_URL = prevPub;
    }
});
