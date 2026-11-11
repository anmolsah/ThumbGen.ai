/**
 * tests/providers.test.ts
 *
 * Phase 2 unit and contract tests for the Provider Adapter Layer:
 *   - Per-model parameter mapping (OpenRouter & xAI)
 *   - Pitfalls P2, P3, P4 enforcement
 *   - Error classification (retryable vs non-retryable vs policy rejection)
 *   - MockAdapter, OpenRouterAdapter, and XaiAdapter contract tests
 */

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  classifyProviderError,
  generate,
  getEligibleCandidatesForMode,
  inspectImageResolution,
  mapOpenRouterParams,
  mapXaiParams,
  MockAdapter,
  normalizeAspectRatioForModel,
  normalizeResolutionTier,
  OpenRouterAdapter,
  ProviderError,
  resetMockState,
  XaiAdapter,
} from "../providers/index.js";

test("normalizeResolutionTier converts lowercase tiers and pixel strings to canonical tiers (Pitfall P2/P3)", () => {
  assert.equal(normalizeResolutionTier("1k", "openrouter", "m"), "1K");
  assert.equal(normalizeResolutionTier("2k", "openrouter", "m"), "2K");
  assert.equal(normalizeResolutionTier("4k", "openrouter", "m"), "4K");
  assert.equal(normalizeResolutionTier("1920x1080", "openrouter", "m"), "2K");
  assert.equal(normalizeResolutionTier("3840x2160", "openrouter", "m"), "4K");
  assert.equal(normalizeResolutionTier("1280x720", "openrouter", "m"), "1K");

  assert.throws(
    () => normalizeResolutionTier("", "openrouter", "m"),
    (err: any) => err instanceof ProviderError && err.code === "INVALID_PARAMETERS"
  );
});

test("normalizeAspectRatioForModel maps 1.91:1 to 16:9 and clamps unsupported 4:5 to 3:4", () => {
  const grokRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
  assert.equal(normalizeAspectRatioForModel("1.91:1", grokRatios), "16:9");
  assert.equal(normalizeAspectRatioForModel("4:5", grokRatios), "3:4");

  const seedreamRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5"];
  assert.equal(normalizeAspectRatioForModel("4:5", seedreamRatios), "4:5");
});

test("mapOpenRouterParams maps Seedream 5.0 Flash, Pro, and Lite parameters explicitly", () => {
  const flashParams = mapOpenRouterParams(
    "bytedance-seed/seedream-5-0-flash",
    {
      mode: "fast",
      prompt: "Gaming thumbnail",
      aspectRatio: "16:9",
      resolution: "2k",
    }
  );
  assert.equal(flashParams.model, "bytedance-seed/seedream-5-0-flash");
  assert.equal(flashParams.resolution, "2K");
  assert.equal(flashParams.aspect_ratio, "16:9");
  assert.equal(flashParams.n, 1);

  // Seedream 5.0 Flash tops out at 2K -> 4K must throw UNSUPPORTED_CAPABILITY
  assert.throws(
    () =>
      mapOpenRouterParams("bytedance-seed/seedream-5-0-flash", {
        mode: "fast",
        prompt: "Gaming thumbnail",
        aspectRatio: "16:9",
        resolution: "4K",
      }),
    (err: any) =>
      err instanceof ProviderError &&
      err.code === "UNSUPPORTED_CAPABILITY" &&
      err.retryable === false
  );

  // Seedream 5.0 Lite supports 2K and 4K
  const lite4k = mapOpenRouterParams("bytedance-seed/seedream-5-0-lite", {
    mode: "premium",
    prompt: "4K tech review thumbnail",
    aspectRatio: "16:9",
    resolution: "4K",
  });
  assert.equal(lite4k.resolution, "4K");
});

test("mapOpenRouterParams maps Grok Imagine Image 2.0 with resolution + quality and rejects >3 reference images", () => {
  const grokParams = mapOpenRouterParams("x-ai/grok-imagine-image-2.0", {
    mode: "standard",
    prompt: "Podcast cover",
    aspectRatio: "4:5",
    resolution: "2K",
    referenceImages: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
  });

  assert.equal(grokParams.resolution, "2K");
  assert.equal(grokParams.quality, "medium");
  assert.equal(grokParams.aspect_ratio, "3:4");
  assert.deepEqual(grokParams.input_references, [
    "data:image/png;base64,AAA",
    "data:image/png;base64,BBB",
  ]);

  // >3 reference images on Grok 2.0 must fail validation
  assert.throws(
    () =>
      mapOpenRouterParams("x-ai/grok-imagine-image-2.0", {
        mode: "standard",
        prompt: "Podcast cover",
        aspectRatio: "16:9",
        resolution: "2K",
        referenceImages: ["1", "2", "3", "4"],
      }),
    (err: any) =>
      err instanceof ProviderError && err.code === "INVALID_PARAMETERS"
  );

  // 4K on Grok 2.0 must fail capability check (Pitfall P4)
  assert.throws(
    () =>
      mapOpenRouterParams("x-ai/grok-imagine-image-2.0", {
        mode: "standard",
        prompt: "Podcast cover",
        aspectRatio: "16:9",
        resolution: "4K",
      }),
    (err: any) =>
      err instanceof ProviderError && err.code === "UNSUPPORTED_CAPABILITY"
  );
});

