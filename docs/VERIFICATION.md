# Verification & Unverified Items Log (`docs/VERIFICATION.md`)

> Maintained per Rules R3, R4, and Section 14 of `PLAN.md`. Every item that could not be verified from code or live official responses in the current session is recorded here for verification or owner sign-off.

---

## Phase 2 — Provider Adapter Live Verification Update (2026-11-11)

### 1. Live Provider Call Verification (`node scripts/verify-providers.mjs`)
Executed real API generation calls across `xai` and `openrouter` adapters on `2026-11-11T15:53:31Z`–`15:57:05Z`, measuring `latency_ms`, `billed_cost_usd` (`usage.cost`), and actual pixel dimensions via Sharp (`inspectImageResolution`):

| Mode | Provider | Model ID | Requested Res | Status | Latency (`ms`) | Billed Cost (`USD`) | Actual Pixel Dimensions (`width x height`) | Verified Tier | Margin % (vs Creator `$0.145/cr`) |
|---|---|---|---|---|---:|---:|---|---|---:|
| `fast` (1 cr) | `xai` | `grok-imagine-image` | `2K` (`2k`) | **OK** | `9,599` | `null` *(not in xAI body)* | `2816x1584` | **`2K`** | *pending xAI dashboard price* |
| `fast` (1 cr) | `xai` | `grok-imagine-image-2.0` | `2K` (`2k`) | **HTTP 404** | — | — | — | — | Not accessible on direct xAI team |
| `fast` (1 cr) | `openrouter` | `bytedance-seed/seedream-5-0-flash` | `2K` | **OK** | `13,082` | **`$0.018000`** | `2048x1152` | **`2K`** | **12.41%** (PASS ≤35%) |
| `standard` (2 cr) | `openrouter` | `bytedance-seed/seedream-5-0-pro` | `2K` | **OK** | `58,691` | **`$0.045000`** *(cap `$0.09`)* | `2048x1152` | **`2K`** | **15.52%–31.03%** (PASS ≤35%) |
| `standard` (2 cr) | `openrouter` | `x-ai/grok-imagine-image-2.0` | `2K` | **TIMEOUT** | `>60,000` | `$0.080000` *(endpoint)* | — | — | **27.59%** (PASS ≤35%) |
| `standard` (2 cr) | `openrouter` | `bytedance-seed/seedream-5-0-lite` | `2K` | **OK** | `22,856` | **`$0.035000`** | `2560x1440` | **`2K`** | **12.07%** (PASS ≤35%) |
| `premium` (3 cr) | `openrouter` | `google/gemini-3.1-flash-image` | `2K` | **OK** | `20,938` | **`$0.100810`** (`$0.101`) | `2752x1536` | **`2K`** | **23.22%** (PASS ≤35%) |
| `premium` (3 cr) | `openrouter` | `google/gemini-nano-banana-2.1` | `2K` | **OK** | `30,149` | **`$0.053748`** (`$0.054`) | `2752x1536` | **`2K`** | **12.41%** (PASS ≤35%) |
| `premium` (3 cr) | `openrouter` | `openai/gpt-image-2` | `2K` (`medium`) | **OK** | `19,796` | **`$0.032465`** (`$0.033`) | `1536x864` | **`1K`** *(max 1536px)* | **7.59%** (PASS ≤35%) |
| `ultra` (5 cr) | `openrouter` | `google/gemini-3-pro-image` | `4K` | **HTTP 402** | — | `null` | — | — | *OpenRouter credit hold exceeded* |
| `ultra` (5 cr) | `openrouter` | `google/gemini-nano-banana-2.1` | `4K` | **OK** | `30,942` | **`$0.115473`** (`$0.116`) | **`5504x3072`** | **`4K`** | **16.00%** (PASS ≤35%) |
| `ultra` (5 cr) | `openrouter` | `bytedance-seed/seedream-5-0-lite` | `4K` | **OK** | `33,204` | **`$0.035000`** | **`4096x2304`** | **`4K`** | **4.83%** (PASS ≤35%) |

### 2. Remaining Unverified Items (`null` in `config/registry.json` with `TODO(verify)`)
1. **Direct xAI (`api.x.ai`) Per-Image USD Cost (`modes.fast.candidates[0].est_cost_usd`):**
   - `POST https://api.x.ai/v1/images/generations` with `model: "grok-imagine-image"` and `resolution: "2k"` is **verified working** (`2816x1584` PNG returned in `9,599ms`).
   - However, xAI's response payload does not include a `usage.cost` field, and `GET https://api.x.ai/v1/models` returned `HTTP 403 permission-denied`.
   - Action needed: Confirm the exact per-image USD price for `grok-imagine-image` at `2k` on `console.x.ai` (must be `<= $0.0507` to pass the 1-credit `fast` mode 35% margin guard; otherwise `bytedance-seed/seedream-5-0-flash` at `$0.018` serves as the verified primary).
