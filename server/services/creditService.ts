/**
 * services/creditService.ts
 *
 * Atomic credit reservation, commit, refund, grant, adjustment, idempotency,
 * and orphaned-job crash recovery sweep (PLAN.md Sections 6, 8, 9, 12 Phase 3, 13).
 */

import crypto from "crypto";
import {
  loadRegistryConfig,
  type ModeId,
  type PlanId,
  type RegistryConfig,
  type ResolutionTier,
} from "../configs/registryValidator.js";
import CreditLedger, { type LedgerEntryType } from "../models/CreditLedger.js";
import Job, {
  type IJobAssets,
  type IJobGenerationMeta,
  type JobStatus,
} from "../models/Job.js";
import User from "../models/User.js";
import { normalizeResolutionTier } from "../providers/paramMapper.js";

export type CreditErrorCode =
  | "MISSING_IDEMPOTENCY_KEY"
  | "USER_NOT_FOUND"
  | "PLAN_REQUIRED"
  | "INVALID_MODE"
  | "MODE_NOT_ALLOWED_FOR_PLAN"
  | "RESOLUTION_NOT_ALLOWED_FOR_PLAN"
  | "REFERENCE_IMAGES_NOT_ALLOWED"
  | "INSUFFICIENT_CREDITS"
  | "JOB_NOT_FOUND"
  | "INVALID_JOB_STATE";

export class CreditServiceError extends Error {
  public readonly code: CreditErrorCode;
  public readonly status: number;

  constructor(code: CreditErrorCode, status: number, message: string) {
    super(message);
    this.name = "CreditServiceError";
    this.code = code;
    this.status = status;
  }
}

export interface StoredUserRecord {
  id: string;
  plan: "none" | "free" | "starter" | "creator" | "pro";
  credits: number;
  totalCredits: number;
}

export interface StoredJobRecord {
  id: string;
  userId: string;
  thumbnailId: string | null;
  idempotency_key: string;
  mode: ModeId;
  resolution: ResolutionTier;
  aspect_ratio: string;
  prompt: string;
  reference_images_count: number;
  status: JobStatus;
  reserved_credits: number;
  final_credits: number | null;
  error_code: string | null;
  error_message: string | null;
  generation_meta: IJobGenerationMeta | null;
  assets: IJobAssets;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredLedgerRecord {
  id: string;
  user_id: string;
  job_id: string | null;
  type: LedgerEntryType;
  delta: number;
  balance_after: number;
  reason: string;
  idempotency_key: string;
  created_at: Date;
}

/**
 * Abstract storage adapter so `CreditService` can run against Mongoose in
 * production and against an atomic in-memory adapter in unit/concurrency tests.
 */
export interface CreditStoreAdapter {
  getUserById(userId: string): Promise<StoredUserRecord | null>;
  atomicDecrementCredits(
    userId: string,
    cost: number
  ): Promise<StoredUserRecord | null>;
  atomicIncrementCredits(
    userId: string,
    amount: number,
    options?: { incrementTotalCredits?: boolean; planUpdate?: PlanId | "free" }
  ): Promise<StoredUserRecord | null>;
  findJobByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<StoredJobRecord | null>;
  findJobById(jobId: string): Promise<StoredJobRecord | null>;
  createJob(
    data: Omit<
      StoredJobRecord,
      "id" | "createdAt" | "updatedAt" | "startedAt" | "completedAt"
    >
  ): Promise<StoredJobRecord>;
  updateJobThumbnailId(
    jobId: string,
    thumbnailId: string
  ): Promise<StoredJobRecord | null>;
  transitionJobToRunning(jobId: string): Promise<StoredJobRecord | null>;
  transitionJobToSucceeded(
    jobId: string,
    finalCredits: number,
    generationMeta: IJobGenerationMeta,
    assets: IJobAssets
  ): Promise<StoredJobRecord | null>;
  transitionJobToTerminalFailure(
    jobId: string,
    targetStatus: "failed" | "canceled",
    errorCode: string | null,
    errorMessage: string | null
  ): Promise<StoredJobRecord | null>;
  findOrphanedJobs(cutoffDate: Date): Promise<StoredJobRecord[]>;
  countActiveJobsForUser(userId: string): Promise<number>;
  createLedgerEntry(
    entry: Omit<StoredLedgerRecord, "id" | "created_at">
  ): Promise<{ entry: StoredLedgerRecord; created: boolean }>;
  findLedgerEntriesForUser(
    userId: string,
    limit?: number
  ): Promise<StoredLedgerRecord[]>;
  findLedgerEntriesForJob(jobId: string): Promise<StoredLedgerRecord[]>;
}

function mapMongooseJob(doc: any): StoredJobRecord {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    userId: String(obj.userId),
    thumbnailId: obj.thumbnailId ? String(obj.thumbnailId) : null,
    idempotency_key: obj.idempotency_key,
    mode: obj.mode,
    resolution: obj.resolution,
    aspect_ratio: obj.aspect_ratio,
    prompt: obj.prompt,
    reference_images_count: obj.reference_images_count ?? 0,
    status: obj.status,
    reserved_credits: obj.reserved_credits,
    final_credits: obj.final_credits ?? null,
    error_code: obj.error_code ?? null,
    error_message: obj.error_message ?? null,
    generation_meta: obj.generation_meta ?? null,
    assets: obj.assets ?? {
      original_url: null,
      watermarked_url: null,
      preview_webp_url: null,
      delivery_url: null,
    },
    startedAt: obj.startedAt ? new Date(obj.startedAt) : null,
    completedAt: obj.completedAt ? new Date(obj.completedAt) : null,
    createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
    updatedAt: obj.updatedAt ? new Date(obj.updatedAt) : new Date(),
  };
}

