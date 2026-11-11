<p align="center">
  <img src="client/src/assets/logo.png" alt="ThumbGen.ai Logo" width="260"/>
</p>

<h1 align="center">ThumbGen.ai</h1>

<p align="center">
  <strong>Multi-Provider AI Thumbnail Studio with Atomic Credit Ledger, Resilient Fallbacks, and Config-Driven Margin Guard</strong>
</p>

---

## Architecture Overview

ThumbGen.ai is a full-stack TypeScript application (`client/` React 19 + Vite + Tailwind CSS v4, `server/` Express 5 + BullMQ + MongoDB + Redis + Sharp) built around the verified architecture in [`docs/PLAN.md`](docs/PLAN.md):

1. **Single Source of Truth Registry (`server/config/registry.json` & `server/configs/registryValidator.ts`):**
   - Defines plans (`starter`, `creator`, `pro`), modes (`fast`, `standard`, `premium`, `ultra`), credit weights, resolution caps (`1K`, `2K`, `4K`), and ordered model fallback chains.
   - Startup validator rejects `null` values, unknown model IDs not present in `server/config/models.snapshot.json`, unverified licenses (`license_checked: false`), stale `verified_at` timestamps (`> 30 days`), and 4K routing to non-4K models.
   - `server/scripts/margin-guard.ts` enforces that worst-case provider cost (including `1.10x` retry factor) never exceeds `35%` of the lowest plan credit value (`$0.145/credit` on Creator).

2. **Multi-Provider Adapter Layer (`server/providers/`):**
   - **`openrouter` (`server/providers/openrouter.ts`):** Primary aggregator supporting Flux.2 (`klein-4b`, `flex`, `pro`, `max`), Gemini (`2.5-flash-image`, `3.1-flash-image-preview`, `3-pro-image-preview`), and ByteDance Seedream 4.5. Extracts `usage.cost` (`billed_cost_usd`) from every response.
   - **`xai` (`server/providers/xai.ts`):** Direct xAI Grok adapter (`grok-imagine-image`, `grok-imagine-image-pro`) for vendor diversity and fast fallback.
   - **`mock` (`server/providers/mock.ts`):** Deterministic local adapter for unit, contract, chaos, and load tests (`MOCK_PROVIDERS=true`).

3. **Atomic Credits & Idempotent Job State Machine (`server/services/creditService.ts`):**
   - Append-only `credit_ledger` (`grant`, `reserve`, `commit`, `refund`, `adjust`) with integer-only arithmetic.
   - `Idempotency-Key` support on job creation and payment webhooks.
   - Automatic partial refund when a fallback candidate costs fewer credits than reserved, and 100% automatic refund on terminal failure or orphaned worker recovery (`sweepOrphanedJobs`).

4. **Resilience, Post-Processing & Observability (`server/services/`):**
   - Per-provider concurrency semaphores, per-model circuit breakers (trips for `60s` on `5` consecutive failures or `>50%` failure rate over `20` calls), per-user active job caps, and queue depth hysteresis (`>200` / `>400`).
   - Cryptographically independent Cloudinary storage keys (`orig_<hex>`, `wm_<hex>`, `prev_<hex>`) so Starter users never receive or guess `original_url`, while upgrading to Creator/Pro immediately unlocks unwatermarked originals.
   - Server-side Sharp SVG text overlay (`applyServerTextOverlay`) with WCAG 2.1 `>= 4.5:1` contrast verification and automatic dark scrim, attention-based smart-crop (`smartCropFromMaster`), Prometheus `/metrics`, alert rules, sliding-window rate limiter, and daily spend kill switch (`DAILY_SPEND_CAP_USD`).

---

## Key Scripts & Verification Commands

### Server (`server/`)
```bash
# Discover live models from OpenRouter & xAI into server/config/models.snapshot.json
npm --prefix server run discover:models

# Validate server/config/registry.json against schema + snapshot
npm --prefix server run validate:registry

# Verify <= 35% cost-to-revenue margin guard across all modes & plans
npm --prefix server run check:margin

# Run live provider probe across enabled models (requires OPENROUTER_API_KEY & XAI_API_KEY)
npm --prefix server run verify:providers

# Run 50-prompt Appendix B benchmark harness
npx --prefix server tsx server/scripts/benchmark-models.ts

# Run full unit, contract, chaos, post-processing, and 50-parallel-request load test suite (44 tests)
npm --prefix server test
```

### Client (`client/`)
```bash
# Type-check and build production bundle
npm --prefix client run build
```

---

## Documentation Index

- [`docs/PLAN.md`](docs/PLAN.md) — Master engineering & product specification
- [`docs/AUDIT.md`](docs/AUDIT.md) — Phase 0 codebase audit with file-level citations
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — Live provider verification log, provenance metadata report, and remaining owner sign-offs
- [`docs/BENCHMARK.md`](docs/BENCHMARK.md) — Appendix B live provider & 50-prompt benchmark report
