/**
 * services/observabilityService.ts
 *
 * Phase 7 & Phase 8 Observability, Metrics, Alert Rules, Daily Spend Kill Switch,
 * and Sliding-Window Rate Limiter (PLAN.md Sections 1 R9, 7, 11, 12 Phase 8).
 */

import crypto from "crypto";
import GenerationLog from "../models/GenerationLog.js";
import { CreditServiceError } from "./creditService.js";

const SENSITIVE_KEY_PATTERN =
  /^(authorization|api[_-]?key|secret|password|token|cookie|session|openrouter_api_key|xai_api_key)$/i;

/**
 * Recursively redacts secrets, authorization headers, and base64 image payloads (Rule R9).
 */
export function sanitizeLogPayload(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (value.startsWith("data:image/")) {
      return `[REDACTED_DATA_URI:${value.length}_chars]`;
    }
    if (value.startsWith("Bearer ") || value.startsWith("sk-or-")) {
      return "[REDACTED_SECRET]";
    }
    if (value.length > 512 && /^[A-Za-z0-9+/=\r\n]+$/.test(value)) {
      return `[REDACTED_BASE64:${value.length}_chars]`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogPayload(item));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED_SECRET]";
      } else if (
        (k === "reference_image" ||
          k === "referenceImages" ||
          k === "image" ||
          k === "b64_json") &&
        typeof v === "string" &&
        v.length > 64
      ) {
        out[k] = `[REDACTED_IMAGE:${v.length}_chars]`;
      } else {
        out[k] = sanitizeLogPayload(v);
      }
    }
    return out;
  }

  return value;
}

export interface StructuredGenerationEvent {
  request_id?: string;
  user_id: string;
  job_id: string;
  mode: string;
  provider: string;
  model_id: string;
  attempt: number;
  latency_ms: number;
  billed_cost_usd: number | null;
  est_cost_usd?: number | null;
  reserved_credits: number;
  final_credits: number;
  status: "succeeded" | "failed";
  error_code?: string | null;
  request_params?: Record<string, unknown> | null;
  resolution_actual?: {
    width: number;
    height: number;
    tier: string;
  } | null;
  queue_wait_ms?: number;
}

export interface AlertEvaluation {
  rule:
    | "provider_error_rate_high"
    | "queue_wait_p95_high"
    | "daily_provider_spend_exceeded"
    | "credit_refund_rate_high"
    | "circuit_breaker_open";
  firing: boolean;
  value: number;
  threshold: number;
  message: string;
}

export function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
}

export class ObservabilityManager {
  private dailySpendCapUsd: number;
  private killSwitchManualOverride: boolean | null = null;
  private currentDayKey: string;
  private dailySpendUsd = 0;

  private totalJobs = 0;
  private failedJobs = 0;
  private refundedJobs = 0;
  private queueDepth = 0;

  private readonly queueWaitSamplesSec: number[] = [];
  private readonly modelLatencySamplesMs = new Map<string, number[]>();
  private readonly modelCounters = new Map<
    string,
    { succeeded: number; failed: number; spendUsd: number }
  >();
  private readonly circuitBreakerStates = new Map<string, 0 | 1>();
  private readonly recentEvents: Array<Record<string, unknown>> = [];

  private loggerFn: (jsonLine: string) => void;
  private persistToDb: boolean;

  constructor(options?: {
    dailySpendCapUsd?: number;
    loggerFn?: (jsonLine: string) => void;
    persistToDb?: boolean;
  }) {
    const envCap = Number(process.env.DAILY_SPEND_CAP_USD);
    this.dailySpendCapUsd =
      options?.dailySpendCapUsd ??
      (Number.isFinite(envCap) && envCap > 0 ? envCap : 50.0);
    this.currentDayKey = this.getUtcDayKey();
    this.loggerFn = options?.loggerFn ?? ((line) => console.log(line));
    this.persistToDb = options?.persistToDb ?? true;
  }

  private getUtcDayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

  private rollDayIfNeeded(now = new Date()): void {
    const key = this.getUtcDayKey(now);
    if (key !== this.currentDayKey) {
      this.currentDayKey = key;
      this.dailySpendUsd = 0;
    }
  }

  public setDailySpendCapUsd(capUsd: number): void {
    this.dailySpendCapUsd = capUsd;
  }

  public setManualKillSwitch(active: boolean | null): void {
    this.killSwitchManualOverride = active;
  }

  public isKillSwitchActive(now = new Date()): boolean {
    this.rollDayIfNeeded(now);
    if (this.killSwitchManualOverride !== null) {
      return this.killSwitchManualOverride;
    }
    return this.dailySpendUsd >= this.dailySpendCapUsd;
  }

