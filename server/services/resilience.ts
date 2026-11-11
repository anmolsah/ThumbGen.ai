/**
 * services/resilience.ts
 *
 * Phase 4 resilience & orchestration primitives (PLAN.md Sections 4, 6, 9, 12 Phase 4, 13):
 *   1. Per-provider concurrency Semaphore
 *   2. Per-model Circuit Breaker (5 consecutive failures OR >50% failure rate over 20 reqs in 2m -> open for 60s)
 *   3. Global Queue Depth Guard with hysteresis (>200 rejects Fast until <150; >400 rejects non-Pro until <300)
 *   4. Candidate retry + same-mode fallback executor (`executeGenerationWithFallback`)
 */

import {
  loadRegistryConfig,
  type CandidateConfig,
  type ModeId,
  type PlanId,
  type RegistryConfig,
} from "../configs/registryValidator.js";
import type { IJobAttempt, IJobGenerationMeta } from "../models/Job.js";
import {
  getEligibleCandidatesForMode,
  getProviderAdapter,
  ProviderError,
  type GenerateInput,
  type GenerateOutput,
  type ProviderAdapter,
  type ProviderName,
} from "../providers/index.js";

/**
 * Fair FIFO async Semaphore for per-provider concurrency limiting.
 */
export class Semaphore {
  private readonly maxConcurrency: number;
  private activeCount = 0;
  private peakActiveCount = 0;
  private readonly waitQueue: Array<() => void> = [];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = Math.max(1, Math.floor(maxConcurrency));
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getPeakActiveCount(): number {
    return this.peakActiveCount;
  }

  public getWaitingCount(): number {
    return this.waitQueue.length;
  }

  public async acquire(): Promise<() => void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      if (this.activeCount > this.peakActiveCount) {
        this.peakActiveCount = this.activeCount;
      }
      return this.createReleaseFn();
    }

    return new Promise<() => void>((resolve) => {
      this.waitQueue.push(() => {
        this.activeCount++;
        if (this.activeCount > this.peakActiveCount) {
          this.peakActiveCount = this.activeCount;
        }
        resolve(this.createReleaseFn());
      });
    });
  }

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private createReleaseFn(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeCount--;
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    };
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures to trip the breaker (default: 5). */
  consecutiveFailureThreshold?: number;
  /** Minimum requests in window before failure-rate check applies (default: 20). */
  windowMinRequests?: number;
  /** Failure rate threshold over window (default: 0.5 -> >50% trips). */
  failureRateThreshold?: number;
  /** Sliding window duration in ms (default: 120_000 -> 2 minutes). */
  windowMs?: number;
  /** Cooldown duration while open in ms (default: 60_000 -> 60 seconds). */
  cooldownMs?: number;
  /** Optional clock override for deterministic tests. */
  nowFn?: () => number;
}

interface ModelBreakerState {
  consecutiveFailures: number;
  history: Array<{ timestamp: number; ok: boolean }>;
  openedUntil: number | null;
}

/**
 * Per-model Circuit Breaker (PLAN.md Section 9):
 * Trips a model for `60s` when either:
 *   - `5` consecutive failures occur, OR
 *   - `>50%` failure rate over `20` requests within `2` minutes (`120_000 ms`).
 */
export class ModelCircuitBreaker {
  private readonly consecutiveFailureThreshold: number;
  private readonly windowMinRequests: number;
  private readonly failureRateThreshold: number;
  private readonly windowMs: number;
  private readonly cooldownMs: number;
  private readonly nowFn: () => number;
  private readonly states = new Map<string, ModelBreakerState>();

  constructor(options?: CircuitBreakerOptions) {
    this.consecutiveFailureThreshold =
      options?.consecutiveFailureThreshold ?? 5;
    this.windowMinRequests = options?.windowMinRequests ?? 20;
    this.failureRateThreshold = options?.failureRateThreshold ?? 0.5;
    this.windowMs = options?.windowMs ?? 120_000;
    this.cooldownMs = options?.cooldownMs ?? 60_000;
    this.nowFn = options?.nowFn ?? (() => Date.now());
  }

