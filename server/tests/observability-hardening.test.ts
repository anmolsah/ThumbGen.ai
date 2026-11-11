/**
 * tests/observability-hardening.test.ts
 *
 * Phase 7 & Phase 8 Verification Suite (PLAN.md Sections 1 R9, 7, 10A.4, 10A.9, 11, 12 Phase 7 & 8, 13):
 *   1. Section 13(a) 50-parallel-request concurrent spend race test (balance=5, cost=5 -> 1 succeeds, 49 fail)
 *   2. 100-job concurrent load test measuring throughput, p50/p95 latency, queue wait p95, and Prometheus `/metrics`
 *   3. Secret & Base64 redaction in structured JSON logs (Rule R9)
 *   4. Daily provider spend cap kill switch (`503 SPEND_CAP_REACHED`) + Alert Rule evaluations
 *   5. Sliding-window per-user rate limiter (`429 RATE_LIMITED` + `Retry-After`)
 *   6. Phase 7 server-side text overlay (WCAG >= 4.5:1 contrast + auto scrim, face avoidance, banned effects guard),
 *      smart-crop (`16:9` -> `1:1`, `9:16`, `4:5`), and provenance metadata inspection (`10A.9` / `P13`)
 */

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  CreditService,
  CreditServiceError,
  InMemoryCreditStore,
} from "../services/creditService.js";
import {
  ObservabilityManager,
  SlidingWindowRateLimiter,
  sanitizeLogPayload,
  computePercentile,
} from "../services/observabilityService.js";
import {
  applyServerTextOverlay,
  smartCropFromMaster,
  inspectProvenanceMetadata,
} from "../services/postProcessService.js";
import { getProviderAdapter } from "../providers/index.js";

test("Section 13(a): 50 parallel job requests with balance of 5 credits at 5 credits each -> exactly 1 succeeds and 49 fail", async () => {
  const store = new InMemoryCreditStore();
  await store.seedUser({
    id: "user_race_50",
    plan: "pro",
    credits: 5,
    totalCredits: 5,
  });

  const service = new CreditService({ store });

  const requests = Array.from({ length: 50 }, (_, idx) =>
    service
      .reserveCreditsAndCreateJob({
        userId: "user_race_50",
        idempotencyKey: `idem_race_50_${idx}`,
        mode: "ultra", // 5 credits
        resolution: "1K",
        aspectRatio: "16:9",
        prompt: `Concurrent load test prompt #${idx}`,
      })
      .then((res) => ({ status: "fulfilled" as const, value: res }))
      .catch((err) => ({ status: "rejected" as const, reason: err }))
  );

  const outcomes = await Promise.all(requests);
  const succeeded = outcomes.filter((o) => o.status === "fulfilled");
  const failed = outcomes.filter((o) => o.status === "rejected");

  assert.equal(succeeded.length, 1, "Exactly 1 of the 50 parallel requests must succeed");
  assert.equal(failed.length, 49, "Exactly 49 of the 50 parallel requests must be rejected");

  for (const failure of failed) {
    assert.ok(failure.reason instanceof CreditServiceError);
    assert.equal(failure.reason.code, "INSUFFICIENT_CREDITS");
    assert.equal(failure.reason.status, 402);
  }

  const finalUser = await store.getUserById("user_race_50");
  assert.ok(finalUser);
  assert.equal(finalUser.credits, 0, "User balance must be 0 and never negative");

  const ledgerEntries = await store.findLedgerEntriesForUser("user_race_50");
  assert.equal(ledgerEntries.length, 1);
  assert.equal(ledgerEntries[0].type, "reserve");
  assert.equal(ledgerEntries[0].delta, -5);
  assert.equal(ledgerEntries[0].balance_after, 0);
});