test("mapOpenRouterParams maps openai/gpt-image-2 using quality (without resolution) and rejects 4K", () => {
  const gptParams = mapOpenRouterParams("openai/gpt-image-2", {
    mode: "ultra",
    prompt: "Bold typography thumbnail",
    aspectRatio: "16:9",
    resolution: "2K",
  });

  assert.equal(gptParams.model, "openai/gpt-image-2");
  assert.equal(gptParams.quality, "medium");
  assert.equal(gptParams.output_format, "png");
  assert.equal("resolution" in gptParams, false);

  assert.throws(
    () =>
      mapOpenRouterParams("openai/gpt-image-2", {
        mode: "ultra",
        prompt: "Bold typography thumbnail",
        aspectRatio: "16:9",
        resolution: "4K",
      }),
    (err: any) =>
      err instanceof ProviderError && err.code === "UNSUPPORTED_CAPABILITY"
  );
});

test("mapXaiParams maps generations vs edits endpoints and rejects 4K (Pitfall P4)", () => {
  const gen = mapXaiParams("grok-imagine-image-2.0", {
    mode: "standard",
    prompt: "Dramatic studio portrait",
    aspectRatio: "16:9",
    resolution: "2K",
  });
  assert.equal(gen.endpointPath, "/images/generations");
  assert.equal(gen.body.resolution, "2k");
  assert.equal(gen.body.quality, "medium");

  const edit = mapXaiParams("grok-imagine-image-2.0", {
    mode: "standard",
    prompt: "Dramatic studio portrait",
    aspectRatio: "16:9",
    resolution: "2K",
    referenceImages: ["https://example.com/ref.png"],
  });
  assert.equal(edit.endpointPath, "/images/edits");
  assert.deepEqual(edit.body.image, { url: "https://example.com/ref.png" });

  assert.throws(
    () =>
      mapXaiParams("grok-imagine-image-2.0", {
        mode: "standard",
        prompt: "4K test",
        aspectRatio: "16:9",
        resolution: "4K",
      }),
    (err: any) =>
      err instanceof ProviderError && err.code === "UNSUPPORTED_CAPABILITY"
  );
});

test("classifyProviderError distinguishes retryable errors, policy rejections, and invalid params", () => {
  const rateLimit = classifyProviderError(
    429,
    '{"error":"Too Many Requests"}',
    "openrouter",
    "bytedance-seed/seedream-5-0-flash"
  );
  assert.equal(rateLimit.code, "RATE_LIMITED");
  assert.equal(rateLimit.retryable, true);
  assert.equal(rateLimit.isPolicyRejection, false);

  const serverErr = classifyProviderError(
    503,
    '{"error":"Service Unavailable"}',
    "openrouter",
    "bytedance-seed/seedream-5-0-pro"
  );
  assert.equal(serverErr.code, "PROVIDER_5XX");
  assert.equal(serverErr.retryable, true);

  const timeoutErr = classifyProviderError(
    504,
    "Gateway Timeout",
    "openrouter",
    "bytedance-seed/seedream-5-0-pro"
  );
  assert.equal(timeoutErr.code, "PROVIDER_TIMEOUT");
  assert.equal(timeoutErr.retryable, true);

  const policyErr = classifyProviderError(
    400,
    '{"error":{"message":"Prompt blocked by content_policy safety moderation"}}',
    "openrouter",
    "bytedance-seed/seedream-5-0-pro"
  );
  assert.equal(policyErr.code, "CONTENT_POLICY_REJECTED");
  assert.equal(policyErr.retryable, false);
  assert.equal(policyErr.isPolicyRejection, true);

  const paramErr = classifyProviderError(
    400,
    '{"error":{"message":"Invalid aspect_ratio"}}',
    "openrouter",
    "bytedance-seed/seedream-5-0-pro"
  );
  assert.equal(paramErr.code, "INVALID_PARAMETERS");
  assert.equal(paramErr.retryable, false);
  assert.equal(paramErr.isPolicyRejection, false);

  const authErr = classifyProviderError(
    401,
    '{"error":{"message":"Unauthorized"}}',
    "xai",
    "grok-imagine-image"
  );
  assert.equal(authErr.code, "AUTH_ERROR");
  assert.equal(authErr.retryable, false);
});