  public static key(provider: string, modelId: string): string {
    return `${provider}:${modelId}`;
  }

  private getOrCreate(key: string): ModelBreakerState {
    let state = this.states.get(key);
    if (!state) {
      state = {
        consecutiveFailures: 0,
        history: [],
        openedUntil: null,
      };
      this.states.set(key, state);
    }
    return state;
  }

  public isOpen(provider: string, modelId: string): boolean {
    const key = ModelCircuitBreaker.key(provider, modelId);
    const state = this.states.get(key);
    if (!state || state.openedUntil === null) {
      return false;
    }
    const now = this.nowFn();
    if (now >= state.openedUntil) {
      // Cooldown elapsed -> half-open (allow next probe)
      state.openedUntil = null;
      return false;
    }
    return true;
  }

  public recordSuccess(provider: string, modelId: string): void {
    const key = ModelCircuitBreaker.key(provider, modelId);
    const state = this.getOrCreate(key);
    const now = this.nowFn();
    state.consecutiveFailures = 0;
    state.openedUntil = null;
    this.pruneWindow(state, now);
    state.history.push({ timestamp: now, ok: true });
  }

  public recordFailure(provider: string, modelId: string): void {
    const key = ModelCircuitBreaker.key(provider, modelId);
    const state = this.getOrCreate(key);
    const now = this.nowFn();
    state.consecutiveFailures++;
    this.pruneWindow(state, now);
    state.history.push({ timestamp: now, ok: false });

    const trippedByConsecutive =
      state.consecutiveFailures >= this.consecutiveFailureThreshold;

    let trippedByRate = false;
    if (state.history.length >= this.windowMinRequests) {
      const recent = state.history.slice(-this.windowMinRequests);
      const failures = recent.filter((h) => !h.ok).length;
      const rate = failures / recent.length;
      if (rate > this.failureRateThreshold) {
        trippedByRate = true;
      }
    }

    if (trippedByConsecutive || trippedByRate) {
      state.openedUntil = now + this.cooldownMs;
    }
  }

  public reset(): void {
    this.states.clear();
  }

  private pruneWindow(state: ModelBreakerState, now: number): void {
    const cutoff = now - this.windowMs;
    while (state.history.length > 0 && state.history[0].timestamp < cutoff) {
      state.history.shift();
    }
  }
}

export interface QueueAdmissionDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
}

/**
 * Global queue depth guard with hysteresis (PLAN.md Section 9):
 *   - Depth > 200 trips Fast-mode shedding (recovers when depth <= 150).
 *   - Depth > 400 trips non-Pro shedding (recovers when depth <= 300).
 */
export class QueueDepthGuard {
  private fastTripped = false;
  private nonProTripped = false;

  private readonly fastTripThreshold: number;
  private readonly fastRecoverThreshold: number;
  private readonly nonProTripThreshold: number;
  private readonly nonProRecoverThreshold: number;

  constructor(options?: {
    fastTripThreshold?: number;
    fastRecoverThreshold?: number;
    nonProTripThreshold?: number;
    nonProRecoverThreshold?: number;
  }) {
    this.fastTripThreshold = options?.fastTripThreshold ?? 200;
    this.fastRecoverThreshold = options?.fastRecoverThreshold ?? 150;
    this.nonProTripThreshold = options?.nonProTripThreshold ?? 400;
    this.nonProRecoverThreshold = options?.nonProRecoverThreshold ?? 300;
  }