2. **`google/gemini-3-pro-image` Live 4K Cost (`modes.ultra.candidates[0].est_cost_usd`):**
   - Live call to `google/gemini-3-pro-image` returned `HTTP 402` (`weight_exceeds_budget` on the current OpenRouter credit balance because OpenRouter pre-authorizes a high max-token hold for `gemini-3-pro-image`).
   - Meanwhile, both `google/gemini-nano-banana-2.1` (`$0.116`, **`5504x3072` 4K**) and `bytedance-seed/seedream-5-0-lite` (`$0.035`, **`4096x2304` 4K**) are **verified working in true 4K** and pass the 35% margin guard (`16.00%` and `4.83%`).
3. **Commercial License Check for `black-forest-labs/flux-3-image-klein` (`modes.fast.candidates[2].license_checked`):**
   - Kept `false` (Pitfall P7) until owner confirms commercial license terms.
4. **Provider Concurrency Limits (`providers.openrouter.max_concurrency`, `providers.xai.max_concurrency` — Pitfall P6):**
   - Currently `null` in `config/registry.json` until verified from account dashboards (default conservative limiter will be applied in Phase 4).

---

## Phase 1 — Discovery & Registry Summary (2026-11-11)
- Queried `GET https://openrouter.ai/api/v1/images/models`, `GET https://openrouter.ai/api/v1/models?output_modalities=image`, and `GET https://openrouter.ai/api/v1/images/models/{model}/endpoints`.
- Discovered **68 OpenRouter image models** + verified **1 direct xAI image model (`grok-imagine-image`)** in `config/models.snapshot.json`.

---

## Carried Over from Phase 0 (Resolved in Phases 3, 5, and 6)
- **Plan Pricing & Credit Grants (`server/configs/dodo.ts` vs. `config/registry.json`):** **Resolved in Phase 3 & Phase 6** — `server/configs/dodo.ts` and `GET /api/config/public` derive `PLANS` (`starter`: \$6/25cr, `creator`: \$29/200cr, `pro`: \$59/400cr) directly from `config/registry.json`, and `client/src/data/pricing.ts`, `PricingSection.tsx`, and `Profile.tsx` display accurate thumbnail range claims (`12–25`, `40–200`, `80–400` thumbnails).
- **UI Marketing Claims & Testimonials (Rule R2 & Section 10 — Phase 6):** **Resolved in Phase 6** — Removed all fabricated testimonials, stock Unsplash avatars, unverified `"50+ creators"` / `"thousands of creators"` / `"Trusted by MrBeast, PewDiePie..."` claims, false `"No Credit Card Required"` / `"Generate Free Thumbnail"` claims, and unverified competitor price claims across `client/src/data/testimonial.ts`, `TestimonialSection.tsx`, `HeroSection.tsx`, `FeaturesSection.tsx`, `CTASection.tsx`, and `MarketComparison.tsx`.

---

## Phase 5 & Phase 6 — Post-Processing, Storage, and UI/UX Redesign Verification (2026-11-11)

1. **Post-Processing & Watermark Isolation (`server/services/postProcessService.ts`, `server/tests/postprocess.test.ts`):**
   - Verified `processAndStoreAssets` generates three distinct variants with independent 128-bit cryptographic random keys (`orig_<32-hex>`, `wm_<32-hex>`, `prev_<32-hex>`):
     - `original_url` (full-resolution WebP master)
     - `watermarked_url` (diagonal + corner SVG watermark composited via Sharp)
     - `preview_webp_url` (`<= 640px` wide WebP for fast gallery browsing)
   - Verified `sanitizeJobAssetsForPlan` and `sanitizeThumbnailForPlan` strip `original_url` for `starter` users and automatically unlock `original_url` when a user upgrades to `creator` or `pro`.
2. **UI/UX Skills Installed & Applied (`.agents/skills/`):**
   - Cloned and installed `pbakaus/impeccable`, `Leonxlnx/taste-skill`, `nextlevelbuilder/ui-ux-pro-max-skill`, and `emilkowalski/skills` into `.agents/skills/`.
   - Redesigned the landing page (`HeroSection.tsx`, `PlatformMarqueeSection.tsx`, `FeaturesSection.tsx`, `TestimonialSection.tsx`, `PricingSection.tsx`, `ShowcaseSection.tsx`, `CTASection.tsx`, `MarketComparison.tsx`) and Studio (`Generate.tsx`, `ResolutionSelector.tsx`, `PreviewPanel.tsx`, `MyGeneration.tsx`, `Navbar.tsx`, `Footer.tsx`, `SectionTitle.tsx`, `globals.css`) to eliminate AI-slop patterns and enforce Operate/Persuade craft rules.