test("MockAdapter contract: generates verified 2K (1920x1080) and 4K (3840x2160) images and simulates errors", async () => {
  resetMockState();
  const mock = new MockAdapter();

  const out2k = await mock.generateWithCandidate("mock/fast", {
    mode: "fast",
    prompt: "Bright tech review thumbnail",
    aspectRatio: "16:9",
    resolution: "2K",
  });
  assert.equal(out2k.meta.provider, "mock");
  assert.equal(out2k.meta.resolution_actual.width, 1920);
  assert.equal(out2k.meta.resolution_actual.height, 1080);
  assert.equal(out2k.meta.resolution_actual.tier, "2K");

  const out4k = await mock.generateWithCandidate("mock/ultra", {
    mode: "ultra",
    prompt: "Ultra 4K cinema thumbnail",
    aspectRatio: "16:9",
    resolution: "4K",
  });
  assert.equal(out4k.meta.resolution_actual.width, 3840);
  assert.equal(out4k.meta.resolution_actual.height, 2160);
  assert.equal(out4k.meta.resolution_actual.tier, "4K");

  await assert.rejects(
    () =>
      mock.generateWithCandidate("mock/fast", {
        mode: "fast",
        prompt: "Trigger __MOCK_FAIL_429__",
        aspectRatio: "16:9",
        resolution: "2K",
      }),
    (err: any) =>
      err instanceof ProviderError &&
      err.code === "RATE_LIMITED" &&
      err.retryable === true
  );
});

test("OpenRouterAdapter contract: sends mapped body, extracts b64_json & usage.cost, and redacts base64 refs in meta", async () => {
  const sampleBuf = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: { r: 100, g: 50, b: 200 },
    },
  })
    .png()
    .toBuffer();

  let capturedUrl = "";
  let capturedBody: any = null;

  const fakeFetch: typeof fetch = async (inputUrl: any, init?: any) => {
    capturedUrl = String(inputUrl);
    capturedBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        created: Date.now(),
        data: [
          {
            b64_json: sampleBuf.toString("base64"),
            media_type: "image/png",
          },
        ],
        usage: {
          cost: 0.018,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const adapter = new OpenRouterAdapter({
    apiKey: "test-or-key",
    fetchImpl: fakeFetch,
  });

  const result = await adapter.generateWithCandidate(
    "bytedance-seed/seedream-5-0-flash",
    {
      mode: "fast",
      prompt: "Red sports car thumbnail",
      aspectRatio: "16:9",
      resolution: "2K",
      referenceImages: [
        `data:image/png;base64,${sampleBuf.toString("base64")}`,
      ],
    }
  );

  assert.equal(capturedUrl, "https://openrouter.ai/api/v1/images");
  assert.equal(capturedBody.model, "bytedance-seed/seedream-5-0-flash");
  assert.equal(capturedBody.resolution, "2K");
  assert.equal(capturedBody.aspect_ratio, "16:9");
  assert.equal(result.meta.billed_cost_usd, 0.018);
  assert.equal(result.meta.resolution_actual.dimensions, "1920x1080");
  assert.equal(result.meta.resolution_actual.tier, "2K");

  // Verify base64 reference image was redacted in meta.request_params
  const metaRefs = result.meta.request_params.input_references as string[];
  assert.equal(metaRefs.length, 1);
  assert.match(metaRefs[0], /\[redacted_b64_/);
});

test("XaiAdapter contract: sends mapped body to /images/generations and parses response", async () => {
  const sampleBuf = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: { r: 10, g: 180, b: 90 },
    },
  })
    .png()
    .toBuffer();

  let capturedUrl = "";
  let capturedBody: any = null;

  const fakeFetch: typeof fetch = async (inputUrl: any, init?: any) => {
    capturedUrl = String(inputUrl);
    capturedBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        data: [
          {
            b64_json: sampleBuf.toString("base64"),
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const adapter = new XaiAdapter({
    apiKey: "test-xai-key",
    fetchImpl: fakeFetch,
  });

  const result = await adapter.generateWithCandidate("grok-imagine-image-2.0", {
    mode: "standard",
    prompt: "Neon cyberpunk city",
    aspectRatio: "16:9",
    resolution: "2K",
  });

  assert.equal(capturedUrl, "https://api.x.ai/v1/images/generations");
  assert.equal(capturedBody.model, "grok-imagine-image-2.0");
  assert.equal(capturedBody.resolution, "2k");
  assert.equal(result.meta.resolution_actual.tier, "2K");
});

test("getEligibleCandidatesForMode and generate() enforce mode-level and candidate-level resolution caps", async () => {
  // Fast mode tops out at 2K -> 4K request must throw UNSUPPORTED_CAPABILITY
  assert.throws(
    () => getEligibleCandidatesForMode("fast", "4K"),
    (err: any) =>
      err instanceof ProviderError && err.code === "UNSUPPORTED_CAPABILITY"
  );

  // Ultra mode supports 4K via seedream-5-0-lite (and any other verified 4K candidates)
  const ultra4kCandidates = getEligibleCandidatesForMode("ultra", "4K");
  assert.ok(ultra4kCandidates.length >= 1);
  assert.ok(
    ultra4kCandidates.some(
      (c) => c.model_id === "bytedance-seed/seedream-5-0-lite"
    )
  );

  // Unified generate() with forceMock returns valid 2K output
  const res = await generate(
    {
      mode: "standard",
      prompt: "Unified generate test",
      aspectRatio: "16:9",
      resolution: "2K",
    },
    { forceMock: true }
  );
  assert.equal(res.meta.resolution_actual.tier, "2K");
});