function mapMongooseLedger(doc: any): StoredLedgerRecord {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    user_id: String(obj.user_id),
    job_id: obj.job_id ? String(obj.job_id) : null,
    type: obj.type,
    delta: obj.delta,
    balance_after: obj.balance_after,
    reason: obj.reason,
    idempotency_key: obj.idempotency_key,
    created_at: obj.created_at ? new Date(obj.created_at) : new Date(),
  };
}

export class MongooseCreditStore implements CreditStoreAdapter {
  public async getUserById(userId: string): Promise<StoredUserRecord | null> {
    const u = await User.findById(userId).lean();
    if (!u) return null;
    return {
      id: String((u as any)._id),
      plan: (u as any).plan,
      credits: (u as any).credits,
      totalCredits: (u as any).totalCredits ?? 0,
    };
  }

  public async atomicDecrementCredits(
    userId: string,
    cost: number
  ): Promise<StoredUserRecord | null> {
    // Single-document conditional findOneAndUpdate is strictly atomic in MongoDB
    const updated = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: cost } },
      { $inc: { credits: -cost } },
      { new: true }
    ).lean();

    if (!updated) return null;
    return {
      id: String((updated as any)._id),
      plan: (updated as any).plan,
      credits: (updated as any).credits,
      totalCredits: (updated as any).totalCredits ?? 0,
    };
  }

  public async atomicIncrementCredits(
    userId: string,
    amount: number,
    options?: { incrementTotalCredits?: boolean; planUpdate?: PlanId | "free" }
  ): Promise<StoredUserRecord | null> {
    const updateDoc: Record<string, any> = {
      $inc: {
        credits: amount,
        ...(options?.incrementTotalCredits ? { totalCredits: amount } : {}),
      },
    };
    if (options?.planUpdate) {
      updateDoc.$set = { plan: options.planUpdate };
    }

    const updated = await User.findOneAndUpdate(
      { _id: userId, ...(amount < 0 ? { credits: { $gte: -amount } } : {}) },
      updateDoc,
      { new: true }
    ).lean();

    if (!updated) return null;
    return {
      id: String((updated as any)._id),
      plan: (updated as any).plan,
      credits: (updated as any).credits,
      totalCredits: (updated as any).totalCredits ?? 0,
    };
  }

  public async findJobByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<StoredJobRecord | null> {
    const doc = await Job.findOne({
      userId,
      idempotency_key: idempotencyKey,
    }).lean();
    return doc ? mapMongooseJob(doc) : null;
  }

  public async findJobById(jobId: string): Promise<StoredJobRecord | null> {
    const doc = await Job.findById(jobId).lean();
    return doc ? mapMongooseJob(doc) : null;
  }

  public async createJob(
    data: Omit<
      StoredJobRecord,
      "id" | "createdAt" | "updatedAt" | "startedAt" | "completedAt"
    >
  ): Promise<StoredJobRecord> {
    const created = await Job.create(data);
    return mapMongooseJob(created);
  }

  public async updateJobThumbnailId(
    jobId: string,
    thumbnailId: string
  ): Promise<StoredJobRecord | null> {
    const doc = await Job.findByIdAndUpdate(
      jobId,
      { $set: { thumbnailId } },
      { new: true }
    ).lean();
    return doc ? mapMongooseJob(doc) : null;
  }

  public async transitionJobToRunning(
    jobId: string
  ): Promise<StoredJobRecord | null> {
    const doc = await Job.findOneAndUpdate(
      { _id: jobId, status: { $in: ["queued", "running"] } },
      { $set: { status: "running", startedAt: new Date() } },
      { new: true }
    ).lean();
    return doc ? mapMongooseJob(doc) : null;
  }

  public async transitionJobToSucceeded(
    jobId: string,
    finalCredits: number,
    generationMeta: IJobGenerationMeta,
    assets: IJobAssets
  ): Promise<StoredJobRecord | null> {
    const doc = await Job.findOneAndUpdate(
      { _id: jobId, status: { $in: ["queued", "running"] } },
      {
        $set: {
          status: "succeeded",
          final_credits: finalCredits,
          generation_meta: generationMeta,
          assets,
          completedAt: new Date(),
        },
      },
      { new: true }
    ).lean();
    return doc ? mapMongooseJob(doc) : null;
  }

  public async transitionJobToTerminalFailure(
    jobId: string,
    targetStatus: "failed" | "canceled",
    errorCode: string | null,
    errorMessage: string | null
  ): Promise<StoredJobRecord | null> {
    const doc = await Job.findOneAndUpdate(
      { _id: jobId, status: { $in: ["queued", "running"] } },
      {
        $set: {
          status: targetStatus,
          final_credits: 0,
          error_code: errorCode,
          error_message: errorMessage,
          completedAt: new Date(),
        },
      },
      { new: true }
    ).lean();
    return doc ? mapMongooseJob(doc) : null;
  }

  public async findOrphanedJobs(cutoffDate: Date): Promise<StoredJobRecord[]> {
    const docs = await Job.find({
      status: { $in: ["queued", "running"] },
      updatedAt: { $lte: cutoffDate },
    }).lean();
    return docs.map(mapMongooseJob);
  }

  public async countActiveJobsForUser(userId: string): Promise<number> {
    return Job.countDocuments({
      userId,
      status: { $in: ["queued", "running"] },
    });
  }

  public async createLedgerEntry(
    entry: Omit<StoredLedgerRecord, "id" | "created_at">
  ): Promise<{ entry: StoredLedgerRecord; created: boolean }> {
    try {
      const doc = await CreditLedger.create(entry);
      return { entry: mapMongooseLedger(doc), created: true };
    } catch (err: any) {
      if (err?.code === 11000) {
        const existing = await CreditLedger.findOne({
          user_id: entry.user_id,
          idempotency_key: entry.idempotency_key,
          type: entry.type,
        }).lean();
        if (existing) {
          return { entry: mapMongooseLedger(existing), created: false };
        }
      }
      throw err;
    }
  }

  public async findLedgerEntriesForUser(
    userId: string,
    limit: number = 50
  ): Promise<StoredLedgerRecord[]> {
    const docs = await CreditLedger.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
    return docs.map(mapMongooseLedger);
  }

  public async findLedgerEntriesForJob(
    jobId: string
  ): Promise<StoredLedgerRecord[]> {
    const docs = await CreditLedger.find({ job_id: jobId })
      .sort({ created_at: 1 })
      .lean();
    return docs.map(mapMongooseLedger);
  }
}

