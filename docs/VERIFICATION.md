# Verification & Unverified Items Log (`docs/VERIFICATION.md`)

> Maintained per Rules R3, R4, and Section 14 of `PLAN.md`. Every item that could not be verified from code or live official responses in the current session is recorded here for verification or owner sign-off.

---

## Phase 1 — Discovery & Registry Update (2026-11-11)

### 1. Newly Verified in Phase 1 (Live API Discovery)
- **OpenRouter Model Discovery (`config/models.snapshot.json`):**
  - Queried `GET https://openrouter.ai/api/v1/images/models`, `GET https://openrouter.ai/api/v1/models?output_modalities=image`, and `GET https://openrouter.ai/api/v1/images/models/{model}/endpoints` at `2026-11-11T15:21:51.189Z`.
  - Discovered **68 image models** with exact parameter schemas (`supported_parameters`, `supported_sizes`, `supported_aspect_ratios`, `max_reference_images`) and endpoint pricing.
- **Verified Flat Per-Image Prices & Parameters on OpenRouter (all pass ≤35% Margin Guard at Creator `$0.145/credit`):**
  - `bytedance-seed/seedream-5-0-flash`: `$0.018/image` (`unit: "image"`), supports `["1K", "2K"]`, up to 14 reference images. Margin in `fast` (1 credit = `$0.145`): **12.41%**.
  - `black-forest-labs/flux-3-image-klein`: `$0.008` (`768`), `$0.009` (`1K`), `$0.011` (`1.5K`), `$0.014` (`2K`), `$0.036` (`4K`) (`unit: "image"`), up to 10 reference images. Margin in `fast` at `2K`: **9.66%** (blocked in production by `license_checked: false` until owner confirms commercial license).
  - `bytedance-seed/seedream-5-0-pro`: `$0.045/image` (standard `1K`), `$0.09/image` (`variant: "high_resolution"` `2K`), `+$0.003` per input image, supports `["1K", "2K"]`, up to 14 reference images. Margin in `standard` (2 credits = `$0.29`): **31.03%**.
  - `x-ai/grok-imagine-image-2.0` (via OpenRouter `SpaceXAI` endpoint): `$0.04` (`low_1k`), `$0.06` (`low_2k`), `$0.06` (`medium_1k`), `$0.08` (`medium_2k`), `+$0.01` per input image, supports `["1K", "2K"]`, up to 3 reference images. Margin in `standard` (2 credits = `$0.29`) at `medium_2k`: **27.59%**. *(Note: at 1 credit in `fast`, `low_2k` `$0.06` is 41.38% which would exceed the 35% margin guard, whereas `low_1k` `$0.04` is 27.59%).*
  - `bytedance-seed/seedream-5-0-lite`: `$0.035/image` (`unit: "image"`), supports `["2K", "4K"]`, up to 14 reference images. Margin in `standard` (2 credits): **12.07%**; in `ultra` (5 credits): **4.83%**.

### 2. Remaining Unverified Items (`null` in `config/registry.json` with `TODO(verify)`)
1. **Direct xAI (`api.x.ai`) Model List & Pricing (`providers.xai`, `modes.fast.candidates[0]`):**
   - `GET https://api.x.ai/v1/image-generation-models` and `GET https://api.x.ai/v1/models` returned `HTTP 403 permission-denied` (`"Access to the models endpoint is denied. Please ensure you're using the correct credentials. If you believe this is a mistake, please log into console.x.ai and update the permissions, or contact support."`).
   - Action needed: Enable `models` read permission on the xAI API key in `console.x.ai` (or verify whether `xai` image generation works in Phase 2 and confirm the exact active xAI model ID and price). Until then, `modes.fast.candidates[0].model_id` and `est_cost_usd` remain `null`.
2. **Per-Image USD Cost for Token-Billed OpenRouter Models (Phase 2 Live `usage.cost` Verification):**
   - OpenRouter's `/endpoints` API reports token-based pricing (`unit: "token"`) rather than flat per-image pricing for:
     - `google/gemini-nano-banana-2.1` (`$0.00003` / output image token; supports `["1K", "2K", "4K"]`)
     - `google/gemini-3.1-flash-image` (`$0.00006` / output image token; supports `["512", "1K", "2K", "4K"]`)
     - `google/gemini-3-pro-image` (`$0.00012` / output image token, `$0.000002` / input image token; supports `["1K", "2K", "4K"]`)
     - `openai/gpt-image-2` (`$0.00003` / output image token, `$0.000008` / input image token, `$0.000005` / input text token; `quality: ["auto", "low", "medium", "high"]`)
   - Action needed: In Phase 2, execute one real call per enabled model at explicit `2K` / `4K` resolution, read `usage.cost` from the OpenRouter response, and verify actual output pixel dimensions (especially for `4K` per Section 6's 4K rule).
3. **Commercial License Check for `black-forest-labs/flux-3-image-klein` (`modes.fast.candidates[2].license_checked`):**
   - Currently set to `false` (Pitfall P7). Requires owner confirmation of commercial terms on OpenRouter before enabling in production.
4. **Provider Concurrency & Rate Limits (`providers.openrouter.max_concurrency`, `providers.xai.max_concurrency` — Pitfall P6):**
   - Currently `null` in `config/registry.json`. Requires checking account-level concurrency limits in the OpenRouter and xAI dashboards.

---

## Carried Over from Phase 0 (Pending Later Phases / Owner Confirmation)

### 3. Plan Pricing & Credit Grants Discrepancy (`server/configs/dodo.ts` vs. `config/registry.json`)
- `config/registry.json` uses the `PLAN.md` Section 2 table (`starter`: \$6 / 25 credits, `creator`: \$29 / 200 credits, `pro`: \$59 / 400 credits).
- `server/configs/dodo.ts#L15-L34` still has `starter`: \$9 / 25 credits and `pro`: \$59 / 800 credits (to be unified in Phase 3 / Phase 6 once owner confirms).

### 4. Platform Official Aspect Ratios & Pixel Dimensions (Section 10)
- `server/configs/platformConfig.ts#L8-L79` and `client/src/assets/assets.ts#L30-L41` preset dimensions to be verified before Phase 6 UI lock-in.

### 5. UI Marketing Claims & Testimonials (Rule R2 & Section 10 — Phase 6)
- `client/src/data/testimonial.ts#L3-L32` (4 unverified testimonials with stock avatars).
- `client/src/sections/HeroSection.tsx#L153-L154` (`"Start With 25 Credits"`, `"No Credit Card Required"`).
- `client/src/pages/MarketComparison.tsx#L16-L20` (`"Starts at $9.00"`, `"Forces Watermark: No"`, competitor prices).
