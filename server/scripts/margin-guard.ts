/**
 * scripts/margin-guard.ts
 *
 * Enforces Section 6 Margin Guard:
 *   For every mode, estimated_cost_usd / (credits * lowest_plan_credit_value) <= 0.35.
 *   The lowest value per credit is Creator at $0.145 ($29 / 200 credits).
 *   If a verified price breaks this, the script fails and prints which mode to re-weight.
 *   Never silently adjusts credit costs.
 */

import { fileURLToPath } from "url";
import {
  loadRegistryConfig,
  computeLowestPlanCreditValue,
  type RegistryConfig,
  type ModeId,
} from "../configs/registryValidator.js";

export interface MarginCheckRow {
  modeId: ModeId;
  modeLabel: string;
  credits: number;
  provider: string;
  modelId: string | null;
  estCostUsd: number | null;
  revenueUsd: number;
  maxAllowedCostUsd: number;
  ratio: number | null;
  status: "PASS" | "FAIL" | "UNVERIFIED";
  minCreditsRequired?: number;
}

export interface MarginGuardReport {
  passed: boolean;
  lowestPlanId: string;
  lowestCreditValueUsd: number;
  maxRatio: number;
  rows: MarginCheckRow[];
  failedModes: string[];
  unverifiedCount: number;
}

export function evaluateMarginGuard(
  registry: RegistryConfig,
  options?: {
    failOnUnverified?: boolean;
    retryRate?: number;
    qaCostUsd?: number;
  }
): MarginGuardReport {
  const maxRatio = registry.margin_guard?.max_cost_to_revenue_ratio ?? 0.35;
  const retryRate = Math.max(0, options?.retryRate ?? 0);
  const qaCostUsd = Math.max(0, options?.qaCostUsd ?? 0);
  const { planId: lowestPlanId, valuePerCreditUsd } =
    computeLowestPlanCreditValue(registry.plans);

  const rows: MarginCheckRow[] = [];
  const failedModesSet = new Set<string>();
  let unverifiedCount = 0;

  for (const [modeId, mode] of Object.entries(registry.modes) as [
    ModeId,
    RegistryConfig["modes"][ModeId]
  ][]) {
    if (!mode.enabled) continue;

    const revenueUsd = mode.credits * valuePerCreditUsd;
    const maxAllowedCostUsd = revenueUsd * maxRatio;

    for (const cand of mode.candidates) {
      if (cand.est_cost_usd === null || typeof cand.est_cost_usd !== "number") {
        unverifiedCount++;
        rows.push({
          modeId,
          modeLabel: mode.label,
          credits: mode.credits,
          provider: cand.provider,
          modelId: cand.model_id,
          estCostUsd: null,
          revenueUsd,
          maxAllowedCostUsd,
          ratio: null,
          status: "UNVERIFIED",
        });
        continue;
      }

      const effectiveCostUsd =
        cand.est_cost_usd * (1 + retryRate) + qaCostUsd;
      const ratio = effectiveCostUsd / revenueUsd;
      const passed = ratio <= maxRatio + 1e-12;
      const minCreditsRequired = Math.ceil(
        effectiveCostUsd / (valuePerCreditUsd * maxRatio)
      );

      if (!passed) {
        failedModesSet.add(modeId);
      }

      rows.push({
        modeId,
        modeLabel: mode.label,
        credits: mode.credits,
        provider: cand.provider,
        modelId: cand.model_id,
        estCostUsd: Number(effectiveCostUsd.toFixed(6)),
        revenueUsd,
        maxAllowedCostUsd,
        ratio,
        status: passed ? "PASS" : "FAIL",
        ...(!passed ? { minCreditsRequired } : {}),
      });
    }
  }

  const failedModes = Array.from(failedModesSet);
  const passed =
    failedModes.length === 0 &&
    (!options?.failOnUnverified || unverifiedCount === 0);

  return {
    passed,
    lowestPlanId,
    lowestCreditValueUsd: valuePerCreditUsd,
    maxRatio,
    rows,
    failedModes,
    unverifiedCount,
  };
}

function main() {
  const failOnUnverified = process.argv.includes("--strict");
  const registry = loadRegistryConfig();
  const report = evaluateMarginGuard(registry, { failOnUnverified });

  console.log(
    `=== Margin Guard Report (lowest credit value: ${
      report.lowestPlanId
    } @ $${report.lowestCreditValueUsd.toFixed(4)}/credit, max ratio: ${(
      report.maxRatio * 100
    ).toFixed(0)}%) ===`
  );

  for (const row of report.rows) {
    const modelLabel = `${row.provider}/${row.modelId ?? "null"}`;
    if (row.status === "UNVERIFIED") {
      console.log(
        `  [UNVERIFIED] mode=${row.modeId} (${row.credits} cr, rev=$${row.revenueUsd.toFixed(
          3
        )}, cap=$${row.maxAllowedCostUsd.toFixed(4)}) | ${modelLabel} -> est_cost_usd=null`
      );
    } else {
      const pct = ((row.ratio ?? 0) * 100).toFixed(2);
      console.log(
        `  [${row.status}]       mode=${row.modeId} (${row.credits} cr, rev=$${row.revenueUsd.toFixed(
          3
        )}, cap=$${row.maxAllowedCostUsd.toFixed(4)}) | ${modelLabel} -> $${row.estCostUsd!.toFixed(
          4
        )} (${pct}%)`
      );
      if (row.status === "FAIL") {
        console.error(
          `    >>> ACTION REQUIRED: Re-weight mode '${row.modeId}' (needs >= ${row.minCreditsRequired} credits for ${modelLabel} at $${row.estCostUsd}) or replace candidate.`
        );
      }
    }
  }

  if (report.failedModes.length > 0) {
    console.error(
      `\nMargin Guard FAILED. Modes exceeding ${(report.maxRatio * 100).toFixed(
        0
      )}% cost-to-revenue: ${report.failedModes.join(", ")}`
    );
    process.exit(1);
  }

  if (failOnUnverified && report.unverifiedCount > 0) {
    console.error(
      `\nMargin Guard FAILED (--strict): ${report.unverifiedCount} candidate(s) have unverified (null) est_cost_usd.`
    );
    process.exit(1);
  }

  console.log(
    `\nMargin Guard PASSED for all verified candidates (${
      report.rows.length - report.unverifiedCount
    } verified, ${report.unverifiedCount} pending verification).`
  );
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() ===
    process.argv[1].toLowerCase();

if (isMain) {
  main();
}