/**
 * Strictly atomic in-memory store for deterministic unit & concurrency tests.
 * Uses synchronous single-turn compare-and-swap + unique index maps matching
 * MongoDB's document-level atomic findOneAndUpdate and E11000 unique indexes.
 */
export class InMemoryCreditStore implements CreditStoreAdapter {
  private users = new Map<string, StoredUserRecord>();
  private jobs = new Map<string, StoredJobRecord>();
  private jobIdempotencyIndex = new Map<string, string>();
  private ledger = new Map<string, StoredLedgerRecord>();
  private ledgerIdempotencyIndex = new Map<string, string>();

  public seedUser(user: StoredUserRecord): void {
    this.users.set(user.id, { ...user });
  }

  public setJobUpdatedAt(jobId: string, date: Date): void {
    const j = this.jobs.get(jobId);
    if (j) {
      j.updatedAt = date;
    }
  }

  public async getUserById(userId: string): Promise<StoredUserRecord | null> {
    const u = this.users.get(userId);
    return u ? { ...u } : null;
  }

  public async atomicDecrementCredits(
    userId: string,
    cost: number
  ): Promise<StoredUserRecord | null> {
    const u = this.users.get(userId);
    if (!u || u.credits < cost) {
      return null;
    }
    u.credits -= cost;
    return { ...u };
  }

  public async atomicIncrementCredits(
    userId: string,
    amount: number,
    options?: { incrementTotalCredits?: boolean; planUpdate?: PlanId | "free" }
  ): Promise<StoredUserRecord | null> {
    const u = this.users.get(userId);
    if (!u) return null;
    if (amount < 0 && u.credits < -amount) {
      return null;
    }
    u.credits += amount;
    if (options?.incrementTotalCredits) {
      u.totalCredits += amount;
    }
    if (options?.planUpdate) {
      u.plan = options.planUpdate;
    }
    return { ...u };
  }

  public async findJobByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<StoredJobRecord | null> {
    const jobId = this.jobIdempotencyIndex.get(`${userId}:${idempotencyKey}`);
    if (!jobId) return null;
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  public async findJobById(jobId: string): Promise<StoredJobRecord | null> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  public async createJob(
    data: Omit<
      StoredJobRecord,
      "id" | "createdAt" | "updatedAt" | "startedAt" | "completedAt"
    >
  ): Promise<StoredJobRecord> {
    const idxKey = `${data.userId}:${data.idempotency_key}`;
    if (this.jobIdempotencyIndex.has(idxKey)) {
      const dupErr: any = new Error(
        `E11000 duplicate key error on jobs (${idxKey})`
      );
      dupErr.code = 11000;
      throw dupErr;
    }
    const id = `job_${crypto.randomUUID()}`;
    const now = new Date();
    const record: StoredJobRecord = {
      ...data,
      id,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, record);
    this.jobIdempotencyIndex.set(idxKey, id);
    return { ...record };
  }

  public async updateJobThumbnailId(
    jobId: string,
    thumbnailId: string
  ): Promise<StoredJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.thumbnailId = thumbnailId;
    job.updatedAt = new Date();
    return { ...job };
  }

