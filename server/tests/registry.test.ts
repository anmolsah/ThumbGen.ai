import test from "node:test";
import assert from "node:assert/strict";
import {
  loadRegistryConfig,
  loadModelsSnapshot,
  validateRegistry,
  assertValidStartupRegistry,
  computeLowestPlanCreditValue,
  type RegistryConfig,
} from "../configs/registryValidator.js";
import { evaluateMarginGuard } from "../scripts/margin-guard.js";

const snapshot = loadModelsSnapshot();
const baseRegistry = loadRegistryConfig();

function makeValidVerifiedRegistry(): RegistryConfig {
  const clone: RegistryConfig = JSON.parse(JSON.stringify(baseRegistry));
  const nowIso = "2026-11-11T15:21:49.000Z";

  // Disable unverified xai provider or set verified_at for test
  clone.providers.xai.verified_at = nowIso;

  clone.modes.fast.candidates = [
    {
      provider: "openrouter",
      model_id: "bytedance-seed/seedream-5-0-flash",
      est_cost_usd: 0.018,
      verified_at: nowIso,
      source_url:
        "https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-5-0-flash/endpoints",
      preview: false,
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "2K",
    },
  ];

  clone.modes.standard.candidates = [
    {
      provider: "openrouter",
      model_id: "bytedance-seed/seedream-5-0-pro",
      est_cost_usd: 0.09,
      verified_at: nowIso,
      source_url:
        "https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-5-0-pro/endpoints",
      preview: false,
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "2K",
    },
    {
      provider: "openrouter",
      model_id: "x-ai/grok-imagine-image-2.0",
      est_cost_usd: 0.08,
      verified_at: nowIso,
      source_url:
        "https://openrouter.ai/api/v1/images/models/x-ai/grok-imagine-image-2.0/endpoints",
      preview: false,
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "2K",
    },
    {
      provider: "openrouter",
      model_id: "bytedance-seed/seedream-5-0-lite",
      est_cost_usd: 0.035,
      verified_at: nowIso,
      source_url:
        "https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-5-0-lite/endpoints",
      preview: false,
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "2K",
    },
  ];

  clone.modes.premium.candidates = [
    {
      provider: "openrouter",
      model_id: "bytedance-seed/seedream-5-0-pro",
      est_cost_usd: 0.09,
      verified_at: nowIso,
      source_url:
        "https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-5-0-pro/endpoints",
      preview: false,
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "2K",
    },
  ];

  clone.modes.ultra.candidates = [
    {
      provider: "openrouter",
      model_id: "bytedance-seed/seedream-5-0-lite",
      est_cost_usd: 0.035,
      verified_at: nowIso,
      source_url:
        "https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-5-0-lite/endpoints",
      preview: false,
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "4K",
    },
  ];

  return clone;
}

test("computeLowestPlanCreditValue identifies Creator plan at $0.145/credit", () => {
  const { planId, valuePerCreditUsd } = computeLowestPlanCreditValue(
    baseRegistry.plans
  );
  assert.equal(planId, "creator");
  assert.ok(Math.abs(valuePerCreditUsd - 0.145) < 1e-9);
});

test("current registry fails validation on unverified null values and blocks production startup", () => {
  const res = validateRegistry(baseRegistry, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "NULL_VALUE"));
  assert.ok(res.errors.some((e) => e.code === "LICENSE_NOT_CHECKED"));

  assert.throws(
    () => assertValidStartupRegistry({ nodeEnv: "production" }),
    /Production boot blocked by registry validation/
  );
});

test("fully verified registry passes validation with zero errors", () => {
  const validReg = makeValidVerifiedRegistry();
  const res = validateRegistry(validReg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(res.valid, true, JSON.stringify(res.errors, null, 2));
  assert.equal(res.errors.length, 0);
});

test("validator rejects unknown model_id not present in models.snapshot.json", () => {
  const reg = makeValidVerifiedRegistry();
  reg.modes.fast.candidates[0].model_id = "openrouter/non-existent-model-999";

  const res = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "UNKNOWN_MODEL_ID"));
});

