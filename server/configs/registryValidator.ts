/**
 * configs/registryValidator.ts
 *
 * Schema and business-rule validator for config/registry.json against
 * config/models.snapshot.json (PLAN.md Sections 1 R3, 5, 6, 13).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { ModelsSnapshot, DiscoveredModel } from "../scripts/discover-models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type PlanId = "starter" | "creator" | "pro";
export type ModeId = "fast" | "standard" | "premium" | "ultra";
export type ResolutionTier = "1K" | "2K" | "4K";

export interface PlanConfig {
  name: string;
  price_usd: number;
  credits: number;
  most_popular: boolean;
  max_resolution: ResolutionTier;
  watermark: boolean;
  reference_images: boolean;
  max_concurrent_jobs: number;
  marketing_thumbnails_claim: string;
}

export interface ProviderConfig {
  enabled: boolean;
  base_url: string | null;
  verified_at: string | null;
  source_url: string | null;
  max_concurrency: number | null;
  todo?: string;
}

export interface CandidateConfig {
  provider: string;
  model_id: string | null;
  est_cost_usd: number | null;
  verified_at: string | null;
  source_url: string | null;
  preview: boolean;
  license_checked: boolean;
  supports_reference_image: boolean;
  default_resolution: ResolutionTier;
  upscaler_verified?: boolean;
  todo?: string;
}

export interface ModeConfig {
  enabled: boolean;
  label: string;
  description: string;
  credits: number;
  allowed_plans: PlanId[];
  max_resolution_by_plan: Record<PlanId, ResolutionTier | null>;
  candidates: CandidateConfig[];
}

export interface RegistryConfig {
  schema_version: number;
  updated_at: string;
  margin_guard: {
    max_cost_to_revenue_ratio: number;
  };
  plans: Record<PlanId, PlanConfig>;
  providers: Record<string, ProviderConfig>;
  modes: Record<ModeId, ModeConfig>;
}

export interface ValidationIssue {
  path: string;
  code:
    | "INVALID_SCHEMA"
    | "NULL_VALUE"
    | "UNKNOWN_PROVIDER"
    | "DISABLED_PROVIDER"
    | "UNKNOWN_MODEL_ID"
    | "STALE_VERIFIED_AT"
    | "INVALID_VERIFIED_AT"
    | "LICENSE_NOT_CHECKED"
    | "PREVIEW_WITHOUT_FALLBACK"
    | "UNFLAGGED_PREVIEW_MODEL"
    | "FALLBACK_COST_HIGHER"
    | "UNSUPPORTED_4K_RESOLUTION"
    | "MARGIN_GUARD_EXCEEDED";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidateOptions {
  /** Reference time for the 30-day staleness check (defaults to Date.now()). */
  now?: Date;
  /** Maximum age in days for verified_at timestamps (default: 30). */
  maxAgeDays?: number;
  /** Allow MOCK_* model IDs and mock costs in dev/test mode. */
  allowMock?: boolean;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function loadRegistryConfig(customPath?: string): RegistryConfig {
  const resolved =
    customPath ||
    path.resolve(__dirname, "../config/registry.json");
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw) as RegistryConfig;
}

export function loadModelsSnapshot(customPath?: string): ModelsSnapshot {
  const resolved =
    customPath ||
    path.resolve(__dirname, "../config/models.snapshot.json");
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw) as ModelsSnapshot;
}

export function computeLowestPlanCreditValue(
  plans: Record<PlanId, PlanConfig>
): { planId: PlanId; valuePerCreditUsd: number } {
  let lowestPlan: PlanId = "creator";
  let lowestValue = Infinity;

  for (const planId of ["starter", "creator", "pro"] as PlanId[]) {
    const plan = plans[planId];
    if (!plan || plan.credits <= 0) continue;
    const val = plan.price_usd / plan.credits;
    if (val < lowestValue) {
      lowestValue = val;
      lowestPlan = planId;
    }
  }

  return { planId: lowestPlan, valuePerCreditUsd: lowestValue };
}