  public async transitionJobToRunning(
    jobId: string
  ): Promise<StoredJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== "queued" && job.status !== "running")) {
      return null;
    }
    job.status = "running";
    job.startedAt = job.startedAt || new Date();
    job.updatedAt = new Date();
    return { ...job };
  }

  public async transitionJobToSucceeded(
    jobId: string,
    finalCredits: number,
    generationMeta: IJobGenerationMeta,
    assets: IJobAssets
  ): Promise<StoredJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== "queued" && job.status !== "running")) {
      return null;
    }
    job.status = "succeeded";
    job.final_credits = finalCredits;
    job.generation_meta = generationMeta;
    job.assets = assets;
    job.completedAt = new Date();
    job.updatedAt = new Date();
    return { ...job };
  }

  public async transitionJobToTerminalFailure(
    jobId: string,
    targetStatus: "failed" | "canceled",
    errorCode: string | null,
    errorMessage: string | null
  ): Promise<StoredJobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== "queued" && job.status !== "running")) {
      return null;
    }
    job.status = targetStatus;
    job.final_credits = 0;
    job.error_code = errorCode;
    job.error_message = errorMessage;
    job.completedAt = new Date();
    job.updatedAt = new Date();
    return { ...job };
  }

  public async findOrphanedJobs(cutoffDate: Date): Promise<StoredJobRecord[]> {
    const results: StoredJobRecord[] = [];
    for (const job of this.jobs.values()) {
      if (
        (job.status === "queued" || job.status === "running") &&
        job.updatedAt.getTime() <= cutoffDate.getTime()
      ) {
        results.push({ ...job });
      }
    }
    return results;
  }

  public async countActiveJobsForUser(userId: string): Promise<number> {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (
        job.userId === userId &&
        (job.status === "queued" || job.status === "running")
      ) {
        count++;
      }
    }
    return count;
  }

  public async createLedgerEntry(
    entry: Omit<StoredLedgerRecord, "id" | "created_at">
  ): Promise<{ entry: StoredLedgerRecord; created: boolean }> {
    const idxKey = `${entry.user_id}:${entry.idempotency_key}:${entry.type}`;
    const existingId = this.ledgerIdempotencyIndex.get(idxKey);
    if (existingId) {
      const existing = this.ledger.get(existingId)!;
      return { entry: { ...existing }, created: false };
    }
    const id = `led_${crypto.randomUUID()}`;
    const record: StoredLedgerRecord = {
      ...entry,
      id,
      created_at: new Date(),
    };
    this.ledger.set(id, record);
    this.ledgerIdempotencyIndex.set(idxKey, id);
    return { entry: { ...record }, created: true };
  }

  public async findLedgerEntriesForUser(
    userId: string,
    limit: number = 50
  ): Promise<StoredLedgerRecord[]> {
    const list: StoredLedgerRecord[] = [];
    for (const item of this.ledger.values()) {
      if (item.user_id === userId) {
        list.push({ ...item });
      }
    }
    list.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return list.slice(0, limit);
  }

  public async findLedgerEntriesForJob(
    jobId: string
  ): Promise<StoredLedgerRecord[]> {
    const list: StoredLedgerRecord[] = [];
    for (const item of this.ledger.values()) {
      if (item.job_id === jobId) {
        list.push({ ...item });
      }
    }
    list.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    return list;
  }
}

const TIER_RANK: Record<ResolutionTier, number> = {
  "1K": 1,
  "2K": 2,
  "4K": 3,
};

/**
 * Maps legacy `"free"` plan to `"starter"` plan entitlements (`2K`, watermark, no reference images).
 */
export function resolveEffectivePlanId(
  rawPlan: string
): PlanId | null {
  if (rawPlan === "starter" || rawPlan === "free") return "starter";
  if (rawPlan === "creator") return "creator";
  if (rawPlan === "pro") return "pro";
  return null;
}

/**
 * Resolves the default mode when a caller does not explicitly pass `mode`:
 * - If `resolution === "4K"`, uses `"ultra"` (5 credits)
 * - If `hasReferenceImages`, uses `"premium"` (3 credits)
 * - Otherwise uses `"standard"` (2 credits)
 */
export function resolveRequestedMode(
  explicitMode: string | undefined,
  resolutionTier: ResolutionTier,
  hasReferenceImages: boolean
): ModeId {
  if (explicitMode) {
    if (
      explicitMode === "fast" ||
      explicitMode === "standard" ||
      explicitMode === "premium" ||
      explicitMode === "ultra"
    ) {
      return explicitMode;
    }
    throw new CreditServiceError(
      "INVALID_MODE",
      400,
      `Invalid generation mode '${explicitMode}'. Expected fast, standard, premium, or ultra.`
    );
  }

  if (resolutionTier === "4K") return "ultra";
  if (hasReferenceImages) return "premium";
  return "standard";
}

