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

## Carried Over from Phase 0 (Pending Later Phases / Owner Confirmation)
- **Plan Pricing & Credit Grants (`server/configs/dodo.ts` vs. `config/registry.json`):** `config/registry.json` uses Starter=\$6/25cr, Creator=\$29/200cr, Pro=\$59/400cr; `server/configs/dodo.ts` still has Starter=\$9/25cr and Pro=\$59/800cr (to be unified in Phase 3 / Phase 6).
- **Platform Official Aspect Ratios & Pixel Dimensions (Section 10):** `server/configs/platformConfig.ts` and `client/src/assets/assets.ts` preset dimensions to be verified before Phase 6 UI lock-in.
- **UI Marketing Claims & Testimonials (Rule R2 & Section 10 — Phase 6):** `client/src/data/testimonial.ts`, `HeroSection.tsx`, `MarketComparison.tsx`.