test("Phase 8 Load Test: 100 concurrent job executions through adapter + observability pipeline with Prometheus metrics", async () => {
  const obs = new ObservabilityManager({
    dailySpendCapUsd: 50,
    persistToDb: false,
    loggerFn: () => {},
  });
  const mockAdapter = getProviderAdapter("mock");

  const modes = [
    { mode: "fast", provider: "openrouter", modelId: "black-forest-labs/flux.2-klein-4b", credits: 1, cost: 0.015 },
    { mode: "standard", provider: "openrouter", modelId: "google/gemini-3.1-flash-image-preview", credits: 2, cost: 0.067 },
    { mode: "premium", provider: "openrouter", modelId: "black-forest-labs/flux.2-pro", credits: 4, cost: 0.07 },
    { mode: "ultra", provider: "openrouter", modelId: "google/gemini-3-pro-image-preview", credits: 5, cost: 0.134 },
  ] as const;

  const startWall = Date.now();
  const latencies: number[] = [];

  const tasks = Array.from({ length: 100 }, async (_, idx) => {
    const spec = modes[idx % modes.length];
    const queueWaitMs = 40 + (idx % 12) * 15;
    const t0 = Date.now();

    const out = await mockAdapter.generateWithCandidate(spec.modelId, {
      mode: spec.mode,
      prompt: `Load test thumbnail #${idx}: high contrast tech studio`,
      aspectRatio: "16:9",
      resolution: "1K",
    });

    const elapsed = Date.now() - t0;
    latencies.push(elapsed);

    await obs.recordGenerationEvent({
      job_id: `job_load_${idx}`,
      user_id: `user_${idx % 10}`,
      mode: spec.mode,
      provider: spec.provider,
      model_id: spec.modelId,
      attempt: 1,
      latency_ms: elapsed,
      queue_wait_ms: queueWaitMs,
      status: "succeeded",
      error_code: null,
      reserved_credits: spec.credits,
      final_credits: spec.credits,
      est_cost_usd: spec.cost,
      billed_cost_usd: spec.cost,
      resolution_actual: out.meta.resolution_actual,
      request_params: out.meta.request_params,
    });
  });

  await Promise.all(tasks);
  const totalWallMs = Date.now() - startWall;

  const summary = obs.getMetricsSnapshot();
  assert.equal(summary.total_jobs, 100);
  assert.equal(summary.failed_jobs, 0);
  assert.ok(summary.queue_wait_p95_seconds > 0);
  assert.ok(computePercentile(latencies, 95) >= computePercentile(latencies, 50));
  assert.ok(totalWallMs < 15000, `100 concurrent jobs completed in ${totalWallMs}ms`);

  const promText = obs.renderPrometheusMetrics();
  assert.match(promText, /thumbgen_model_latency_p95_ms/);
  assert.match(promText, /thumbgen_daily_provider_spend_usd/);
  assert.match(promText, /thumbgen_queue_wait_p95_seconds/);
});