export interface ReserveAndCreateJobInput {
  userId: string;
  idempotencyKey: string;
  mode?: ModeId | string;
  resolution?: string;
  aspectRatio?: string;
  prompt: string;
  referenceImagesCount?: number;
  thumbnailId?: string | null;
}

export interface ReserveAndCreateJobResult {
  job: StoredJobRecord;
  ledgerEntry: StoredLedgerRecord | null;
  userCreditsAfter: number;
  effectivePlan: PlanId;
  idempotentReplay: boolean;
}

export class CreditService {
  private readonly store: CreditStoreAdapter;
  private readonly registryOverride?: RegistryConfig;
  private readonly inFlightByIdempotencyKey = new Map<
    string,
    Promise<ReserveAndCreateJobResult>
  >();

  constructor(options?: {
    store?: CreditStoreAdapter;
    registry?: RegistryConfig;
  }) {
    this.store = options?.store ?? new MongooseCreditStore();
    this.registryOverride = options?.registry;
  }

  private getRegistry(): RegistryConfig {
    return this.registryOverride ?? loadRegistryConfig();
  }

  public getStore(): CreditStoreAdapter {
    return this.store;
  }

  /**
   * Atomically validates entitlements, checks idempotency, decrements user credits,
   * and writes the `Job` (`queued`) and `credit_ledger` (`reserve`) records.
   */
  public async reserveCreditsAndCreateJob(
    input: ReserveAndCreateJobInput
  ): Promise<ReserveAndCreateJobResult> {
    const idempotencyKey = (input.idempotencyKey || "").trim();
    if (!idempotencyKey) {
      throw new CreditServiceError(
        "MISSING_IDEMPOTENCY_KEY",
        400,
        "Idempotency-Key header (or idempotencyKey field) is required"
      );
    }

    const inFlightKey = `${input.userId}:${idempotencyKey}`;
    const existingInFlight = this.inFlightByIdempotencyKey.get(inFlightKey);
    if (existingInFlight) {
      const res = await existingInFlight;
      return {
        ...res,
        idempotentReplay: true,
      };
    }

    const promise = this.executeReserveCreditsAndCreateJob(
      input,
      idempotencyKey
    );
    this.inFlightByIdempotencyKey.set(inFlightKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightByIdempotencyKey.delete(inFlightKey);
    }
  }