  /**
   * Throws 503 SPEND_CAP_REACHED if the daily provider spend cap or manual kill switch is active.
   */
  public assertSpendBelowCap(now = new Date()): void {
    if (this.isKillSwitchActive(now)) {
      throw new CreditServiceError(
        "SPEND_CAP_REACHED",
        503,
        "Generation is temporarily paused because the daily provider spend cap has been reached."
      );
    }
  }

  public setQueueDepth(depth: number): void {
    this.queueDepth = Math.max(0, depth);
  }

  public setCircuitBreakerState(
    provider: string,
    modelId: string,
    open: boolean
  ): void {
    this.circuitBreakerStates.set(`${provider}:${modelId}`, open ? 1 : 0);
  }

  public recordQueueWaitMs(waitMs: number): void {
    if (!Number.isFinite(waitMs) || waitMs < 0) return;
    this.queueWaitSamplesSec.push(waitMs / 1000);
    if (this.queueWaitSamplesSec.length > 500) {
      this.queueWaitSamplesSec.shift();
    }
  }

  public async recordGenerationEvent(
    event: StructuredGenerationEvent,
    now = new Date()
  ): Promise<Record<string, unknown>> {
    this.rollDayIfNeeded(now);

    const requestId =
      event.request_id || `req_${crypto.randomBytes(8).toString("hex")}`;
    const sanitizedParams = (sanitizeLogPayload(
      event.request_params || {}
    ) || {}) as Record<string, unknown>;

    const costIncurred =
      typeof event.billed_cost_usd === "number" &&
      Number.isFinite(event.billed_cost_usd)
        ? event.billed_cost_usd
        : typeof event.est_cost_usd === "number" &&
          Number.isFinite(event.est_cost_usd) &&
          event.status === "succeeded"
        ? event.est_cost_usd
        : 0;

    this.dailySpendUsd = Number((this.dailySpendUsd + costIncurred).toFixed(6));
    this.totalJobs += 1;
    if (event.status === "failed") {
      this.failedJobs += 1;
    }
    if (event.final_credits === 0 && event.reserved_credits > 0) {
      this.refundedJobs += 1;
    }

    if (typeof event.queue_wait_ms === "number") {
      this.recordQueueWaitMs(event.queue_wait_ms);
    }

    const modelKey = `${event.mode}|${event.provider}|${event.model_id}`;
    const samples = this.modelLatencySamplesMs.get(modelKey) ?? [];
    samples.push(event.latency_ms);
    if (samples.length > 500) samples.shift();
    this.modelLatencySamplesMs.set(modelKey, samples);

    const counters = this.modelCounters.get(modelKey) ?? {
      succeeded: 0,
      failed: 0,
      spendUsd: 0,
    };
    if (event.status === "succeeded") counters.succeeded += 1;
    else counters.failed += 1;
    counters.spendUsd = Number((counters.spendUsd + costIncurred).toFixed(6));
    this.modelCounters.set(modelKey, counters);

    const structuredRecord: Record<string, unknown> = {
      timestamp: now.toISOString(),
      event: "generation_completed",
      request_id: requestId,
      user_id: event.user_id,
      job_id: event.job_id,
      mode: event.mode,
      provider: event.provider,
      model_id: event.model_id,
      attempt: event.attempt,
      latency_ms: event.latency_ms,
      billed_cost_usd: event.billed_cost_usd,
      reserved_credits: event.reserved_credits,
      final_credits: event.final_credits,
      status: event.status,
      error_code: event.error_code ?? null,
      request_params: sanitizedParams,
      resolution_actual: event.resolution_actual ?? null,
    };

    this.recentEvents.push(structuredRecord);
    if (this.recentEvents.length > 200) {
      this.recentEvents.shift();
    }

    this.loggerFn(JSON.stringify(structuredRecord));

    if (this.persistToDb) {
      try {
        await GenerationLog.create({
          job_id: event.job_id,
          user_id: event.user_id,
          request_id: requestId,
          mode: event.mode,
          provider: event.provider,
          model_id: event.model_id,
          attempt: event.attempt,
          latency_ms: event.latency_ms,
          billed_cost_usd: event.billed_cost_usd,
          reserved_credits: event.reserved_credits,
          final_credits: event.final_credits,
          status: event.status,
          error_code: event.error_code ?? null,
          request_params: sanitizedParams,
          resolution_actual: event.resolution_actual,
        });
      } catch {
        // Non-fatal in unit/mock environments when mongoose is not connected
      }
    }

    return structuredRecord;
  }