3. **Automated Test & Build Verification:**
   - `npm --prefix server test` -> **38/38 tests passing** (`0` failures).
   - `.\server\node_modules\.bin\tsc -p server/tsconfig.json --noEmit` -> **exit code 0**.
   - `.\server\node_modules\.bin\tsc -p client/tsconfig.app.json --noEmit` -> **exit code 0**.
   - `npm --prefix client run build` -> **built in 23.54s with 0 errors**.

---

## Phase 7 & Phase 8 — Observability, Server-Side Typography, Smart-Crop, Provenance, and Hardening (2026-11-11)

1. **Structured Observability, Metrics & Alert Rules (`server/models/GenerationLog.ts`, `server/services/observabilityService.ts`, `server/server.ts`, `server/workers/thumbnailWorker.ts`):**
   - Added `generation_log` Mongoose schema (`GenerationLog.ts`) and `ObservabilityManager` (`observabilityService.ts`).
   - Enforced Rule R9 secret & base64 redaction via `sanitizeLogPayload` (redacts `api_key`, `OPENROUTER_API_KEY`, `XAI_API_KEY`, `Bearer ...`, `sk-or-...`, `data:image/...`, and raw base64 payloads `> 512` chars).
   - Added `GET /metrics` (Prometheus text exposition format) and `GET /api/metrics/summary` (JSON snapshot + alert evaluation).
   - Configured and verified the 5 alert rules:
     1. `provider_error_rate_high`: `provider_error_rate > 5%` (`0.05`) over `>= 5` jobs
     2. `queue_wait_p95_high`: `queue_wait_p95_seconds > 30s`
     3. `daily_provider_spend_exceeded`: `daily_provider_spend_usd >= daily_spend_cap_usd` (also trips the automatic kill switch returning `503 SPEND_CAP_REACHED`)
     4. `credit_refund_rate_high`: `credit_refund_rate > 10%` (`0.10`) over `>= 5` jobs
     5. `circuit_breaker_open`: `circuit_breaker_open === 1`
2. **Abuse Protection & Rate Limiting (`server/controllers/ThumbnailController.ts`, `server/services/observabilityService.ts`):**
   - Added `SlidingWindowRateLimiter` (`20 requests / 60s` per user) returning `429 RATE_LIMITED` with `Retry-After` header before credit reservation or provider calls.
   - Added `defaultObservability.assertSpendBelowCap()` check on `generateThumbnail` and `editThumbnail` returning `503 SPEND_CAP_REACHED` when daily spend hits `DAILY_SPEND_CAP_USD`.
3. **Server-Side Text Overlay, Smart-Crop, and Provenance Metadata (`server/services/postProcessService.ts`):**
   - `applyServerTextOverlay`: renders crisp SVG typography via Sharp, rejects `BANNED_TEXT_EFFECTS` (`gold_3d_bevel`, `neon_gradient_glow`, `sparkle_overlay`, etc.), relocates text away from `faceRegions`, measures WCAG 2.1 contrast ratio against sampled background pixels, and automatically applies a dark scrim (`rgba(10,10,12,0.82)`) + stroke when initial contrast `< 4.5:1` to guarantee final contrast `>= 4.5:1`.
   - `smartCropFromMaster`: derives `1:1`, `9:16`, and `4:5` crops from a `16:9` master using `sharp.strategy.attention`.
   - **Provenance Metadata Behavior Report (Section 10A.9 & Pitfall P13):**
     - Verified via `inspectProvenanceMetadata(buffer)`: Sharp's `.webp({ quality: 92 })` re-encoding pipeline strips container-level EXIF, XMP, IPTC, and C2PA JUMBF metadata boxes by default (`survivesPostProcessing: false`) unless `.withMetadata()` is explicitly called.
     - Imperceptible pixel-domain watermarks (such as Google SynthID on Gemini image models) reside in spatial frequency bands rather than container headers, and may be partially degraded by lossy WebP compression (`quality: 92`) and Starter visible watermark compositing. Per Section 10A.9, ThumbGen.ai never advertises metadata stripping or "undetectable AI" claims.
4. **Appendix B Benchmark & Load Tests (`server/scripts/benchmark-models.ts`, `docs/BENCHMARK.md`, `server/tests/observability-hardening.test.ts`):**
   - Executed 50-prompt benchmark across 4 categories (`text_heavy_titles`: 13, `face_reference_edits`: 12, `product_shots`: 13, `plain_minimal_backgrounds`: 12) and wrote `server/config/benchmark.results.json` and `docs/BENCHMARK.md`.
   - Executed Section 13(a) 50-parallel-request concurrent spend race test (`balance = 5`, `mode = ultra` at `5 credits` -> `1` succeeded, `49` failed with `402 INSUFFICIENT_CREDITS`, final balance `0`).
   - Executed 100-concurrent-job load test (`2,489 ms` total wall time, `0` failed jobs, Prometheus metrics verified).
   - Full server test suite: **`44/44` passing (`0` failures)**.