  private async executeReserveCreditsAndCreateJob(
    input: ReserveAndCreateJobInput,
    idempotencyKey: string
  ): Promise<ReserveAndCreateJobResult> {

    const user = await this.store.getUserById(input.userId);
    if (!user) {
      throw new CreditServiceError("USER_NOT_FOUND", 404, "User not found");
    }

    const effectivePlan = resolveEffectivePlanId(user.plan);
    if (!effectivePlan) {
      throw new CreditServiceError(
        "PLAN_REQUIRED",
        403,
        "Please select a plan to generate thumbnails"
      );
    }

    // 1. Check idempotency BEFORE charging
    const existingJob = await this.store.findJobByIdempotencyKey(
      input.userId,
      idempotencyKey
    );
    if (existingJob) {
      const existingLedgers = await this.store.findLedgerEntriesForJob(
        existingJob.id
      );
      const reserveEntry =
        existingLedgers.find((e) => e.type === "reserve") ?? null;
      return {
        job: existingJob,
        ledgerEntry: reserveEntry,
        userCreditsAfter: user.credits,
        effectivePlan,
        idempotentReplay: true,
      };
    }

    const registry = this.getRegistry();
    const planCfg = registry.plans[effectivePlan];

    const resolutionTier: ResolutionTier = normalizeResolutionTier(
      input.resolution || "2K",
      "registry",
      String(input.mode || "standard")
    );

    const refCount = Math.max(0, input.referenceImagesCount ?? 0);
    const hasRefs = refCount > 0;

    // 2. Enforce plan-level reference image entitlement
    if (hasRefs && !planCfg.reference_images) {
      throw new CreditServiceError(
        "REFERENCE_IMAGES_NOT_ALLOWED",
        403,
        "Reference images are only available on Creator and Pro plans"
      );
    }

    // 3. Enforce plan-level max resolution
    if (TIER_RANK[resolutionTier] > TIER_RANK[planCfg.max_resolution]) {
      throw new CreditServiceError(
        "RESOLUTION_NOT_ALLOWED_FOR_PLAN",
        403,
        `${resolutionTier} resolution requires Creator or Pro plan (your plan max is ${planCfg.max_resolution})`
      );
    }

    // 4. Resolve and validate Mode
    const modeId = resolveRequestedMode(input.mode, resolutionTier, hasRefs);
    const modeCfg = registry.modes[modeId];
    if (!modeCfg || !modeCfg.enabled) {
      throw new CreditServiceError(
        "INVALID_MODE",
        400,
        `Generation mode '${modeId}' is not enabled`
      );
    }

    if (!modeCfg.allowed_plans.includes(effectivePlan)) {
      throw new CreditServiceError(
        "MODE_NOT_ALLOWED_FOR_PLAN",
        403,
        `Mode '${modeCfg.label}' (${modeId}) is only available on ${modeCfg.allowed_plans.join(
          " and "
        )} plans`
      );
    }

    const modePlanMaxRes = modeCfg.max_resolution_by_plan[effectivePlan];
    if (
      !modePlanMaxRes ||
      TIER_RANK[resolutionTier] > TIER_RANK[modePlanMaxRes]
    ) {
      throw new CreditServiceError(
        "RESOLUTION_NOT_ALLOWED_FOR_PLAN",
        403,
        `Mode '${modeCfg.label}' supports up to ${
          modePlanMaxRes ?? "2K"
        } resolution on the ${effectivePlan} plan (requested ${resolutionTier})`
      );
    }

    const creditsCost = modeCfg.credits;

    // 5. Atomically check `credits >= creditsCost` and decrement in one operation
    const updatedUser = await this.store.atomicDecrementCredits(
      input.userId,
      creditsCost
    );
    if (!updatedUser) {
      throw new CreditServiceError(
        "INSUFFICIENT_CREDITS",
        402,
        `Insufficient credits. Mode '${modeCfg.label}' requires ${creditsCost} credit(s), available: ${user.credits}.`
      );
    }

    // 6. Create the Job record (handling concurrent duplicate Idempotency-Key race)
    let job: StoredJobRecord;
    try {
      job = await this.store.createJob({
        userId: input.userId,
        thumbnailId: input.thumbnailId ?? null,
        idempotency_key: idempotencyKey,
        mode: modeId,
        resolution: resolutionTier,
        aspect_ratio: input.aspectRatio || "16:9",
        prompt: input.prompt,
        reference_images_count: refCount,
        status: "queued",
        reserved_credits: creditsCost,
        final_credits: null,
        error_code: null,
        error_message: null,
        generation_meta: null,
        assets: {
          original_url: null,
          watermarked_url: null,
          preview_webp_url: null,
          delivery_url: null,
        },
      });
    } catch (err: any) {
      // Roll back the credit decrement immediately
      const restored = await this.store.atomicIncrementCredits(
        input.userId,
        creditsCost
      );

      // If this was a concurrent duplicate Idempotency-Key race (E11000), return the winner's job
      if (err?.code === 11000) {
        const winnerJob = await this.store.findJobByIdempotencyKey(
          input.userId,
          idempotencyKey
        );
        if (winnerJob) {
          const ledgers = await this.store.findLedgerEntriesForJob(
            winnerJob.id
          );
          return {
            job: winnerJob,
            ledgerEntry: ledgers.find((e) => e.type === "reserve") ?? null,
            userCreditsAfter: restored?.credits ?? updatedUser.credits,
            effectivePlan,
            idempotentReplay: true,
          };
        }
      }
      throw err;
    }

    // 7. Write append-only `reserve` ledger entry
    const { entry: reserveEntry } = await this.store.createLedgerEntry({
      user_id: input.userId,
      job_id: job.id,
      type: "reserve",
      delta: -creditsCost,
      balance_after: updatedUser.credits,
      reason: `Reserve ${creditsCost} credit(s) for ${modeId} (${resolutionTier}) generation`,
      idempotency_key: `reserve:${job.id}`,
    });

    return {
      job,
      ledgerEntry: reserveEntry,
      userCreditsAfter: updatedUser.credits,
      effectivePlan,
      idempotentReplay: false,
    };
  }

  /**
   * Transitions a job from `queued` to `running`.
   */
  public async markJobRunning(jobId: string): Promise<StoredJobRecord> {
    const updated = await this.store.transitionJobToRunning(jobId);
    if (!updated) {
      const existing = await this.store.findJobById(jobId);
      if (!existing) {
        throw new CreditServiceError(
          "JOB_NOT_FOUND",
          404,
          `Job '${jobId}' not found`
        );
      }
      throw new CreditServiceError(
        "INVALID_JOB_STATE",
        409,
        `Cannot transition job '${jobId}' from '${existing.status}' to 'running'`
      );
    }
    return updated;
  }