test("Rule R9: sanitizeLogPayload strips API keys, Bearer tokens, and base64 image payloads", () => {
  const rawFakeBase64 = "A".repeat(700);
  const dirty = {
    prompt: "Clean studio microphone",
    api_key: "sk-or-v1-secret-value-12345",
    OPENROUTER_API_KEY: "sk-or-v1-top-secret",
    authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    referenceImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
    rawBlob: rawFakeBase64,
    nested: {
      xai_api_key: "xai-secret-999",
      safeField: 42,
    },
  };

  const sanitized = sanitizeLogPayload(dirty) as any;
  assert.equal(sanitized.prompt, "Clean studio microphone");
  assert.equal(sanitized.api_key, "[REDACTED_SECRET]");
  assert.equal(sanitized.OPENROUTER_API_KEY, "[REDACTED_SECRET]");
  assert.equal(sanitized.authHeader, "[REDACTED_SECRET]");
  assert.match(sanitized.referenceImage, /^\[REDACTED_DATA_URI:/);
  assert.match(sanitized.rawBlob, /^\[REDACTED_BASE64:/);
  assert.equal(sanitized.nested.xai_api_key, "[REDACTED_SECRET]");
  assert.equal(sanitized.nested.safeField, 42);
});

test("Phase 8 Kill Switch & Alerts: daily spend cap blocks new generations with 503 SPEND_CAP_REACHED and fires alerts", async () => {
  const obs = new ObservabilityManager({
    dailySpendCapUsd: 1.0,
    persistToDb: false,
    loggerFn: () => {},
  });
  assert.equal(obs.isKillSwitchActive(), false);

  for (let i = 0; i < 5; i++) {
    await obs.recordGenerationEvent({
      job_id: `job_spend_${i}`,
      user_id: "user_1",
      mode: "ultra",
      provider: "openrouter",
      model_id: "google/gemini-3-pro-image-preview",
      attempt: 1,
      latency_ms: 1200,
      queue_wait_ms: 35000, // > 30s to trigger queue_wait_p95_high
      status: "failed",
      error_code: "PROVIDER_5XX",
      reserved_credits: 5,
      final_credits: 0, // refunded
      est_cost_usd: 0.25,
      billed_cost_usd: 0.25,
      resolution_actual: null,
    });
  }

  obs.setCircuitBreakerState("openrouter", "google/gemini-3-pro-image-preview", true);

  assert.equal(obs.isKillSwitchActive(), true);
  assert.throws(
    () => obs.assertSpendBelowCap(),
    (err: any) =>
      err instanceof CreditServiceError &&
      err.code === "SPEND_CAP_REACHED" &&
      err.status === 503
  );

  const alerts = obs.evaluateAlertRules();
  const byRule = Object.fromEntries(alerts.map((a) => [a.rule, a]));
  assert.equal(byRule.daily_provider_spend_exceeded.firing, true);
  assert.equal(byRule.provider_error_rate_high.firing, true);
  assert.equal(byRule.credit_refund_rate_high.firing, true);
  assert.equal(byRule.queue_wait_p95_high.firing, true);
  assert.equal(byRule.circuit_breaker_open.firing, true);
});

test("Phase 8 Abuse Protection: SlidingWindowRateLimiter blocks bursts above limit with Retry-After", () => {
  const limiter = new SlidingWindowRateLimiter({
    maxRequests: 3,
    windowMs: 60_000,
  });
  const t0 = 1_700_000_000_000;

  assert.equal(limiter.check("user_burst", t0).allowed, true);
  assert.equal(limiter.check("user_burst", t0 + 100).allowed, true);
  assert.equal(limiter.check("user_burst", t0 + 200).allowed, true);

  const fourth = limiter.check("user_burst", t0 + 300);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.remaining, 0);
  assert.ok(fourth.retryAfterSeconds >= 59);

  // After window expires, user can generate again
  const afterWindow = limiter.check("user_burst", t0 + 61_000);
  assert.equal(afterWindow.allowed, true);
});

test("Phase 7 Typography, Smart-Crop & Provenance: WCAG >= 4.5:1 auto-scrim, face avoidance, banned effects guard, 1:1/9:16/4:5 crop, and provenance check", async () => {
  // Create a bright white 1280x720 image where white text (#FFFFFF) has 1.0:1 contrast without a scrim
  const brightMaster = await sharp({
    create: {
      width: 1280,
      height: 720,
      channels: 3,
      background: { r: 250, g: 250, b: 250 },
    },
  })
    .png()
    .toBuffer();

  // 1. Banned effect must be rejected
  await assert.rejects(
    () =>
      applyServerTextOverlay(brightMaster, {
        text: "BANNED EFFECT",
        effectPreset: "gold_3d_bevel",
      }),
    /BANNED_TEXT_EFFECT/
  );

  // 2. Low-contrast white text on white background must auto-apply dark scrim and achieve >= 4.5:1 contrast
  // Also pass a face region occupying the bottom zone so the placement engine moves the title to the top zone
  const overlayRes = await applyServerTextOverlay(brightMaster, {
    text: "WHY I SWITCHED",
    textColorHex: "#FFFFFF",
    position: "bottom",
    faceRegions: [{ left: 300, top: 480, width: 400, height: 220 }],
  });

  assert.ok(overlayRes.initialContrastRatio < 1.5, "Initial white-on-white contrast is < 1.5:1");
  assert.equal(overlayRes.scrimApplied, true, "Scrim must be auto-applied when contrast < 4.5:1");
  assert.ok(
    overlayRes.finalContrastRatio >= 4.5,
    `Final contrast ratio (${overlayRes.finalContrastRatio}) must meet WCAG 4.5:1`
  );
  assert.ok(
    overlayRes.placedRegion.top < 200,
    "Text region must relocate to top to avoid overlapping bottom face region"
  );

  // 3. Smart-crop from 16:9 master to 1:1, 9:16, and 4:5
  const cropSquare = await smartCropFromMaster(overlayRes.buffer, "1:1");
  assert.equal(cropSquare.width, 720);
  assert.equal(cropSquare.height, 720);

  const cropVertical = await smartCropFromMaster(overlayRes.buffer, "9:16");
  assert.equal(cropVertical.width, 405);
  assert.equal(cropVertical.height, 720);

  const cropPortrait = await smartCropFromMaster(overlayRes.buffer, "4:5");
  assert.equal(cropPortrait.width, 576);
  assert.equal(cropPortrait.height, 720);

  // 4. Provenance metadata inspection (10A.9 / P13)
  const prov = await inspectProvenanceMetadata(brightMaster);
  assert.equal(prov.format, "webp");
  assert.equal(prov.survivesPostProcessing, false);
  assert.match(prov.notes, /Sharp/i);
});