  public evaluate(
    currentQueueDepth: number,
    plan: PlanId,
    mode: ModeId
  ): QueueAdmissionDecision {
    // Update hysteresis states
    if (currentQueueDepth > this.nonProTripThreshold) {
      this.nonProTripped = true;
    } else if (currentQueueDepth <= this.nonProRecoverThreshold) {
      this.nonProTripped = false;
    }

    if (currentQueueDepth > this.fastTripThreshold) {
      this.fastTripped = true;
    } else if (currentQueueDepth <= this.fastRecoverThreshold) {
      this.fastTripped = false;
    }

    if (this.nonProTripped && plan !== "pro") {
      return {
        allowed: false,
        retryAfterSeconds: 60,
        reason: `Queue is currently busy (${currentQueueDepth} jobs queued). Only Pro priority jobs are being admitted; please retry shortly.`,
      };
    }

    if (this.fastTripped && mode === "fast") {
      return {
        allowed: false,
        retryAfterSeconds: 30,
        reason: `Fast mode queue is currently busy (${currentQueueDepth} jobs queued). Please retry shortly or select Standard mode.`,
      };
    }

    return { allowed: true };
  }

  public reset(): void {
    this.fastTripped = false;
    this.nonProTripped = false;
  }
}

export interface ExecuteWithFallbackOptions {
  registry?: RegistryConfig;
  circuitBreaker?: ModelCircuitBreaker;
  semaphores?: Record<string, Semaphore>;
  adapterResolver?: (provider: ProviderName) => ProviderAdapter;
  /** Maximum retries per candidate on retryable errors (default: 1 -> 2 attempts total). */
  maxRetriesPerCandidate?: number;
  /** Base backoff delay in ms (default: 1000; set to 5-10ms in unit tests). */
  baseBackoffMs?: number;
  /** Max backoff delay in ms (default: 3000). */
  maxBackoffMs?: number;
  /** Force mock adapter (for local dev / tests). */
  forceMock?: boolean;
}

export interface ExecuteWithFallbackResult {
  output: GenerateOutput;
  meta: IJobGenerationMeta;
  candidateUsed: CandidateConfig & { model_id: string };
}

const DEFAULT_PROVIDER_CONCURRENCY: Record<string, number> = {
  openrouter: 5,
  xai: 3,
  mock: 10,
};

const defaultSemaphores: Record<string, Semaphore> = {};

export function getDefaultProviderSemaphore(
  provider: string,
  registry?: RegistryConfig
): Semaphore {
  if (!defaultSemaphores[provider]) {
    const reg = registry ?? loadRegistryConfig();
    const configured = reg.providers[provider]?.max_concurrency;
    const limit =
      typeof configured === "number" && configured > 0
        ? configured
        : DEFAULT_PROVIDER_CONCURRENCY[provider] ?? 4;
    defaultSemaphores[provider] = new Semaphore(limit);
  }
  return defaultSemaphores[provider];
}

export const defaultCircuitBreaker = new ModelCircuitBreaker();
export const defaultQueueDepthGuard = new QueueDepthGuard();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeJitteredBackoff(
  attemptIndex: number,
  baseMs: number,
  maxMs: number
): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, attemptIndex));
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exp * 0.3)));
  return Math.min(maxMs, exp + jitter);
}

/**
 * Determines whether an error should immediately abort the job WITHOUT retrying
 * and WITHOUT falling back to another candidate (PLAN.md Section 9):
 *   "Non-retryable errors: 400 invalid params, content/safety policy rejection,
 *    auth errors -> do not retry or fallback; fail immediately with a clear reason and refund."
 */
