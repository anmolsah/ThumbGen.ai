/**
 * tests/queue-worker.test.ts
 *
 * Phase 4 chaos, fallback, circuit breaker, concurrency semaphore,
 * per-user active job cap, and queue hysteresis tests
 * (PLAN.md Sections 4, 6, 9, 12 Phase 4, 13).
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyProviderError,
  ProviderError,
  resetMockState,
  setMockFaultInjector,
} from "../providers/index.js";
import {
  CreditService,
  CreditServiceError,
  InMemoryCreditStore,
} from "../services/creditService.js";
import {
  ModelCircuitBreaker,
  QueueDepthGuard,
  runJobWithResilience,
  Semaphore,
} from "../services/resilience.js";

function createTestHarness() {
  const store = new InMemoryCreditStore();
  const creditService = new CreditService({ store });
  const circuitBreaker = new ModelCircuitBreaker();
  return { store, creditService, circuitBreaker };
}

test("Chaos test 1: Primary candidate fails (503) -> retries once -> falls back to secondary candidate -> succeeds -> user charged once", async () => {
  resetMockState();
  const { store, creditService, circuitBreaker } = createTestHarness();

  store.seedUser({
    id: "user_chaos_1",
    plan: "creator",
    credits: 10,
    totalCredits: 200,
  });

  // Force primary candidate in 'standard' mode (bytedance-seed/seedream-5-0-pro) to fail with 503
  setMockFaultInjector((modelId) => {
    if (modelId === "bytedance-seed/seedream-5-0-pro") {
      throw classifyProviderError(
        503,
        '{"error":"Primary model overloaded"}',
        "openrouter",
        modelId
      );
    }
  });

  try {
    const reservation = await creditService.reserveCreditsAndCreateJob({
      userId: "user_chaos_1",
      idempotencyKey: "chaos_fallback_ok",
      mode: "standard",
      resolution: "2K",
      aspectRatio: "16:9",
      prompt: "Chaos fallback test",
    });

    assert.equal(reservation.userCreditsAfter, 8); // 10 - 2 = 8

    const result = await runJobWithResilience({
      jobId: reservation.job.id,
      input: {
        mode: "standard",
        prompt: "Chaos fallback test",
        aspectRatio: "16:9",
        resolution: "2K",
      },
      creditService,
      fallbackOptions: {
        forceMock: true,
        circuitBreaker,
        maxRetriesPerCandidate: 1,
        baseBackoffMs: 5,
        maxBackoffMs: 15,
      },
    });

    // Primary failed twice (initial + 1 retry), secondary succeeded on first try -> 3 attempts total
    assert.equal(result.meta.fallback_used, true);
    assert.equal(result.meta.model_id, "x-ai/grok-imagine-image-2.0");
    assert.equal(result.meta.attempts.length, 3);
    assert.equal(
      result.meta.attempts[0].model_id,
      "bytedance-seed/seedream-5-0-pro"
    );
    assert.equal(result.meta.attempts[0].status, "failed");
    assert.equal(
      result.meta.attempts[1].model_id,
      "bytedance-seed/seedream-5-0-pro"
    );
    assert.equal(result.meta.attempts[1].status, "failed");
    assert.equal(
      result.meta.attempts[2].model_id,
      "x-ai/grok-imagine-image-2.0"
    );
    assert.equal(result.meta.attempts[2].status, "succeeded");

    // Verify user was charged exactly once (2 credits)
    const userAfter = await store.getUserById("user_chaos_1");
    assert.equal(userAfter?.credits, 8);

    const jobAfter = await store.findJobById(reservation.job.id);
    assert.equal(jobAfter?.status, "succeeded");
    assert.equal(jobAfter?.final_credits, 2);

    const ledgers = await store.findLedgerEntriesForJob(reservation.job.id);
    assert.equal(ledgers.length, 2); // 1 reserve (-2) + 1 commit (0)
    assert.equal(ledgers[0].type, "reserve");
    assert.equal(ledgers[1].type, "commit");
  } finally {
    resetMockState();
  }
});

test("Chaos test 2: All candidates fail (429/503) -> job marked failed -> 100% of reserved credits refunded automatically", async () => {
  resetMockState();
  const { store, creditService, circuitBreaker } = createTestHarness();

  store.seedUser({
    id: "user_chaos_2",
    plan: "creator",
    credits: 10,
    totalCredits: 200,
  });

  // Force ALL candidates to fail with 429 rate limit
  setMockFaultInjector((modelId) => {
    throw classifyProviderError(
      429,
      '{"error":"Upstream rate limit exceeded"}',
      "openrouter",
      modelId
    );
  });

  try {
    const reservation = await creditService.reserveCreditsAndCreateJob({
      userId: "user_chaos_2",
      idempotencyKey: "chaos_all_fail",
      mode: "standard",
      resolution: "2K",
      aspectRatio: "16:9",
      prompt: "Chaos all candidates fail test",
    });

    assert.equal(reservation.userCreditsAfter, 8);

    await assert.rejects(
      () =>
        runJobWithResilience({
          jobId: reservation.job.id,
          input: {
            mode: "standard",
            prompt: "Chaos all candidates fail test",
            aspectRatio: "16:9",
            resolution: "2K",
          },
          creditService,
          fallbackOptions: {
            forceMock: true,
            circuitBreaker,
            maxRetriesPerCandidate: 1,
            baseBackoffMs: 5,
            maxBackoffMs: 15,
          },
        }),
      (err: any) => {
        assert.ok(err instanceof ProviderError);
        assert.equal(err.code, "RATE_LIMITED");
        // 3 candidates in 'standard' mode x 2 attempts each = 6 attempts
        assert.equal(err.attempts?.length, 6);
        return true;
      }
    );

    // Verify job is 'failed', final_credits = 0, and user balance is restored to 10
    const jobAfter = await store.findJobById(reservation.job.id);
    assert.equal(jobAfter?.status, "failed");
    assert.equal(jobAfter?.final_credits, 0);
    assert.equal(jobAfter?.error_code, "RATE_LIMITED");

    const userAfter = await store.getUserById("user_chaos_2");
    assert.equal(
      userAfter?.credits,
      10,
      "User balance must be restored to 10 after all candidates fail"
    );

    const ledgers = await store.findLedgerEntriesForJob(reservation.job.id);
    assert.equal(ledgers.length, 2);
    assert.equal(ledgers[0].type, "reserve");
    assert.equal(ledgers[0].delta, -2);
    assert.equal(ledgers[1].type, "refund");
    assert.equal(ledgers[1].delta, 2);
  } finally {
    resetMockState();
  }
});

test("Chaos test 3: Content policy rejection (400 CONTENT_POLICY_REJECTED) does NOT retry or fallback and refunds immediately", async () => {
  resetMockState();
  const { store, creditService, circuitBreaker } = createTestHarness();

  store.seedUser({
    id: "user_chaos_3",
    plan: "pro",
    credits: 15,
    totalCredits: 400,
  });

  const reservation = await creditService.reserveCreditsAndCreateJob({
    userId: "user_chaos_3",
    idempotencyKey: "chaos_policy_reject",
    mode: "standard",
    resolution: "2K",
    aspectRatio: "16:9",
    prompt: "Prompt with __MOCK_FAIL_POLICY__",
  });

  assert.equal(reservation.userCreditsAfter, 13);

  await assert.rejects(
    () =>
      runJobWithResilience({
        jobId: reservation.job.id,
        input: {
          mode: "standard",
          prompt: "Prompt with __MOCK_FAIL_POLICY__",
          aspectRatio: "16:9",
          resolution: "2K",
        },
        creditService,
        fallbackOptions: {
          forceMock: true,
          circuitBreaker,
          maxRetriesPerCandidate: 1,
          baseBackoffMs: 5,
          maxBackoffMs: 15,
        },
      }),
    (err: any) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.code, "CONTENT_POLICY_REJECTED");
      assert.equal(err.isPolicyRejection, true);
      // Must NOT retry and must NOT fallback -> exactly 1 attempt total
      assert.equal(err.attempts?.length, 1);
      return true;
    }
  );

  const jobAfter = await store.findJobById(reservation.job.id);
  assert.equal(jobAfter?.status, "failed");
  assert.equal(jobAfter?.error_code, "CONTENT_POLICY_REJECTED");
  assert.equal(jobAfter?.final_credits, 0);

  const userAfter = await store.getUserById("user_chaos_3");
  assert.equal(userAfter?.credits, 15);
});

test("Circuit breaker: 5 consecutive failures or >50% failure rate over 20 reqs in 2m trips model for 60s and skips to next candidate", async () => {
  resetMockState();
  let fakeNow = 1_000_000;
  const breaker = new ModelCircuitBreaker({
    consecutiveFailureThreshold: 5,
    windowMinRequests: 20,
    failureRateThreshold: 0.5,
    windowMs: 120_000,
    cooldownMs: 60_000,
    nowFn: () => fakeNow,
  });

  const primaryModel = "bytedance-seed/seedream-5-0-pro";

  // 4 failures -> still closed
  for (let i = 0; i < 4; i++) {
    breaker.recordFailure("mock", primaryModel);
  }
  assert.equal(breaker.isOpen("mock", primaryModel), false);

  // 5th consecutive failure -> trips open for 60s
  breaker.recordFailure("mock", primaryModel);
  assert.equal(breaker.isOpen("mock", primaryModel), true);

  // While open, a job in 'standard' mode skips primary (0 attempts on primary) and runs secondary directly
  const { store, creditService } = createTestHarness();
  store.seedUser({
    id: "user_cb_1",
    plan: "creator",
    credits: 10,
    totalCredits: 200,
  });

  const res = await creditService.reserveCreditsAndCreateJob({
    userId: "user_cb_1",
    idempotencyKey: "cb_skip_primary",
    mode: "standard",
    resolution: "2K",
    prompt: "Circuit breaker skip test",
  });

  const out = await runJobWithResilience({
    jobId: res.job.id,
    input: {
      mode: "standard",
      prompt: "Circuit breaker skip test",
      aspectRatio: "16:9",
      resolution: "2K",
    },
    creditService,
    fallbackOptions: {
      forceMock: true,
      circuitBreaker: breaker,
      baseBackoffMs: 5,
      maxBackoffMs: 10,
    },
  });

  assert.equal(out.meta.attempts.length, 1);
  assert.equal(out.meta.model_id, "x-ai/grok-imagine-image-2.0");
  assert.equal(out.meta.fallback_used, true);

  // Advance clock by 59s -> still open
  fakeNow += 59_000;
  assert.equal(breaker.isOpen("mock", primaryModel), true);

  // Advance clock past 60s cooldown -> half-open (allows probe)
  fakeNow += 2_000;
  assert.equal(breaker.isOpen("mock", primaryModel), false);

  // Test sliding-window failure rate (>50% over 20 requests without 5 consecutive failures)
  const rateBreaker = new ModelCircuitBreaker({
    consecutiveFailureThreshold: 5,
    windowMinRequests: 20,
    failureRateThreshold: 0.5,
    windowMs: 120_000,
    cooldownMs: 60_000,
    nowFn: () => fakeNow,
  });

  // Record 19 requests alternating: 10 failures, 9 successes (never 5 consecutive failures)
  for (let i = 0; i < 19; i++) {
    if (i % 2 === 0) {
      rateBreaker.recordFailure("openrouter", "model_rate_test");
    } else {
      rateBreaker.recordSuccess("openrouter", "model_rate_test");
    }
  }
  assert.equal(rateBreaker.isOpen("openrouter", "model_rate_test"), false);

  // 20th request is a failure -> 11/20 = 55% > 50% -> trips open!
  rateBreaker.recordFailure("openrouter", "model_rate_test");
  assert.equal(rateBreaker.isOpen("openrouter", "model_rate_test"), true);
});

test("Per-provider concurrency Semaphore caps in-flight concurrent executions at maxConcurrency", async () => {
  const sem = new Semaphore(3);

  const tasks = Array.from({ length: 9 }, () =>
    sem.run(async () => {
      assert.ok(
        sem.getActiveCount() <= 3,
        `Active count ${sem.getActiveCount()} exceeded maxConcurrency 3`
      );
      await new Promise((r) => setTimeout(r, 15));
      return true;
    })
  );

  await Promise.all(tasks);
  assert.equal(sem.getPeakActiveCount(), 3);
  assert.equal(sem.getActiveCount(), 0);
});

test("Per-user active job concurrency caps (Starter: 2, Creator: 4, Pro: 6) and Global Queue Depth Guard with hysteresis", async () => {
  const { store, creditService } = createTestHarness();
  store.seedUser({
    id: "user_cap_starter",
    plan: "starter",
    credits: 25,
    totalCredits: 25,
  });

  // Starter max_concurrent_jobs = 2
  const j1 = await creditService.reserveCreditsAndCreateJob({
    userId: "user_cap_starter",
    idempotencyKey: "cap_1",
    mode: "fast",
    resolution: "2K",
    prompt: "Job 1",
  });
  const j2 = await creditService.reserveCreditsAndCreateJob({
    userId: "user_cap_starter",
    idempotencyKey: "cap_2",
    mode: "fast",
    resolution: "2K",
    prompt: "Job 2",
  });
  assert.ok(j1.job.id && j2.job.id);

  // 3rd concurrent job for Starter must fail with 429 TOO_MANY_CONCURRENT_JOBS without deducting credits
  await assert.rejects(
    () =>
      creditService.reserveCreditsAndCreateJob({
        userId: "user_cap_starter",
        idempotencyKey: "cap_3_blocked",
        mode: "fast",
        resolution: "2K",
        prompt: "Job 3 blocked",
      }),
    (err: any) =>
      err instanceof CreditServiceError &&
      err.status === 429 &&
      err.code === "TOO_MANY_CONCURRENT_JOBS"
  );
  assert.equal((await store.getUserById("user_cap_starter"))?.credits, 23);

  // Once j1 finishes, a new job is admitted
  await creditService.refundJobCredits({
    jobId: j1.job.id,
    reason: "Canceled",
    targetStatus: "canceled",
  });
  const j3 = await creditService.reserveCreditsAndCreateJob({
    userId: "user_cap_starter",
    idempotencyKey: "cap_3_admitted",
    mode: "fast",
    resolution: "2K",
    prompt: "Job 3 admitted",
  });
  assert.equal(j3.job.status, "queued");

  // Test QueueDepthGuard hysteresis (>200 rejects Fast until <=150; >400 rejects non-Pro until <=300)
  const guard = new QueueDepthGuard();

  // At depth 205 -> Fast is rejected (Retry-After: 30), Standard is allowed
  const d205Fast = guard.evaluate(205, "creator", "fast");
  assert.equal(d205Fast.allowed, false);
  assert.equal(d205Fast.retryAfterSeconds, 30);
  assert.equal(guard.evaluate(205, "creator", "standard").allowed, true);

  // Hysteresis: at depth 175 (between 150 and 200), Fast remains tripped!
  assert.equal(guard.evaluate(175, "creator", "fast").allowed, false);

  // At depth 150 -> Fast recovers!
  assert.equal(guard.evaluate(150, "creator", "fast").allowed, true);

  // At depth 405 -> Creator is rejected (Retry-After: 60), Pro is still admitted!
  const d405Creator = guard.evaluate(405, "creator", "standard");
  assert.equal(d405Creator.allowed, false);
  assert.equal(d405Creator.retryAfterSeconds, 60);
  assert.equal(guard.evaluate(405, "pro", "ultra").allowed, true);

  // Hysteresis: at depth 350, non-Pro remains tripped; at 300 it recovers
  assert.equal(guard.evaluate(350, "creator", "standard").allowed, false);
  assert.equal(guard.evaluate(300, "creator", "standard").allowed, true);
});
