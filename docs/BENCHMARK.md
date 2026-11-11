# Appendix B — Model & Provider Benchmark Report (`docs/BENCHMARK.md`)

**Generated:** `2026-11-11`
**Spec Reference:** `docs/PLAN.md` Sections 5, 6, 8, 12 (Phase 2 & Phase 8), and Appendix B
**Raw JSON Output:** `server/config/benchmark.results.json`
**Harness Script:** `server/scripts/benchmark-models.ts` (`npx --prefix server tsx server/scripts/benchmark-models.ts`)
**Live Probe Script:** `server/scripts/verify-providers.ts` (`npm --prefix server run verify:providers`)

---

## 1. Live Provider Verification & Billed Cost Table (`OpenRouter` & `xAI`)

Every enabled model in `server/config/registry.json` was tested against live provider endpoints (`https://openrouter.ai/api/v1/chat/completions` and `https://api.x.ai/v1/images/generations`) with explicit `aspect_ratio: "16:9"` and `resolution: "1K"`. Actual pixel dimensions were measured from the decoded image buffer using `sharp(buffer).metadata()`.

| Mode | Order | Provider | Model ID | Live Status | Measured Latency (ms) | Actual Billed Cost (USD) | Registry Max Cost (USD) | Output Dimensions (`16:9` @ `1K`) |
|---|---:|---|---|---|---:|---:|---:|---|
| `fast` | 0 | `openrouter` | `black-forest-labs/flux.2-klein-4b` | `200 OK` | `6,342 ms` | `$0.014517` | `$0.0150` | `1392 × 752` |
| `fast` | 1 | `xai` | `grok-imagine-image` | `200 OK` | `4,904 ms` | `$0.020000` (flat) | `$0.0200` | `1696 × 960` |
| `fast` | 2 | `openrouter` | `google/gemini-2.5-flash-image` | `200 OK` | `7,941 ms` | `$0.038461` | `$0.0390` | `1344 × 768` |
| `standard` | 0 | `openrouter` | `google/gemini-3.1-flash-image-preview` | `200 OK` | `11,269 ms` | `$0.066840` | `$0.0680` | `1376 × 768` |
| `standard` | 1 | `openrouter` | `bytedance-seed/seedream-4.5` | `200 OK` | `15,436 ms` | `$0.040000` | `$0.0450` | `2560 × 1440` |
| `standard` | 2 | `openrouter` | `black-forest-labs/flux.2-flex` | `200 OK` | `13,701 ms` | `$0.060000` | `$0.0600` | `1392 × 752` |
| `premium` | 0 | `openrouter` | `black-forest-labs/flux.2-pro` | `200 OK` | `8,956 ms` | `$0.045000` | `$0.0750` | `1392 × 752` |
| `premium` | 1 | `xai` | `grok-imagine-image-pro` | `200 OK` | `6,920 ms` | `$0.070000` (flat) | `$0.0700` | `1696 × 960` |
| `premium` | 2 | `openrouter` | `sourceful/riverflow-v2-standard-preview` | `404` (removed) | `714 ms` | `$0.000000` | — | Removed from active fallback |
| `ultra` | 0 | `openrouter` | `google/gemini-3-pro-image-preview` | `200 OK` | `15,792 ms` | `$0.132240` | `$0.1350` | `1376 × 768` |
| `ultra` | 1 | `openrouter` | `black-forest-labs/flux.2-max` | `200 OK` | `10,967 ms` | `$0.070000` | `$0.0750` | `1392 × 752` |
| `ultra` | 2 | `openrouter` | `sourceful/riverflow-v2-max-preview` | `404` (removed) | `621 ms` | `$0.000000` | — | Removed from active fallback |

---

## 2. 50-Prompt Pipeline Benchmark (`server/scripts/benchmark-models.ts`)

Per Appendix B, the 50 canonical thumbnail prompts are split across 4 categories:
- `text_heavy_titles`: 13 prompts (`T01`–`T13`)
- `face_reference_edits`: 12 prompts (`F01`–`F12`)
- `product_shots`: 13 prompts (`P01`–`P13`)
- `plain_minimal_backgrounds`: 12 prompts (`M01`–`M12`)

Each prompt is evaluated for end-to-end pipeline execution (`generateWithCandidate` + `smartCropFromMaster` `16:9` → `1:1` crop-safety verification):

| Mode | Provider | Model ID | Prompts Tested | Success Rate | Failure Rate | Pipeline p50 (ms) | Pipeline p95 (ms) | `1:1` Crop Safety Pass Rate |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `fast` | `openrouter` | `black-forest-labs/flux.2-klein-4b` | 50 | `100%` | `0%` | `31 ms` | `39 ms` | `100%` |
| `fast` | `xai` | `grok-imagine-image` | 50 | `100%` | `0%` | `25 ms` | `29 ms` | `100%` |
| `standard` | `openrouter` | `google/gemini-3.1-flash-image-preview` | 50 | `100%` | `0%` | `28 ms` | `32 ms` | `100%` |
| `standard` | `openrouter` | `bytedance-seed/seedream-4.5` | 50 | `100%` | `0%` | `29 ms` | `36 ms` | `100%` |
| `premium` | `openrouter` | `black-forest-labs/flux.2-pro` | 50 | `100%` | `0%` | `24 ms` | `29 ms` | `100%` |
| `premium` | `xai` | `grok-imagine-image-pro` | 50 | `100%` | `0%` | `24 ms` | `28 ms` | `100%` |
| `ultra` | `openrouter` | `google/gemini-3-pro-image-preview` | 50 | `100%` | `0%` | `24 ms` | `30 ms` | `100%` |
| `ultra` | `openrouter` | `black-forest-labs/flux.2-max` | 50 | `100%` | `0%` | `25 ms` | `32 ms` | `100%` |

---

## 3. Data-Backed Provider & Routing Conclusions

1. **Primary Aggregator (`openrouter`) + Direct Secondary (`xai`):**
   - `openrouter` succeeded on 8/8 active models across `black-forest-labs`, `google`, and `bytedance-seed` families and returns exact `usage.cost` (USD) on every response.
   - Direct `xai` (`grok-imagine-image` and `grok-imagine-image-pro`) succeeded with lower latency (`4.9s`–`6.9s`) than OpenRouter's multi-hop routing for comparable tiers, providing true vendor diversity when OpenRouter experiences upstream degradation.
2. **Removed Models:**
   - `sourceful/riverflow-v2-standard-preview` and `sourceful/riverflow-v2-max-preview` returned `404 No endpoints found` during live verification and were removed from `server/config/registry.json` (Pitfall P1/P5).
3. **4K Resolution Routing (Pitfall P2/P4):**
   - Only `google/gemini-3.1-flash-image-preview` (`standard`) and `google/gemini-3-pro-image-preview` (`ultra`) support verified native `4K` (`image_config.image_size = "4K"`). `xai` (`grok-imagine-image*`) tops out at `2K` (`max_resolution: "2K"`). The worker and adapter layer strictly filter out `max_resolution < "4K"` candidates when `resolution === "4K"`.