export function isImmediateAbortError(err: unknown): boolean {
  if (err instanceof ProviderError) {
    if (
      err.isPolicyRejection ||
      err.code === "CONTENT_POLICY_REJECTED" ||
      err.code === "INVALID_PARAMETERS" ||
      err.code === "AUTH_ERROR"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Executes image generation for `input.mode` across the ordered candidate list
 * with per-provider concurrency semaphores, per-model circuit breakers,
 * up to 1 retry with jittered backoff on retryable errors, and automatic
 * fallback across candidates within the same mode.
 */
export async function executeGenerationWithFallback(
  input: GenerateInput,
  options?: ExecuteWithFallbackOptions
): Promise<ExecuteWithFallbackResult> {
  const registry = options?.registry ?? loadRegistryConfig();
  const breaker = options?.circuitBreaker ?? defaultCircuitBreaker;
  const maxRetries = options?.maxRetriesPerCandidate ?? 1;
  const baseBackoffMs = options?.baseBackoffMs ?? 1000;
  const maxBackoffMs = options?.maxBackoffMs ?? 3000;
  const resolveAdapter = options?.adapterResolver ?? getProviderAdapter;

  const useMock =
    options?.forceMock === true ||
    process.env.MOCK_PROVIDERS === "true" ||
    input.candidate?.provider === "mock";

  const hasRefs = Boolean(
    input.referenceImages && input.referenceImages.length > 0
  );

  const candidates = getEligibleCandidatesForMode(
    input.mode,
    input.resolution,
    hasRefs,
    registry
  );

  if (candidates.length === 0) {
    throw new ProviderError({
      code: "UNSUPPORTED_CAPABILITY",
      message: `No verified candidate model in mode '${input.mode}' supports resolution '${input.resolution}'`,
      retryable: false,
      provider: "registry",
      model_id: input.mode,
    });
  }

  const attempts: IJobAttempt[] = [];
  let lastError: ProviderError | Error | null = null;
  let primaryAttempted = false;

  for (let candIdx = 0; candIdx < candidates.length; candIdx++) {
    const cand = candidates[candIdx];
    const providerName = (
      useMock ? "mock" : cand.provider
    ) as ProviderName;
    const modelId = cand.model_id;

    // Check circuit breaker before attempting candidate
    if (breaker.isOpen(providerName, modelId)) {
      continue;
    }

    if (candIdx === 0) {
      primaryAttempted = true;
    }

    const semaphore =
      options?.semaphores?.[providerName] ??
      getDefaultProviderSemaphore(providerName, registry);
    const adapter = resolveAdapter(providerName);

    for (let retryIdx = 0; retryIdx <= maxRetries; retryIdx++) {
      if (retryIdx > 0) {
        const delayMs = computeJitteredBackoff(
          retryIdx - 1,
          baseBackoffMs,
          maxBackoffMs
        );
        await sleep(delayMs);
      }

      const attemptStart = Date.now();
      try {
        const output = await semaphore.run(() =>
          adapter.generateWithCandidate(modelId, input)
        );

        breaker.recordSuccess(providerName, modelId);

        attempts.push({
          provider: providerName,
          model_id: modelId,
          status: "succeeded",
          latency_ms: output.meta.latency_ms,
          billed_cost_usd: output.meta.billed_cost_usd,
        });

        const fallbackUsed = candIdx > 0;
        const jobMeta: IJobGenerationMeta = {
          provider: output.meta.provider,
          model_id: output.meta.model_id,
          fallback_used: fallbackUsed,
          attempts,
          latency_ms: output.meta.latency_ms,
          billed_cost_usd: output.meta.billed_cost_usd,
          request_params: output.meta.request_params,
          resolution_actual: output.meta.resolution_actual,
          upscaled: output.meta.upscaled,
        };

        return {
          output,
          meta: jobMeta,
          candidateUsed: cand,
        };
      } catch (err: any) {
        const latencyMs = Math.max(1, Date.now() - attemptStart);
        const providerErr: ProviderError =
          err instanceof ProviderError
            ? err
            : new ProviderError({
                code: "PROVIDER_5XX",
                message: err?.message || String(err),
                retryable: true,
                provider: providerName,
                model_id: modelId,
              });

        lastError = providerErr;

        attempts.push({
          provider: providerName,
          model_id: modelId,
          status: "failed",
          error_code: providerErr.code,
          error_message: providerErr.message,
          latency_ms: latencyMs,
        });

        // Non-retryable policy/validation/auth errors abort immediately without retry or fallback
        if (isImmediateAbortError(providerErr)) {
          (providerErr as any).attempts = attempts;
          throw providerErr;
        }

        // Record upstream failure against circuit breaker
        breaker.recordFailure(providerName, modelId);

        // If error is not retryable (e.g. UNSUPPORTED_CAPABILITY or INSUFFICIENT_QUOTA on this model),
        // break out of the retry loop and move to the next fallback candidate in the mode
        if (!providerErr.retryable) {
          break;
        }

        // If circuit breaker tripped during this failure, skip remaining retry on this model
        if (breaker.isOpen(providerName, modelId)) {
          break;
        }
      }
    }
  }

  const finalError =
    lastError instanceof ProviderError
      ? lastError
      : new ProviderError({
          code: "PROVIDER_5XX",
          message:
            lastError?.message ||
            `All candidate models for mode '${input.mode}' are unavailable or circuit-broken`,
          retryable: false,
          provider: candidates[0].provider,
          model_id: candidates[0].model_id,
        });

  (finalError as any).attempts = attempts;
  (finalError as any).primaryAttempted = primaryAttempted;
  throw finalError;
}

export interface RunJobLifecycleParams {
  jobId: string;
  input: GenerateInput;
  creditService: {
    markJobRunning(jobId: string): Promise<any>;
    commitJobCredits(params: {
      jobId: string;
      actualCreditsCost?: number;
      generationMeta: IJobGenerationMeta;
      assets: {
        original_url: string | null;
        watermarked_url: string | null;
        preview_webp_url: string | null;
        delivery_url: string | null;
      };
    }): Promise<any>;
    refundJobCredits(params: {
      jobId: string;
      reason: string;
      errorCode?: string | null;
      errorMessage?: string | null;
      targetStatus?: "failed" | "canceled";
    }): Promise<any>;
  };
  storeAssetsFn?: (
    output: GenerateOutput,
    meta: IJobGenerationMeta
  ) => Promise<{
    original_url: string | null;
    watermarked_url: string | null;
    preview_webp_url: string | null;
    delivery_url: string | null;
  }>;
  fallbackOptions?: ExecuteWithFallbackOptions;
}

/**
 * End-to-end worker job runner connecting `CreditService` and `executeGenerationWithFallback`:
 *   1. Transitions job `queued` -> `running`
 *   2. Executes provider candidate chain with retry + fallback + circuit breaker
 *   3. Stores output assets (`storeAssetsFn`)
 *   4. Commits reserved credits (`commitJobCredits`) on success
 *   5. Refunds 100% of reserved credits (`refundJobCredits`) on any terminal failure
 */
export async function runJobWithResilience(
  params: RunJobLifecycleParams
): Promise<ExecuteWithFallbackResult> {
  await params.creditService.markJobRunning(params.jobId);

  try {
    const genResult = await executeGenerationWithFallback(
      params.input,
      params.fallbackOptions
    );

    const assets = params.storeAssetsFn
      ? await params.storeAssetsFn(genResult.output, genResult.meta)
      : {
          original_url: "memory://original.png",
          watermarked_url: null,
          preview_webp_url: "memory://preview.webp",
          delivery_url: "memory://original.png",
        };

    await params.creditService.commitJobCredits({
      jobId: params.jobId,
      generationMeta: genResult.meta,
      assets,
    });

    return genResult;
  } catch (err: any) {
    const errCode =
      err instanceof ProviderError ? err.code : "WORKER_TERMINAL_FAILURE";
    const errMsg = err?.message || String(err);

    await params.creditService.refundJobCredits({
      jobId: params.jobId,
      reason: `Generation failed (${errCode}): ${errMsg}`,
      errorCode: errCode,
      errorMessage: errMsg,
      targetStatus: "failed",
    });

    throw err;
  }
}
