/**
 * scripts/verify-providers.ts
 *
 * Phase 2 live verification script: executes 1 test call per candidate model
 * (or uses MockAdapter when MOCK_PROVIDERS=true) and records latency_ms,
 * billed_cost_usd, request_params, and actual pixel resolution (width x height).
 *
 * Rule R9: Never logs or prints secret values from .env.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  getProviderAdapter,
  ProviderError,
  type GenerateInput,
  type ProviderName,
} from "../providers/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

interface ProbeTarget {
  label: string;
  provider: ProviderName;
  model_id: string;
  input: GenerateInput;
}

const TARGETS: ProbeTarget[] = [
  {
    label: "Fast (xAI direct) — grok-imagine-image @ 2K",
    provider: "xai",
    model_id: "grok-imagine-image",
    input: {
      mode: "fast",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'FAST'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Fast (xAI direct) — grok-imagine-image-2.0 @ 2K",
    provider: "xai",
    model_id: "grok-imagine-image-2.0",
    input: {
      mode: "fast",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'FAST'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Fast (OpenRouter) — bytedance-seed/seedream-5-0-flash @ 2K",
    provider: "openrouter",
    model_id: "bytedance-seed/seedream-5-0-flash",
    input: {
      mode: "fast",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'FAST'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Standard (OpenRouter) — bytedance-seed/seedream-5-0-pro @ 2K",
    provider: "openrouter",
    model_id: "bytedance-seed/seedream-5-0-pro",
    input: {
      mode: "standard",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'STANDARD'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Standard (OpenRouter) — x-ai/grok-imagine-image-2.0 @ 2K",
    provider: "openrouter",
    model_id: "x-ai/grok-imagine-image-2.0",
    input: {
      mode: "standard",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'GROK'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Standard (OpenRouter) — bytedance-seed/seedream-5-0-lite @ 2K",
    provider: "openrouter",
    model_id: "bytedance-seed/seedream-5-0-lite",
    input: {
      mode: "standard",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'LITE 2K'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Premium (OpenRouter) — google/gemini-nano-banana-2.1 @ 2K",
    provider: "openrouter",
    model_id: "google/gemini-nano-banana-2.1",
    input: {
      mode: "premium",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'NANO 2K'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Premium (OpenRouter) — google/gemini-3.1-flash-image @ 2K",
    provider: "openrouter",
    model_id: "google/gemini-3.1-flash-image",
    input: {
      mode: "premium",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'FLASH 2K'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Premium (OpenRouter) — openai/gpt-image-2 @ 2K (medium quality)",
    provider: "openrouter",
    model_id: "openai/gpt-image-2",
    input: {
      mode: "premium",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'GPT 2'",
      aspectRatio: "16:9",
      resolution: "2K",
      timeoutMs: 60_000,
    },
  },
  {
    label: "Ultra (OpenRouter) — google/gemini-3-pro-image @ 4K",
    provider: "openrouter",
    model_id: "google/gemini-3-pro-image",
    input: {
      mode: "ultra",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'PRO 4K'",
      aspectRatio: "16:9",
      resolution: "4K",
      timeoutMs: 90_000,
    },
  },
  {
    label: "Ultra (OpenRouter) — google/gemini-nano-banana-2.1 @ 4K",
    provider: "openrouter",
    model_id: "google/gemini-nano-banana-2.1",
    input: {
      mode: "ultra",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'NANO 4K'",
      aspectRatio: "16:9",
      resolution: "4K",
      timeoutMs: 90_000,
    },
  },
  {
    label: "Ultra (OpenRouter) — bytedance-seed/seedream-5-0-lite @ 4K",
    provider: "openrouter",
    model_id: "bytedance-seed/seedream-5-0-lite",
    input: {
      mode: "ultra",
      prompt: "A minimal neon geometric cube on dark background, studio lighting, bold text 'LITE 4K'",
      aspectRatio: "16:9",
      resolution: "4K",
      timeoutMs: 90_000,
    },
  },
];

async function main() {
  const useMock = process.env.MOCK_PROVIDERS === "true";
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const filterStr = onlyArg ? onlyArg.slice("--only=".length).toLowerCase() : "";

  console.log(
    `[verify-providers] Starting Phase 2 provider verification (mock=${useMock}${
      filterStr ? `, filter=${filterStr}` : ""
    })...`
  );

  const results: Array<Record<string, unknown>> = [];

  for (const target of TARGETS) {
    if (
      filterStr &&
      !target.label.toLowerCase().includes(filterStr) &&
      !target.model_id.toLowerCase().includes(filterStr) &&
      !target.provider.toLowerCase().includes(filterStr)
    ) {
      continue;
    }
    const providerName: ProviderName = useMock ? "mock" : target.provider;
    const adapter = getProviderAdapter(providerName);
    console.log(`\n-> Probing: ${target.label}`);
    try {
      const out = await adapter.generateWithCandidate(
        target.model_id,
        target.input
      );
      const summary = {
        label: target.label,
        provider: out.meta.provider,
        model_id: out.meta.model_id,
        status: "OK",
        latency_ms: out.meta.latency_ms,
        billed_cost_usd: out.meta.billed_cost_usd,
        resolution_actual: out.meta.resolution_actual,
        bytes: out.assetBytes.length,
        request_params: out.meta.request_params,
      };
      console.log(`   [OK] latency=${summary.latency_ms}ms cost=$${summary.billed_cost_usd ?? "null"} dims=${summary.resolution_actual.dimensions} (${summary.resolution_actual.tier}) bytes=${summary.bytes}`);
      results.push(summary);
    } catch (err: any) {
      if (err instanceof ProviderError) {
        const summary = {
          label: target.label,
          provider: target.provider,
          model_id: target.model_id,
          status: "ERROR",
          code: err.code,
          http_status: err.status ?? null,
          retryable: err.retryable,
          isPolicyRejection: err.isPolicyRejection,
          message: err.message,
        };
        console.log(
          `   [ERROR] code=${err.code} http=${err.status ?? "n/a"} retryable=${err.retryable} msg=${err.message}`
        );
        results.push(summary);
      } else {
        console.log(`   [ERROR] unexpected: ${err?.message || String(err)}`);
        results.push({
          label: target.label,
          provider: target.provider,
          model_id: target.model_id,
          status: "ERROR",
          message: err?.message || String(err),
        });
      }
    }
  }

  console.log("\n=== Phase 2 Provider Verification Summary (JSON) ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("[verify-providers] Fatal error:", err);
  process.exit(1);
});