export function validateRegistry(
  registry: RegistryConfig,
  snapshot: ModelsSnapshot,
  options: ValidateOptions = {}
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const nowMs = (options.now ?? new Date()).getTime();
  const maxAgeMs =
    options.maxAgeDays !== undefined
      ? options.maxAgeDays * 24 * 60 * 60 * 1000
      : THIRTY_DAYS_MS;
  const allowMock = options.allowMock === true;

  if (!registry || typeof registry !== "object") {
    return {
      valid: false,
      errors: [
        {
          path: "root",
          code: "INVALID_SCHEMA",
          message: "Registry config must be a JSON object",
        },
      ],
      warnings: [],
    };
  }

  // Build snapshot lookup: `${provider}:${model_id}` -> DiscoveredModel
  const snapshotMap = new Map<string, DiscoveredModel>();
  for (const m of snapshot?.models ?? []) {
    snapshotMap.set(`${m.provider}:${m.model_id}`, m);
  }

  // 1. Validate plans
  for (const planId of ["starter", "creator", "pro"] as PlanId[]) {
    const plan = registry.plans?.[planId];
    if (!plan) {
      errors.push({
        path: `plans.${planId}`,
        code: "INVALID_SCHEMA",
        message: `Missing required plan '${planId}'`,
      });
      continue;
    }
    if (
      typeof plan.price_usd !== "number" ||
      !Number.isInteger(plan.price_usd) ||
      plan.price_usd <= 0
    ) {
      errors.push({
        path: `plans.${planId}.price_usd`,
        code: "INVALID_SCHEMA",
        message: `Plan '${planId}' price_usd must be a positive integer`,
      });
    }
    if (
      typeof plan.credits !== "number" ||
      !Number.isInteger(plan.credits) ||
      plan.credits <= 0
    ) {
      errors.push({
        path: `plans.${planId}.credits`,
        code: "INVALID_SCHEMA",
        message: `Plan '${planId}' credits must be a positive integer`,
      });
    }
  }

  // 2. Validate enabled providers
  if (!registry.providers || typeof registry.providers !== "object") {
    errors.push({
      path: "providers",
      code: "INVALID_SCHEMA",
      message: "Missing providers object in registry",
    });
  } else {
    for (const [providerName, prov] of Object.entries(registry.providers)) {
      if (!prov.enabled) continue;
      if (!prov.base_url || typeof prov.base_url !== "string") {
        errors.push({
          path: `providers.${providerName}.base_url`,
          code: "NULL_VALUE",
          message: `Enabled provider '${providerName}' has null or empty base_url`,
        });
      }
      if (!allowMock) {
        if (!prov.verified_at) {
          errors.push({
            path: `providers.${providerName}.verified_at`,
            code: "NULL_VALUE",
            message: `Enabled provider '${providerName}' has null verified_at`,
          });
        } else {
          const ts = Date.parse(prov.verified_at);
          if (Number.isNaN(ts)) {
            errors.push({
              path: `providers.${providerName}.verified_at`,
              code: "INVALID_VERIFIED_AT",
              message: `Enabled provider '${providerName}' has invalid verified_at ISO date '${prov.verified_at}'`,
            });
          } else if (nowMs - ts > maxAgeMs) {
            errors.push({
              path: `providers.${providerName}.verified_at`,
              code: "STALE_VERIFIED_AT",
              message: `Enabled provider '${providerName}' verified_at ('${prov.verified_at}') is older than ${
                maxAgeMs / (24 * 60 * 60 * 1000)
              } days`,
            });
          }
        }
      }
    }
  }

  // 3. Validate modes & candidates
  const maxRatio = registry.margin_guard?.max_cost_to_revenue_ratio ?? 0.35;
  const { valuePerCreditUsd } = registry.plans
    ? computeLowestPlanCreditValue(registry.plans)
    : { valuePerCreditUsd: 0.145 };

  if (!registry.modes || typeof registry.modes !== "object") {
    errors.push({
      path: "modes",
      code: "INVALID_SCHEMA",
      message: "Missing modes object in registry",
    });
  } else {
    for (const [modeId, mode] of Object.entries(registry.modes)) {
      if (!mode.enabled) continue;

      const modePath = `modes.${modeId}`;
      if (!mode.label || typeof mode.label !== "string") {
        errors.push({
          path: `${modePath}.label`,
          code: "INVALID_SCHEMA",
          message: `Mode '${modeId}' must have a non-empty display label`,
        });
      }
      if (
        typeof mode.credits !== "number" ||
        !Number.isInteger(mode.credits) ||
        mode.credits <= 0
      ) {
        errors.push({
          path: `${modePath}.credits`,
          code: "INVALID_SCHEMA",
          message: `Mode '${modeId}' credits must be a positive integer (Rule R7)`,
        });
      }

      if (!Array.isArray(mode.candidates) || mode.candidates.length === 0) {
        errors.push({
          path: `${modePath}.candidates`,
          code: "INVALID_SCHEMA",
          message: `Enabled mode '${modeId}' must configure at least one candidate`,
        });
        continue;
      }

      let prevCostUsd: number | null = null;

      mode.candidates.forEach((cand, idx) => {
        const candPath = `${modePath}.candidates[${idx}]`;
        const isMockCandidate =
          allowMock &&
          typeof cand.model_id === "string" &&
          cand.model_id.startsWith("MOCK_");

        // Provider check
        const prov = registry.providers?.[cand.provider];
        if (!prov) {
          errors.push({
            path: `${candPath}.provider`,
            code: "UNKNOWN_PROVIDER",
            message: `Candidate references unknown provider '${cand.provider}'`,
          });
        } else if (!prov.enabled && !isMockCandidate) {
          errors.push({
            path: `${candPath}.provider`,
            code: "DISABLED_PROVIDER",
            message: `Candidate uses disabled provider '${cand.provider}'`,
          });
        }

        // Model ID check
        if (cand.model_id === null || cand.model_id.trim() === "") {
          errors.push({
            path: `${candPath}.model_id`,
            code: "NULL_VALUE",
            message: `Candidate model_id is null or empty (${cand.todo || "TODO(verify)"})`,
          });
        } else if (!isMockCandidate) {
          const snapEntry = snapshotMap.get(
            `${cand.provider}:${cand.model_id}`
          );
          if (!snapEntry) {
            errors.push({
              path: `${candPath}.model_id`,
              code: "UNKNOWN_MODEL_ID",
              message: `Model '${cand.model_id}' for provider '${cand.provider}' does not exist in models.snapshot.json`,
            });
          } else if (
            cand.default_resolution === "4K" &&
            !cand.upscaler_verified
          ) {
            // Section 6 4K rule: if mode/candidate targets 4K natively, model in snapshot must list 4K
            const sizes = snapEntry.supported_sizes ?? [];
            const supports4K = sizes.some(
              (s) => s.toUpperCase() === "4K" || s === "3840x2160"
            );
            if (!supports4K) {
              errors.push({
                path: `${candPath}.default_resolution`,
                code: "UNSUPPORTED_4K_RESOLUTION",
                message: `Model '${cand.model_id}' does not report native '4K' support in models.snapshot.json (supported_sizes: ${JSON.stringify(
                  sizes
                )}) and no verified upscaler is configured`,
              });
            }
          }

          // Preview model rules (Section 5 & Pitfall P5)
          if (
            cand.model_id.toLowerCase().includes("preview") &&
            cand.preview !== true
          ) {
            errors.push({
              path: `${candPath}.preview`,
              code: "UNFLAGGED_PREVIEW_MODEL",
              message: `Model '${cand.model_id}' appears to be a preview model but is not flagged with preview: true`,
            });
          }
        }

        if (cand.preview === true) {
          const hasFallback = mode.candidates
            .slice(idx + 1)
            .some((later) => later.model_id !== null && !later.preview);
          if (!hasFallback) {
            errors.push({
              path: `${candPath}.preview`,
              code: "PREVIEW_WITHOUT_FALLBACK",
              message: `Preview model '${cand.model_id}' in mode '${modeId}' requires a configured non-preview fallback candidate after it`,
            });
          }
        }

        // License check (Section 5 & Pitfall P7)
        if (cand.license_checked !== true && !isMockCandidate) {
          errors.push({
            path: `${candPath}.license_checked`,
            code: "LICENSE_NOT_CHECKED",
            message: `Candidate '${
              cand.model_id ?? "unknown"
            }' has license_checked: false and cannot be enabled in production (${
              cand.todo || "Pitfall P7"
            })`,
          });
        }

        // Estimated cost check (Rule R3)
        if (
          cand.est_cost_usd === null ||
          typeof cand.est_cost_usd !== "number" ||
          !Number.isFinite(cand.est_cost_usd) ||
          cand.est_cost_usd < 0
        ) {
          errors.push({
            path: `${candPath}.est_cost_usd`,
            code: "NULL_VALUE",
            message: `Candidate '${
              cand.model_id ?? "unknown"
            }' has null or invalid est_cost_usd (${cand.todo || "TODO(verify)"})`,
          });
        } else {
          // Same-mode fallback cost ordering check (Section 5)
          if (prevCostUsd !== null && cand.est_cost_usd > prevCostUsd) {
            errors.push({
              path: `${candPath}.est_cost_usd`,
              code: "FALLBACK_COST_HIGHER",
              message: `Fallback candidate '${cand.model_id}' has higher estimated cost ($${cand.est_cost_usd}) than preceding candidate ($${prevCostUsd}) in mode '${modeId}'`,
            });
          }
          prevCostUsd = cand.est_cost_usd;

          // Margin guard check (Section 6)
          if (
            Number.isFinite(valuePerCreditUsd) &&
            valuePerCreditUsd > 0 &&
            mode.credits > 0
          ) {
            const revenue = mode.credits * valuePerCreditUsd;
            const ratio = cand.est_cost_usd / revenue;
            if (ratio > maxRatio) {
              errors.push({
                path: `${candPath}.est_cost_usd`,
                code: "MARGIN_GUARD_EXCEEDED",
                message: `Mode '${modeId}' candidate '${
                  cand.model_id
                }' cost-to-revenue ratio is ${(ratio * 100).toFixed(
                  2
                )}% ($${cand.est_cost_usd} / $${revenue.toFixed(
                  4
                )}), exceeding limit of ${(maxRatio * 100).toFixed(0)}%`,
              });
            }
          }
        }

        // verified_at check (Rule R3: fail if null or > 30 days old)
        if (!cand.verified_at && !isMockCandidate) {
          errors.push({
            path: `${candPath}.verified_at`,
            code: "NULL_VALUE",
            message: `Candidate '${
              cand.model_id ?? "unknown"
            }' has null verified_at`,
          });
        } else if (cand.verified_at) {
          const ts = Date.parse(cand.verified_at);
          if (Number.isNaN(ts)) {
            errors.push({
              path: `${candPath}.verified_at`,
              code: "INVALID_VERIFIED_AT",
              message: `Candidate '${
                cand.model_id ?? "unknown"
              }' has invalid verified_at ISO timestamp '${cand.verified_at}'`,
            });
          } else if (nowMs - ts > maxAgeMs) {
            errors.push({
              path: `${candPath}.verified_at`,
              code: "STALE_VERIFIED_AT",
              message: `Candidate '${
                cand.model_id ?? "unknown"
              }' verified_at ('${cand.verified_at}') is older than ${
                maxAgeMs / (24 * 60 * 60 * 1000)
              } days`,
            });
          }
        }

        // source_url check
        if (!cand.source_url && !isMockCandidate) {
          errors.push({
            path: `${candPath}.source_url`,
            code: "NULL_VALUE",
            message: `Candidate '${
              cand.model_id ?? "unknown"
            }' has null source_url`,
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Startup validation guard (Rule R3).
 * Fails production boot if any enabled mode/provider has null, unverified,
 * unknown, unlicensed, or stale (>30 days) values.
 */
export function assertValidStartupRegistry(options?: {
  registryPath?: string;
  snapshotPath?: string;
  nodeEnv?: string;
  allowMockInDev?: boolean;
}): RegistryConfig {
  const env = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const isProd = env === "production";
  const allowMock =
    !isProd &&
    (options?.allowMockInDev === true ||
      process.env.ALLOW_MOCK_REGISTRY === "true");

  const registry = loadRegistryConfig(options?.registryPath);
  const snapshot = loadModelsSnapshot(options?.snapshotPath);
  const result = validateRegistry(registry, snapshot, { allowMock });

  if (!result.valid) {
    const formatted = result.errors
      .map((e) => `  - [${e.code}] ${e.path}: ${e.message}`)
      .join("\n");
    if (isProd) {
      throw new Error(
        `Production boot blocked by registry validation (${result.errors.length} issue(s)):\n${formatted}`
      );
    } else {
      console.warn(
        `[RegistryValidator] Non-production warning (${result.errors.length} unverified/blocked item(s) in registry):\n${formatted}`
      );
    }
  }

  return registry;
}