  public getMetricsSnapshot(now = new Date()) {
    this.rollDayIfNeeded(now);
    const providerErrorRate =
      this.totalJobs > 0 ? this.failedJobs / this.totalJobs : 0;
    const creditRefundRate =
      this.totalJobs > 0 ? this.refundedJobs / this.totalJobs : 0;
    const queueWaitP95Sec = computePercentile(this.queueWaitSamplesSec, 95);

    const anyBreakerOpen = Array.from(this.circuitBreakerStates.values()).some(
      (v) => v === 1
    )
      ? 1
      : 0;

    const perModel: Array<{
      mode: string;
      provider: string;
      model_id: string;
      succeeded: number;
      failed: number;
      spend_usd: number;
      p50_latency_ms: number;
      p95_latency_ms: number;
    }> = [];

    for (const [key, counters] of this.modelCounters.entries()) {
      const [mode, provider, model_id] = key.split("|");
      const latencies = this.modelLatencySamplesMs.get(key) ?? [];
      perModel.push({
        mode,
        provider,
        model_id,
        succeeded: counters.succeeded,
        failed: counters.failed,
        spend_usd: counters.spendUsd,
        p50_latency_ms: computePercentile(latencies, 50),
        p95_latency_ms: computePercentile(latencies, 95),
      });
    }

    return {
      day_utc: this.currentDayKey,
      total_jobs: this.totalJobs,
      failed_jobs: this.failedJobs,
      refunded_jobs: this.refundedJobs,
      provider_error_rate: Number(providerErrorRate.toFixed(4)),
      credit_refund_rate: Number(creditRefundRate.toFixed(4)),
      queue_depth: this.queueDepth,
      queue_wait_p95_seconds: Number(queueWaitP95Sec.toFixed(2)),
      daily_provider_spend_usd: this.dailySpendUsd,
      daily_spend_cap_usd: this.dailySpendCapUsd,
      kill_switch_active: this.isKillSwitchActive(now) ? 1 : 0,
      circuit_breaker_open: anyBreakerOpen,
      per_model: perModel,
    };
  }

  /**
   * Evaluates the 5 canonical alert rules (Phase 7 & Phase 8):
   * - provider_error_rate > 5% (0.05)
   * - queue_wait_p95 > 30s
   * - daily_provider_spend_usd > daily_spend_cap_usd
   * - credit_refund_rate > 10% (0.10)
   * - circuit_breaker_open == 1
   */
  public evaluateAlertRules(now = new Date()): AlertEvaluation[] {
    const snap = this.getMetricsSnapshot(now);
    return [
      {
        rule: "provider_error_rate_high",
        firing: snap.total_jobs >= 5 && snap.provider_error_rate > 0.05,
        value: snap.provider_error_rate,
        threshold: 0.05,
        message: `Provider error rate is ${(snap.provider_error_rate * 100).toFixed(1)}% (threshold > 5%)`,
      },
      {
        rule: "queue_wait_p95_high",
        firing: snap.queue_wait_p95_seconds > 30,
        value: snap.queue_wait_p95_seconds,
        threshold: 30,
        message: `Queue wait p95 is ${snap.queue_wait_p95_seconds}s (threshold > 30s)`,
      },
      {
        rule: "daily_provider_spend_exceeded",
        firing: snap.daily_provider_spend_usd >= snap.daily_spend_cap_usd,
        value: snap.daily_provider_spend_usd,
        threshold: snap.daily_spend_cap_usd,
        message: `Daily provider spend ($${snap.daily_provider_spend_usd.toFixed(2)}) reached cap ($${snap.daily_spend_cap_usd.toFixed(2)})`,
      },
      {
        rule: "credit_refund_rate_high",
        firing: snap.total_jobs >= 5 && snap.credit_refund_rate > 0.1,
        value: snap.credit_refund_rate,
        threshold: 0.1,
        message: `Credit refund rate is ${(snap.credit_refund_rate * 100).toFixed(1)}% (threshold > 10%)`,
      },
      {
        rule: "circuit_breaker_open",
        firing: snap.circuit_breaker_open === 1,
        value: snap.circuit_breaker_open,
        threshold: 1,
        message:
          snap.circuit_breaker_open === 1
            ? "One or more provider model circuit breakers are OPEN"
            : "All circuit breakers closed",
      },
    ];
  }

