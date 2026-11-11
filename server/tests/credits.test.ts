/**
 * tests/credits.test.ts
 *
 * Phase 3 unit, concurrency, and state-machine tests for the Credits & Jobs Core
 * (PLAN.md Sections 6, 8, 9, 12 Phase 3, 13).
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CreditService,
  CreditServiceError,
  InMemoryCreditStore,
} from "../services/creditService.js";

function createTestHarness() {
  const store = new InMemoryCreditStore();
  const service = new CreditService({ store });
  return { store, service };
}

test("Concurrent-spend invariant: 10 parallel requests with 5 credits on a 5-credit mode -> 1 succeeds, 9 fail with 402, balance = 0", async () => {
  const { store, service } = createTestHarness();
  store.seedUser({
    id: "user_concurrent_1",
    plan: "creator",
    credits: 5,
    totalCredits: 200,
  });

  // Fire 10 parallel requests on the 5-credit 'ultra' mode with distinct Idempotency-Keys
  const requests = Array.from({ length: 10 }, (_, idx) =>
    service.reserveCreditsAndCreateJob({
      userId: "user_concurrent_1",
      idempotencyKey: `idem_parallel_${idx}`,
      mode: "ultra",
      resolution: "4K",
      aspectRatio: "16:9",
      prompt: `Concurrent ultra 4K thumbnail #${idx}`,
    })
  );

  const settled = await Promise.allSettled(requests);

  const fulfilled = settled.filter(
    (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
  );
  const rejected = settled.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );

  assert.equal(fulfilled.length, 1, "Expected exactly 1 request to succeed");
  assert.equal(rejected.length, 9, "Expected 9 requests to fail with 402");

  for (const rej of rejected) {
    assert.ok(rej.reason instanceof CreditServiceError);
    assert.equal(rej.reason.status, 402);
    assert.equal(rej.reason.code, "INSUFFICIENT_CREDITS");
  }

  const finalUser = await store.getUserById("user_concurrent_1");
  assert.ok(finalUser);
  assert.equal(
    finalUser.credits,
    0,
    "User credit balance must be exactly 0 and never negative"
  );

  const ledgerEntries = await store.findLedgerEntriesForUser(
    "user_concurrent_1"
  );
  assert.equal(ledgerEntries.length, 1);
  assert.equal(ledgerEntries[0].type, "reserve");
  assert.equal(ledgerEntries[0].delta, -5);
  assert.equal(ledgerEntries[0].balance_after, 0);
});

test("Idempotency-Key enforcement: missing key fails with 400; sequential and concurrent duplicate keys return same job and charge once", async () => {
  const { store, service } = createTestHarness();
  store.seedUser({
    id: "user_idem_1",
    plan: "pro",
    credits: 5,
    totalCredits: 400,
  });

  // 1. Missing Idempotency-Key -> 400 MISSING_IDEMPOTENCY_KEY
  await assert.rejects(
    () =>
      service.reserveCreditsAndCreateJob({
        userId: "user_idem_1",
        idempotencyKey: "   ",
        mode: "ultra",
        resolution: "4K",
        prompt: "Missing key test",
      }),
    (err: any) =>
      err instanceof CreditServiceError &&
      err.status === 400 &&
      err.code === "MISSING_IDEMPOTENCY_KEY"
  );

  // 2. Five concurrent requests with the SAME Idempotency-Key when user has only 5 credits
  const dupResults = await Promise.all(
    Array.from({ length: 5 }, () =>
      service.reserveCreditsAndCreateJob({
        userId: "user_idem_1",
        idempotencyKey: "same_key_123",
        mode: "ultra",
        resolution: "4K",
        prompt: "Duplicate key test",
      })
    )
  );

  const uniqueJobIds = new Set(dupResults.map((r) => r.job.id));
  assert.equal(
    uniqueJobIds.size,
    1,
    "All 5 duplicate requests must return the exact same Job ID"
  );

  const replaySeq = await service.reserveCreditsAndCreateJob({
    userId: "user_idem_1",
    idempotencyKey: "same_key_123",
    mode: "ultra",
    resolution: "4K",
    prompt: "Duplicate key test",
  });
  assert.equal(replaySeq.idempotentReplay, true);
  assert.equal(replaySeq.job.id, dupResults[0].job.id);

  const userAfter = await store.getUserById("user_idem_1");
  assert.equal(userAfter?.credits, 0, "User must be charged only once (5 -> 0)");

  const ledger = await store.findLedgerEntriesForUser("user_idem_1");
  assert.equal(ledger.length, 1, "Only 1 reserve ledger entry may exist");
});

test("Job lifecycle: queued -> running -> commit (including partial refund on lower-cost fallback and cap at reserved_credits)", async () => {
  const { store, service } = createTestHarness();
  store.seedUser({
    id: "user_commit_1",
    plan: "creator",
    credits: 10,
    totalCredits: 200,
  });

  // 1. Reserve 3 credits for 'premium'
  const res1 = await service.reserveCreditsAndCreateJob({
    userId: "user_commit_1",
    idempotencyKey: "job_commit_standard",
    mode: "premium",
    resolution: "2K",
    prompt: "Premium text thumbnail",
  });
  assert.equal(res1.job.status, "queued");
  assert.equal(res1.job.reserved_credits, 3);
  assert.equal(res1.userCreditsAfter, 7);

  // Transition to running
  const runningJob = await service.markJobRunning(res1.job.id);
  assert.equal(runningJob.status, "running");
  assert.ok(runningJob.startedAt instanceof Date);

  // Commit with actualCreditsCost trying to exceed reserved_credits (e.g. 5 > 3) -> must cap at 3
  const committed1 = await service.commitJobCredits({
    jobId: res1.job.id,
    actualCreditsCost: 5,
    generationMeta: {
      provider: "openrouter",
      model_id: "google/gemini-3.1-flash-image",
      fallback_used: false,
      attempts: [],
      latency_ms: 20938,
      billed_cost_usd: 0.101,
      request_params: { resolution: "2K" },
      resolution_actual: {
        width: 2752,
        height: 1536,
        tier: "2K",
        dimensions: "2752x1536",
      },
      upscaled: false,
    },
    assets: {
      original_url: "https://cdn.example.com/orig.png",
      watermarked_url: null,
      preview_webp_url: "https://cdn.example.com/prev.webp",
      delivery_url: "https://cdn.example.com/orig.png",
    },
  });

  assert.equal(committed1.job.status, "succeeded");
  assert.equal(
    committed1.job.final_credits,
    3,
    "Must never charge more than reserved_credits"
  );
  assert.equal(committed1.partialRefundEntry, null);

  // Duplicate commit call must be idempotent
  const committedReplay = await service.commitJobCredits({
    jobId: res1.job.id,
    generationMeta: committed1.job.generation_meta!,
    assets: committed1.job.assets,
  });
  assert.equal(committedReplay.commitEntry.id, committed1.commitEntry.id);

  // 2. Reserve 5 credits for 'ultra', then commit with lower actualCreditsCost=2 -> refunds 3 credits
  const res2 = await service.reserveCreditsAndCreateJob({
    userId: "user_commit_1",
    idempotencyKey: "job_commit_partial_refund",
    mode: "ultra",
    resolution: "4K",
    prompt: "Ultra fallback test",
  });
  assert.equal(res2.userCreditsAfter, 2); // 7 - 5 = 2

  const committed2 = await service.commitJobCredits({
    jobId: res2.job.id,
    actualCreditsCost: 2,
    generationMeta: {
      provider: "openrouter",
      model_id: "bytedance-seed/seedream-5-0-lite",
      fallback_used: true,
      attempts: [],
      latency_ms: 15000,
      billed_cost_usd: 0.035,
      request_params: { resolution: "2K" },
      resolution_actual: {
        width: 2560,
        height: 1440,
        tier: "2K",
        dimensions: "2560x1440",
      },
      upscaled: false,
    },
    assets: {
      original_url: "https://cdn.example.com/orig2.png",
      watermarked_url: null,
      preview_webp_url: "https://cdn.example.com/prev2.webp",
      delivery_url: "https://cdn.example.com/orig2.png",
    },
  });

  assert.equal(committed2.job.final_credits, 2);
  assert.ok(committed2.partialRefundEntry);
  assert.equal(committed2.partialRefundEntry.delta, 3);

  const userAfterPartial = await store.getUserById("user_commit_1");
  assert.equal(userAfterPartial?.credits, 5); // 2 + 3 refunded = 5
});

test("Refund on failure: restores 100% of reserved credits, sets final_credits=0, and never double-refunds", async () => {
  const { store, service } = createTestHarness();
  store.seedUser({
    id: "user_refund_1",
    plan: "creator",
    credits: 6,
    totalCredits: 200,
  });

  const res = await service.reserveCreditsAndCreateJob({
    userId: "user_refund_1",
    idempotencyKey: "job_to_fail_1",
    mode: "ultra",
    resolution: "4K",
    prompt: "Will fail upstream",
  });
  assert.equal(res.userCreditsAfter, 1);

  await service.markJobRunning(res.job.id);

  // Fire 3 concurrent refund calls for the same job -> only 1 must refund
  const refundCalls = await Promise.all([
    service.refundJobCredits({
      jobId: res.job.id,
      reason: "All candidates exhausted",
      errorCode: "PROVIDER_5XX",
    }),
    service.refundJobCredits({
      jobId: res.job.id,
      reason: "Duplicate refund call 2",
      errorCode: "PROVIDER_5XX",
    }),
    service.refundJobCredits({
      jobId: res.job.id,
      reason: "Duplicate refund call 3",
      errorCode: "PROVIDER_5XX",
    }),
  ]);

  const refundedNowCount = refundCalls.filter((c) => c.refundedNow).length;
  assert.equal(refundedNowCount, 1, "Must refund at most once");
  assert.equal(refundCalls[0].job.status, "failed");
  assert.equal(refundCalls[0].job.final_credits, 0);

  const userAfter = await store.getUserById("user_refund_1");
  assert.equal(
    userAfter?.credits,
    6,
    "Full 5 credits restored to original balance of 6"
  );

  const jobLedgers = await store.findLedgerEntriesForJob(res.job.id);
  assert.equal(jobLedgers.length, 2); // 1 reserve (-5) + 1 refund (+5)
  assert.equal(jobLedgers[0].type, "reserve");
  assert.equal(jobLedgers[0].delta, -5);
  assert.equal(jobLedgers[1].type, "refund");
  assert.equal(jobLedgers[1].delta, 5);
});

test("Crash recovery sweep: sweepOrphanedJobs refunds stale queued/running jobs and leaves fresh jobs untouched", async () => {
  const { store, service } = createTestHarness();
  store.seedUser({
    id: "user_sweep_1",
    plan: "pro",
    credits: 20,
    totalCredits: 400,
  });

  const staleRes = await service.reserveCreditsAndCreateJob({
    userId: "user_sweep_1",
    idempotencyKey: "stale_job_1",
    mode: "ultra",
    resolution: "4K",
    prompt: "Stale running job",
  });
  await service.markJobRunning(staleRes.job.id);

  // Backdate stale job updatedAt to 30 minutes ago
  store.setJobUpdatedAt(
    staleRes.job.id,
    new Date(Date.now() - 30 * 60 * 1000)
  );

  const freshRes = await service.reserveCreditsAndCreateJob({
    userId: "user_sweep_1",
    idempotencyKey: "fresh_job_2",
    mode: "standard",
    resolution: "2K",
    prompt: "Fresh queued job",
  });

  // Balance before sweep: 20 - 5 - 2 = 13
  assert.equal((await store.getUserById("user_sweep_1"))?.credits, 13);

  const sweepResult = await service.sweepOrphanedJobs({
    maxAgeMs: 15 * 60 * 1000,
  });
  assert.equal(sweepResult.sweptCount, 1);
  assert.deepEqual(sweepResult.refundedJobIds, [staleRes.job.id]);

  // Balance after sweep: 13 + 5 (stale job refunded) = 18
  assert.equal((await store.getUserById("user_sweep_1"))?.credits, 18);

  const staleJobAfter = await store.findJobById(staleRes.job.id);
  assert.equal(staleJobAfter?.status, "failed");
  assert.equal(staleJobAfter?.error_code, "ORPHANED_JOB_TIMEOUT");

  const freshJobAfter = await store.findJobById(freshRes.job.id);
  assert.equal(freshJobAfter?.status, "queued");
});

test("Plan & Mode entitlement guards: Starter vs Creator/Pro (Section 2 & Section 6)", async () => {
  const { store, service } = createTestHarness();
  store.seedUser({
    id: "user_starter",
    plan: "starter",
    credits: 25,
    totalCredits: 25,
  });

  // Starter cannot use 4K resolution
  await assert.rejects(
    () =>
      service.reserveCreditsAndCreateJob({
        userId: "user_starter",
        idempotencyKey: "starter_4k",
        mode: "standard",
        resolution: "4K",
        prompt: "Starter 4K attempt",
      }),
    (err: any) =>
      err instanceof CreditServiceError &&
      err.status === 403 &&
      err.code === "RESOLUTION_NOT_ALLOWED_FOR_PLAN"
  );

  // Starter cannot use reference images
  await assert.rejects(
    () =>
      service.reserveCreditsAndCreateJob({
        userId: "user_starter",
        idempotencyKey: "starter_ref",
        mode: "standard",
        resolution: "2K",
        prompt: "Starter ref attempt",
        referenceImagesCount: 1,
      }),
    (err: any) =>
      err instanceof CreditServiceError &&
      err.status === 403 &&
      err.code === "REFERENCE_IMAGES_NOT_ALLOWED"
  );

  // Starter cannot use 'premium' or 'ultra' mode
  await assert.rejects(
    () =>
      service.reserveCreditsAndCreateJob({
        userId: "user_starter",
        idempotencyKey: "starter_premium",
        mode: "premium",
        resolution: "2K",
        prompt: "Starter premium attempt",
      }),
    (err: any) =>
      err instanceof CreditServiceError &&
      err.status === 403 &&
      err.code === "MODE_NOT_ALLOWED_FOR_PLAN"
  );

  // Starter CAN use 'fast' (1 cr) and 'standard' (2 cr) at 2K
  const okFast = await service.reserveCreditsAndCreateJob({
    userId: "user_starter",
    idempotencyKey: "starter_fast_ok",
    mode: "fast",
    resolution: "2K",
    prompt: "Starter fast 2K",
  });
  assert.equal(okFast.job.reserved_credits, 1);
  assert.equal(okFast.userCreditsAfter, 24);
});

test("grantCredits and adjustCredits write append-only ledger entries and enforce idempotency & non-negative balance", async () => {
  const { store, service } = createTestHarness();
  store.seedUser({
    id: "user_grant_1",
    plan: "none",
    credits: 0,
    totalCredits: 0,
  });

  const g1 = await service.grantCredits({
    userId: "user_grant_1",
    amount: 200,
    reason: "Creator plan purchase (order_1)",
    idempotencyKey: "grant:order_1",
    planUpdate: "creator",
  });
  assert.equal(g1.grantedNow, true);
  assert.equal(g1.user.credits, 200);
  assert.equal(g1.user.plan, "creator");

  // Duplicate webhook replay with same idempotencyKey must not double-grant
  const g2 = await service.grantCredits({
    userId: "user_grant_1",
    amount: 200,
    reason: "Creator plan purchase (order_1)",
    idempotencyKey: "grant:order_1",
    planUpdate: "creator",
  });
  assert.equal(g2.grantedNow, false);
  assert.equal(g2.user.credits, 200);

  // Negative adjustment exceeding balance must fail with 402
  await assert.rejects(
    () =>
      service.adjustCredits({
        userId: "user_grant_1",
        delta: -250,
        reason: "Excessive deduction",
        idempotencyKey: "adj:fail_1",
      }),
    (err: any) =>
      err instanceof CreditServiceError &&
      err.status === 402 &&
      err.code === "INSUFFICIENT_CREDITS"
  );
});