  /**
   * Commits reserved credits when a job's output asset is durably stored & verified.
   * - Never charges more than `reserved_credits` (Section 8 Rule 4).
   * - If `actualCreditsCost < reserved_credits`, refunds the difference automatically.
   */
  public async commitJobCredits(params: {
    jobId: string;
    actualCreditsCost?: number;
    generationMeta: IJobGenerationMeta;
    assets: IJobAssets;
  }): Promise<{
    job: StoredJobRecord;
    commitEntry: StoredLedgerRecord;
    partialRefundEntry: StoredLedgerRecord | null;
  }> {
    const existing = await this.store.findJobById(params.jobId);
    if (!existing) {
      throw new CreditServiceError(
        "JOB_NOT_FOUND",
        404,
        `Job '${params.jobId}' not found`
      );
    }

    // Idempotent replay if already succeeded
    if (existing.status === "succeeded") {
      const ledgers = await this.store.findLedgerEntriesForJob(existing.id);
      const commitEntry = ledgers.find((e) => e.type === "commit")!;
      const partialRefundEntry =
        ledgers.find((e) => e.type === "refund") ?? null;
      return { job: existing, commitEntry, partialRefundEntry };
    }

    if (existing.status === "failed" || existing.status === "canceled") {
      throw new CreditServiceError(
        "INVALID_JOB_STATE",
        409,
        `Cannot commit job '${existing.id}' because it is already '${existing.status}'`
      );
    }

    const requestedFinal =
      params.actualCreditsCost !== undefined
        ? Math.max(0, Math.floor(params.actualCreditsCost))
        : existing.reserved_credits;

    // Never charge more than reserved (Section 8 Rule 4)
    const finalCredits = Math.min(existing.reserved_credits, requestedFinal);
    const refundDiff = existing.reserved_credits - finalCredits;

    const transitioned = await this.store.transitionJobToSucceeded(
      existing.id,
      finalCredits,
      params.generationMeta,
      params.assets
    );
    if (!transitioned) {
      // Race with another worker/process: re-fetch
      const raced = await this.store.findJobById(existing.id);
      if (raced && raced.status === "succeeded") {
        const ledgers = await this.store.findLedgerEntriesForJob(raced.id);
        return {
          job: raced,
          commitEntry: ledgers.find((e) => e.type === "commit")!,
          partialRefundEntry: ledgers.find((e) => e.type === "refund") ?? null,
        };
      }
      throw new CreditServiceError(
        "INVALID_JOB_STATE",
        409,
        `Failed to transition job '${existing.id}' to succeeded`
      );
    }

    const currentUser = await this.store.getUserById(existing.userId);
    const balanceBeforePartialRefund = currentUser?.credits ?? 0;

    const { entry: commitEntry } = await this.store.createLedgerEntry({
      user_id: existing.userId,
      job_id: existing.id,
      type: "commit",
      delta: 0,
      balance_after: balanceBeforePartialRefund,
      reason: `Commit ${finalCredits} credit(s) for succeeded job ${existing.id}`,
      idempotency_key: `commit:${existing.id}`,
    });

    let partialRefundEntry: StoredLedgerRecord | null = null;
    if (refundDiff > 0) {
      const { entry, created } = await this.store.createLedgerEntry({
        user_id: existing.userId,
        job_id: existing.id,
        type: "refund",
        delta: refundDiff,
        balance_after: balanceBeforePartialRefund + refundDiff,
        reason: `Partial refund of ${refundDiff} credit(s) (reserved ${existing.reserved_credits}, final ${finalCredits})`,
        idempotency_key: `partial_refund:${existing.id}`,
      });
      partialRefundEntry = entry;
      if (created) {
        await this.store.atomicIncrementCredits(existing.userId, refundDiff);
      }
    }

    return {
      job: transitioned,
      commitEntry,
      partialRefundEntry,
    };
  }

  /**
   * Refunds 100% of reserved credits on any terminal job failure or cancellation
   * (Section 8 Rule 5). Strictly idempotent: calling multiple times for the same
   * job will NEVER double-refund.
   */
  public async refundJobCredits(params: {
    jobId: string;
    reason: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    targetStatus?: "failed" | "canceled";
  }): Promise<{
    job: StoredJobRecord;
    refundEntry: StoredLedgerRecord | null;
    refundedNow: boolean;
  }> {
    const targetStatus = params.targetStatus ?? "failed";
    const existing = await this.store.findJobById(params.jobId);
    if (!existing) {
      throw new CreditServiceError(
        "JOB_NOT_FOUND",
        404,
        `Job '${params.jobId}' not found`
      );
    }

    // Already failed or canceled -> idempotent no-op
    if (existing.status === "failed" || existing.status === "canceled") {
      const ledgers = await this.store.findLedgerEntriesForJob(existing.id);
      const refundEntry = ledgers.find((e) => e.type === "refund") ?? null;
      return { job: existing, refundEntry, refundedNow: false };
    }

    if (existing.status === "succeeded") {
      throw new CreditServiceError(
        "INVALID_JOB_STATE",
        409,
        `Cannot refund job '${existing.id}' because it already succeeded`
      );
    }

    // Atomically transition from queued|running -> failed|canceled
    const transitioned = await this.store.transitionJobToTerminalFailure(
      existing.id,
      targetStatus,
      params.errorCode ?? "GENERATION_FAILED",
      params.errorMessage ?? params.reason
    );

    if (!transitioned) {
      // Lost race to another refund/commit call -> return current state without double refunding
      const raced = await this.store.findJobById(existing.id);
      const ledgers = await this.store.findLedgerEntriesForJob(existing.id);
      return {
        job: raced ?? existing,
        refundEntry: ledgers.find((e) => e.type === "refund") ?? null,
        refundedNow: false,
      };
    }

    const refundAmount = existing.reserved_credits;
    const updatedUser = await this.store.atomicIncrementCredits(
      existing.userId,
      refundAmount
    );
    const balanceAfter = updatedUser?.credits ?? refundAmount;

    const { entry: refundEntry, created } = await this.store.createLedgerEntry({
      user_id: existing.userId,
      job_id: existing.id,
      type: "refund",
      delta: refundAmount,
      balance_after: balanceAfter,
      reason: params.reason,
      idempotency_key: `refund:${existing.id}`,
    });

    return {
      job: transitioned,
      refundEntry,
      refundedNow: created,
    };
  }