  public renderPrometheusMetrics(now = new Date()): string {
    const snap = this.getMetricsSnapshot(now);
    const lines: string[] = [
      "# HELP thumbgen_jobs_total Total generation jobs processed",
      "# TYPE thumbgen_jobs_total counter",
      `thumbgen_jobs_total ${snap.total_jobs}`,
      "# HELP thumbgen_jobs_failed_total Total failed generation jobs",
      "# TYPE thumbgen_jobs_failed_total counter",
      `thumbgen_jobs_failed_total ${snap.failed_jobs}`,
      "# HELP thumbgen_jobs_refunded_total Total refunded generation jobs",
      "# TYPE thumbgen_jobs_refunded_total counter",
      `thumbgen_jobs_refunded_total ${snap.refunded_jobs}`,
      "# HELP thumbgen_provider_error_rate Rolling provider error rate (0..1)",
      "# TYPE thumbgen_provider_error_rate gauge",
      `thumbgen_provider_error_rate ${snap.provider_error_rate}`,
      "# HELP thumbgen_credit_refund_rate Rolling credit refund rate (0..1)",
      "# TYPE thumbgen_credit_refund_rate gauge",
      `thumbgen_credit_refund_rate ${snap.credit_refund_rate}`,
      "# HELP thumbgen_queue_depth Current job queue depth",
      "# TYPE thumbgen_queue_depth gauge",
      `thumbgen_queue_depth ${snap.queue_depth}`,
      "# HELP thumbgen_queue_wait_p95_seconds 95th percentile queue wait time in seconds",
      "# TYPE thumbgen_queue_wait_p95_seconds gauge",
      `thumbgen_queue_wait_p95_seconds ${snap.queue_wait_p95_seconds}`,
      "# HELP thumbgen_daily_provider_spend_usd UTC daily provider spend in USD",
      "# TYPE thumbgen_daily_provider_spend_usd gauge",
      `thumbgen_daily_provider_spend_usd ${snap.daily_provider_spend_usd}`,
      "# HELP thumbgen_daily_spend_cap_usd Configured UTC daily spend cap in USD",
      "# TYPE thumbgen_daily_spend_cap_usd gauge",
      `thumbgen_daily_spend_cap_usd ${snap.daily_spend_cap_usd}`,
      "# HELP thumbgen_daily_spend_kill_switch_active 1 if kill switch is active, 0 otherwise",
      "# TYPE thumbgen_daily_spend_kill_switch_active gauge",
      `thumbgen_daily_spend_kill_switch_active ${snap.kill_switch_active}`,
      "# HELP thumbgen_circuit_breaker_open 1 if any model circuit breaker is open",
      "# TYPE thumbgen_circuit_breaker_open gauge",
      `thumbgen_circuit_breaker_open ${snap.circuit_breaker_open}`,
    ];

    for (const m of snap.per_model) {
      const labels = `mode="${m.mode}",provider="${m.provider}",model_id="${m.model_id}"`;
      lines.push(
        `thumbgen_model_generations_total{${labels},status="succeeded"} ${m.succeeded}`
      );
      lines.push(
        `thumbgen_model_generations_total{${labels},status="failed"} ${m.failed}`
      );
      lines.push(
        `thumbgen_model_latency_p50_ms{${labels}} ${m.p50_latency_ms}`
      );
      lines.push(
        `thumbgen_model_latency_p95_ms{${labels}} ${m.p95_latency_ms}`
      );
      lines.push(`thumbgen_model_spend_usd{${labels}} ${m.spend_usd}`);
    }

    return lines.join("\n") + "\n";
  }

  public getRecentEvents(): Array<Record<string, unknown>> {
    return [...this.recentEvents];
  }

  public reset(): void {
    this.dailySpendUsd = 0;
    this.totalJobs = 0;
    this.failedJobs = 0;
    this.refundedJobs = 0;
    this.queueDepth = 0;
    this.killSwitchManualOverride = null;
    this.queueWaitSamplesSec.length = 0;
    this.modelLatencySamplesMs.clear();
    this.modelCounters.clear();
    this.circuitBreakerStates.clear();
    this.recentEvents.length = 0;
  }
}

export class SlidingWindowRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly hits = new Map<string, number[]>();

  constructor(options?: { windowMs?: number; maxRequests?: number }) {
    this.windowMs = options?.windowMs ?? 60_000;
    this.maxRequests = options?.maxRequests ?? 20;
  }

  public check(
    key: string,
    nowMs = Date.now()
  ): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
    const cutoff = nowMs - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);

    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + this.windowMs - nowMs) / 1000)
      );
      this.hits.set(key, timestamps);
      return {
        allowed: false,
        retryAfterSeconds,
        remaining: 0,
      };
    }

    timestamps.push(nowMs);
    this.hits.set(key, timestamps);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, this.maxRequests - timestamps.length),
    };
  }

  public reset(): void {
    this.hits.clear();
  }
}

export const defaultObservability = new ObservabilityManager();
export const defaultGenerationRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
});