test("validator rejects stale verified_at older than 30 days", () => {
  const reg = makeValidVerifiedRegistry();
  reg.modes.fast.candidates[0].verified_at = "2026-09-01T00:00:00.000Z";

  const res = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "STALE_VERIFIED_AT"));
});

test("validator rejects candidate with license_checked: false", () => {
  const reg = makeValidVerifiedRegistry();
  reg.modes.fast.candidates[0].license_checked = false;

  const res = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "LICENSE_NOT_CHECKED"));
});

test("validator enforces preview model flagging and fallback requirement", () => {
  const reg = makeValidVerifiedRegistry();
  reg.modes.premium.candidates = [
    {
      provider: "openrouter",
      model_id: "google/gemini-3.1-flash-image-preview",
      est_cost_usd: 0.05,
      verified_at: "2026-11-11T15:21:49.000Z",
      source_url: "https://openrouter.ai/api/v1/models",
      preview: false, // unflagged preview
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "2K",
    },
  ];

  const resUnflagged = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(resUnflagged.valid, false);
  assert.ok(
    resUnflagged.errors.some((e) => e.code === "UNFLAGGED_PREVIEW_MODEL")
  );

  // Flagged preview, but no non-preview fallback after it
  reg.modes.premium.candidates[0].preview = true;
  const resNoFallback = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(resNoFallback.valid, false);
  assert.ok(
    resNoFallback.errors.some((e) => e.code === "PREVIEW_WITHOUT_FALLBACK")
  );
});

test("validator rejects fallback candidate with higher estimated cost than primary", () => {
  const reg = makeValidVerifiedRegistry();
  // In standard mode, make candidate[1] more expensive than candidate[0]
  reg.modes.standard.candidates[0].est_cost_usd = 0.04;
  reg.modes.standard.candidates[1].est_cost_usd = 0.08;

  const res = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "FALLBACK_COST_HIGHER"));
});

test("validator rejects 4K resolution candidate if model does not support 4K natively or via verified upscaler", () => {
  const reg = makeValidVerifiedRegistry();
  // x-ai/grok-imagine-image-2.0 only supports ["1K", "2K"]
  reg.modes.ultra.candidates = [
    {
      provider: "openrouter",
      model_id: "x-ai/grok-imagine-image-2.0",
      est_cost_usd: 0.08,
      verified_at: "2026-11-11T15:21:49.000Z",
      source_url: "https://openrouter.ai/api/v1/images/models",
      preview: false,
      license_checked: true,
      supports_reference_image: true,
      default_resolution: "4K",
    },
  ];

  const res = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.code === "UNSUPPORTED_4K_RESOLUTION"));
});

test("validator allows MOCK_* candidates when allowMock is true", () => {
  const reg = makeValidVerifiedRegistry();
  reg.modes.fast.candidates = [
    {
      provider: "openrouter",
      model_id: "MOCK_FAST_MODEL",
      est_cost_usd: 0.01,
      verified_at: null,
      source_url: null,
      preview: false,
      license_checked: false,
      supports_reference_image: true,
      default_resolution: "2K",
    },
  ];

  const res = validateRegistry(reg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
    allowMock: true,
  });
  assert.equal(res.valid, true, JSON.stringify(res.errors, null, 2));
});

test("margin guard passes when all modes are <= 35% cost-to-revenue and fails when exceeded", () => {
  const validReg = makeValidVerifiedRegistry();
  const passReport = evaluateMarginGuard(validReg, { failOnUnverified: true });
  assert.equal(passReport.passed, true);
  assert.equal(passReport.failedModes.length, 0);

  // Break margin guard on Fast mode (1 credit = $0.145, 35% cap = $0.05075; set cost to $0.06)
  const failingReg = makeValidVerifiedRegistry();
  failingReg.modes.fast.candidates[0].est_cost_usd = 0.06;

  const failReport = evaluateMarginGuard(failingReg, { failOnUnverified: true });
  assert.equal(failReport.passed, false);
  assert.deepEqual(failReport.failedModes, ["fast"]);

  const valRes = validateRegistry(failingReg, snapshot, {
    now: new Date("2026-11-11T16:00:00.000Z"),
  });
  assert.equal(valRes.valid, false);
  assert.ok(valRes.errors.some((e) => e.code === "MARGIN_GUARD_EXCEEDED"));
});