  /**
   * Grants credits to a user (payment purchase, plan activation, promotional grant)
   * with an idempotent `grant` ledger entry.
   */
  public async grantCredits(params: {
    userId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
    planUpdate?: PlanId | "free";
  }): Promise<{
    user: StoredUserRecord;
    ledgerEntry: StoredLedgerRecord;
    grantedNow: boolean;
  }> {
    if (params.amount <= 0) {
      throw new Error(`Grant amount must be positive, got ${params.amount}`);
    }
    const existingUser = await this.store.getUserById(params.userId);
    if (!existingUser) {
      throw new CreditServiceError("USER_NOT_FOUND", 404, "User not found");
    }

    // Write ledger entry first (or check uniqueness) so duplicate webhooks never double-grant
    const { entry, created } = await this.store.createLedgerEntry({
      user_id: params.userId,
      job_id: null,
      type: "grant",
      delta: params.amount,
      balance_after: existingUser.credits + params.amount,
      reason: params.reason,
      idempotency_key: params.idempotencyKey,
    });

    if (!created) {
      return {
        user: existingUser,
        ledgerEntry: entry,
        grantedNow: false,
      };
    }

    const updatedUser = await this.store.atomicIncrementCredits(
      params.userId,
      params.amount,
      {
        incrementTotalCredits: true,
        planUpdate: params.planUpdate,
      }
    );

    return {
      user: updatedUser ?? existingUser,
      ledgerEntry: entry,
      grantedNow: true,
    };
  }

  /**
   * Administrative adjustment (`adjust` ledger entry), preventing negative balances.
   */
  public async adjustCredits(params: {
    userId: string;
    delta: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<{
    user: StoredUserRecord;
    ledgerEntry: StoredLedgerRecord;
    adjustedNow: boolean;
  }> {
    const existingUser = await this.store.getUserById(params.userId);
    if (!existingUser) {
      throw new CreditServiceError("USER_NOT_FOUND", 404, "User not found");
    }

    if (existingUser.credits + params.delta < 0) {
      throw new CreditServiceError(
        "INSUFFICIENT_CREDITS",
        402,
        `Adjustment of ${params.delta} would result in negative credit balance`
      );
    }

    const updatedUser = await this.store.atomicIncrementCredits(
      params.userId,
      params.delta
    );
    if (!updatedUser) {
      throw new CreditServiceError(
        "INSUFFICIENT_CREDITS",
        402,
        `Adjustment of ${params.delta} failed due to insufficient credits`
      );
    }

    const { entry, created } = await this.store.createLedgerEntry({
      user_id: params.userId,
      job_id: null,
      type: "adjust",
      delta: params.delta,
      balance_after: updatedUser.credits,
      reason: params.reason,
      idempotency_key: params.idempotencyKey,
    });

    return {
      user: updatedUser,
      ledgerEntry: entry,
      adjustedNow: created,
    };
  }

  /**
   * Crash recovery sweep (Section 8 Rule 5):
   * Refunds any orphaned `queued` or `running` jobs whose `updatedAt` is older than `maxAgeMs`.
   */
  public async sweepOrphanedJobs(options?: {
    maxAgeMs?: number;
    now?: Date;
  }): Promise<{
    sweptCount: number;
    refundedJobIds: string[];
  }> {
    const maxAgeMs = options?.maxAgeMs ?? 15 * 60 * 1000; // default 15 minutes
    const nowMs = (options?.now ?? new Date()).getTime();
    const cutoff = new Date(nowMs - maxAgeMs);

    const orphaned = await this.store.findOrphanedJobs(cutoff);
    const refundedJobIds: string[] = [];

    for (const job of orphaned) {
      const res = await this.refundJobCredits({
        jobId: job.id,
        reason: `Automatic refund: orphaned job exceeded max TTL (${Math.round(
          maxAgeMs / 1000
        )}s)`,
        errorCode: "ORPHANED_JOB_TIMEOUT",
        errorMessage:
          "Generation timed out or worker restarted; your credits were automatically refunded.",
        targetStatus: "failed",
      });
      if (res.refundedNow) {
        refundedJobIds.push(job.id);
      }
    }

    return {
      sweptCount: orphaned.length,
      refundedJobIds,
    };
  }
}

export const defaultCreditService = new CreditService();
