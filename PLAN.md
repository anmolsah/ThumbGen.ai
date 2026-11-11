# Thumbnail Generator: Implementation Plan for the Coding Agent

> **How to use this file:** save it as `PLAN.md` in the repo root (or paste it at the start of the session) and tell the agent:
> *"Read PLAN.md fully. Follow the rules in Section 1 at all times. Start with Phase 0 only and stop for my review."*
>
> Research in this plan is dated **November 11, 2026**. Model names, prices and API details in this field change monthly. Everything in Appendix A is **unverified third-party information** and must not be hard-coded until verified (Rule R3).

---

## 1. Non-negotiable rules (anti-hallucination)

These rules override any instruction to "just get it working."

**R1. Source-of-truth order.** When facts conflict, trust in this order:
1. The actual code and config in this repository.
2. Official provider documentation and live API responses (model-list endpoints, response `usage` fields) fetched in this session.
3. This document.
4. Your own memory. **Never** rely on memory for model IDs, prices, parameters, limits, or library APIs.

**R2. Never invent.** Do not make up: model IDs, endpoint paths, request or response fields, pricing, rate limits, package names, function signatures, environment variable names, database columns that already exist, or UI copy claims (statistics, testimonials, "used by N creators", benchmark claims). If you do not know, say so.

**R3. Unknown means config plus a blocker, not a guess.** Any value you cannot verify (a price, a model ID, a size parameter) goes in config as `null` with a `TODO(verify)` marker. Add startup validation that **fails production boot** if any value used by an enabled mode is `null` or older than 30 days (`verified_at`). Dev and test may use clearly named mock values (`MOCK_*`).

**R4. Prove, don't claim.** Never write "verified," "tested," or "works" unless you ran a command or test or fetched a document in this session and can show the output or link. If you have no network or API keys, say so and list the item in `docs/VERIFICATION.md` for the owner.

**R5. Check before using any library.** Before calling a library function, confirm it exists in the installed version (read its types or docs in `node_modules` or the equivalent, or run it in a REPL). Do not add dependencies without stating why.

**R6. Minimal, reversible changes.** Detect the existing stack in Phase 0 and **keep it**. Do not migrate frameworks, rename unrelated files, or reformat the codebase. One concern per commit.

**R7. Money and credits are correctness-critical.** All credit math uses integers. Every credit change is a ledger row. Every credit mutation is covered by a test. No floating-point money.

**R8. Server is the authority.** Prices, credit costs, plan limits, resolution caps and watermarking are enforced server-side. The client only displays them. Never trust client-sent model IDs, costs or plan names.

**R9. Secrets.** API keys live only in server env vars. Never send them to the client, log them, or commit them. Provide `.env.example` with names only.

**R10. Stop-and-ask triggers** (Section 14): stop and ask the owner instead of guessing.

---

## 2. Product context (owner-supplied facts: treat as true)

A web app that generates AI thumbnails for social media accounts (YouTube and other platforms). Payment is **one-time**, not a subscription.

| Plan | Price | Credits | Marketing claim | Quality | Watermark | Image referencing |
|---|---|---|---|---|---|---|
| Starter | $6 | 25 | Up to 5 thumbnails | Ultra 2K | Yes | No |
| Creator (most popular) | $29 | 200 | Up to 40 thumbnails | Ultra 4K | No | Yes |
| Pro | $59 | 400 | Up to 80 thumbnails | Ultra 4K | No | Yes |

Current setup (to be replaced): Grok model for Starter and Creator, a Nano Banana "preview" model for Pro.

**Derived facts** (from the table above):
- 5 credits is the reference cost of one top-tier generation (25 / 5 = 5).
- Value per credit: Starter $0.24, Creator $0.145, Pro $0.1475.

---

## 3. Decisions

### 3.1 Defaults adopted from planning (owner may change via config)

1. **Multiple models are offered, but users choose a mode, not a raw model.** Modes are labeled by strength ("Fastest," "Best for text," "Best with reference photos"). An **Auto** mode routes for them.
2. **Cap the catalog at 4–6 models total.** Candidates: Grok Imagine, Nano Banana (2, 2.1, Pro), GPT Image (2 or 2.5), Seedream 5.0, FLUX. The final list is determined by the discovery snapshot (Phase 1), not by this document.
3. **Credit-weighted pricing:** each mode costs a different number of credits, so cheap modes give users more thumbnails and the expensive mode cannot erode margin.
4. **Provider:** OpenRouter as primary (its Image API), fal.ai as a secondary adapter, both behind one internal interface. The final choice depends on the benchmark in Appendix B.
5. **All generation is asynchronous** (job queue plus workers). No provider call inside a web request.

### 3.2 Pending owner decisions (do NOT implement until answered; see Section 15)

- Pro plan change (450 credits for $59 instead of 400).
- Credit expiry.
- Starter marketing copy ("up to 5 thumbnails" understates what cheap modes allow).
- Whether to add the optional text-overlay feature (Phase 7).

---

## 4. Target architecture

```
Browser ──HTTPS──▶ Web/API app (stateless)
                     │  1. auth, validate input, check plan limits
                     │  2. reserve credits (DB transaction)
                     │  3. insert job, enqueue, return job_id
                     ▼
                  Queue (Redis/BullMQ, SQS, or whatever Phase 0 finds)
                     ▼
                  Worker pool (separate process, horizontally scalable)
                     │  per-provider concurrency limiter + retry/backoff
                     │  circuit breaker + same-mode fallback
                     ▼
       Provider adapters:  openrouter │ fal │ (direct vendors later)
                     │
                     ▼
         Post-process worker (CPU): optional upscale, watermark, crops, WebP previews
                     ▼
         Object storage (R2/S3) ──▶ CDN (signed URLs)
                     ▼
         Job result pushed to browser via SSE/WebSocket (polling fallback)
```

Everything provider-specific lives **only** inside `providers/<name>` adapters. The rest of the app calls:

```ts
generate({ mode, prompt, aspectRatio, resolution, referenceImages?, seed? }) → { assetBytesOrUrl, meta }
```

`meta` must include: `provider`, `model_id`, `latency_ms`, `billed_cost_usd` (from the provider response if available, else `null`), `request_params`, `resolution_actual`, `upscaled: boolean`.

---

## 5. Model registry and pricing config

Create a single config (YAML or JSON, or DB table if the repo already uses one) with a schema validator. Example shape, with **no invented values**:

```yaml
providers:
  openrouter:
    enabled: true
    base_url: null            # TODO(verify): from official docs
  fal:
    enabled: false
    base_url: null            # TODO(verify)

modes:
  fast:
    label: "Fastest"
    credits: 1
    max_resolution_by_plan: { starter: "2K", creator: "2K", pro: "2K" }
    candidates:               # ordered; fallback walks this list
      - provider: openrouter
        model_id: null        # TODO(verify): must exist in models.snapshot.json
        est_cost_usd: null    # TODO(verify)
        verified_at: null
        source_url: null
  # standard, premium, ultra defined the same way
```

**Rules for the registry**
- A candidate is only usable if its `model_id` appears in the latest `config/models.snapshot.json` (produced by the discovery script, Phase 1). CI fails otherwise.
- Fallback happens **only within the same mode**, and only to a candidate of **equal or lower estimated cost**. Never silently fall back to a different quality tier or a more expensive model.
- Provider "preview" model IDs are flagged `preview: true`. Preview models require a configured fallback candidate.
- Each candidate records `license_checked: true|false`. Candidates with `false` cannot be enabled in production (see Section 11, pitfall P7).
- Model display names shown to users come from `mode.label`, never from provider strings.

---

## 6. Modes, credits and plan access (defaults)

Credit costs are **defaults** the owner can change; the cost basis comes from Appendix A and must be re-verified.

| Mode | Intended models (examples; confirm via snapshot) | Credits | Starter | Creator | Pro |
|---|---|---|---|---|---|
| Fast | cheap FLUX variants, Seedream 5.0 Flash, Grok Imagine 1.0 | 1 | yes | yes | yes |
| Standard | Grok Imagine 2.0, Seedream 5.0 Lite/Pro, FLUX pro | 2 | yes | yes | yes |
| Premium | GPT Image (medium), Nano Banana 2 at 2K | 3 | no | yes | yes |
| Ultra (4K) | Nano Banana Pro, Nano Banana 2 at 4K, GPT Image (high) | 5 | no | yes | yes |

Plan constraints:
- Starter: max output 2K, watermark always applied, no reference images.
- Creator and Pro: up to 4K, no watermark, reference images allowed.
- Credit consumption is `mode.credits` per generation attempt that succeeds. Failed jobs refund automatically (see Section 9).

**Margin guard (must be enforced by a test or script):** for every mode, `estimated_cost_usd / (credits × lowest_plan_credit_value)` must be ≤ **0.35**. The lowest value per credit is Creator at $0.145. If a verified price breaks this, the script fails and prints which mode to re-weight. **Do not silently adjust credit costs.**

**4K rule:** a generation may only be labeled or delivered as "4K" if the output pixel dimensions actually meet the 4K definition, either natively or via a verified upscaler. Record `resolution_actual` and `upscaled` on every asset. If no verified path to 4K exists for a mode, that mode must not be offered at 4K (and the owner must be told, since the Creator and Pro marketing claims depend on it).

---

## 7. Data model (adapt names to the existing schema)

Check the existing schema first (Phase 0). Add only what is missing.

- `users`: plan, plan_purchased_at.
- `credit_ledger` (append-only): `id`, `user_id`, `delta` (integer), `type` (`grant` | `reserve` | `commit` | `refund` | `adjust`), `job_id` nullable, `idempotency_key` (unique), `created_at`.
  - Balance = `SUM(delta)` for the user, or a maintained `balance` column updated in the same transaction.
- `jobs`: `id`, `user_id`, `mode`, `status` (`queued` | `running` | `succeeded` | `failed` | `canceled`), `params` (JSON: prompt, aspect ratio, resolution, reference ids), `credits_reserved`, `attempts`, `provider`, `model_id`, `error_code`, `created_at`, `started_at`, `finished_at`.
- `assets`: `id`, `job_id`, `user_id`, `storage_key`, `variant` (`original` | `watermarked` | `preview_webp`), `width`, `height`, `upscaled`, `bytes`.
- `generation_log`: `job_id`, `provider`, `model_id`, `latency_ms`, `billed_cost_usd` (nullable), `request_params`, `outcome`. Used for cost monitoring.

---

## 8. API surface (internal; confirm routing style with the existing app)

- `POST /api/jobs`: body `{ mode, prompt, aspectRatio, resolution, referenceAssetIds? }`.
  - Validates against the user's plan **server-side**, reserves credits atomically, enqueues, returns `{ jobId }`.
  - Requires an `Idempotency-Key` header. Same key returns the same job and never double-charges.
- `GET /api/jobs/:id`: status and, when done, signed URLs.
- `GET /api/jobs/:id/events`: SSE stream (polling fallback allowed).
- `GET /api/credits`: balance and recent ledger.
- `POST /api/uploads`: reference images. Validate type, size and dimensions, and strip EXIF.
- Payment webhook (use the repo's existing payment provider; do not choose a new one): idempotent grant of credits per purchase, verified signature.

---

## 9. Worker pipeline

1. Load the job. Skip it if its status is already terminal (idempotent).
2. Resolve `mode` → ordered candidates from the registry.
3. For each candidate (stop at first success):
   - Acquire the per-provider concurrency slot.
   - Call the adapter with explicit `size` and `resolution`. **Never rely on provider defaults** (see P2).
   - On a retryable error (timeout, 429, 5xx): exponential backoff with jitter, at most 1 retry on the same candidate, then move to the next candidate.
   - On a non-retryable error (4xx validation or content policy): fail the job with a specific `error_code`. Do not try other candidates for policy rejections.
4. Persist the original output to storage **immediately** (provider URLs expire).
5. Post-process in a CPU worker: upscale if needed, apply watermark if the plan requires it, generate crops and a small WebP preview.
6. Commit credits (ledger `commit`) and mark the job `succeeded`. On final failure: ledger `refund` for the full reservation.
7. Record a `generation_log` row, including `billed_cost_usd` from the provider response if present.

**Watermark rule:** for Starter, the un-watermarked original must **never** be reachable by any URL the user can obtain. Only the watermarked variant gets signed URLs.

**Concurrency controls:**
- Per-provider limiter (value comes from config and the provider's real limit, not a guess).
- Per-user concurrent job caps by plan (defaults: Starter 2, Creator 4, Pro 6; configurable).
- Priority queue: Pro > Creator > Starter, with a starvation guard so lower tiers still progress.
- Circuit breaker per provider and model.

---

## 10. Website and UI requirements

- **Pricing page copy must be generated from the plan config**, not hand-written, so it can never drift from the server.
- Marketing claims must be provably true:
  - "Ultra 4K" only if Section 6's 4K rule is satisfied.
  - "Up to N thumbnails" is the ceiling for the 5-credit mode. If cheaper modes let users make more, either say so ("≈5 top-tier thumbnails, or more with Fast and Standard modes") or wait for the owner's decision (Section 15, Q3).
  - No invented testimonials, user counts, "as seen on" logos, or benchmark numbers. Use obvious placeholders (`{{TESTIMONIAL_PLACEHOLDER}}`) if content is missing and list them in `docs/VERIFICATION.md`.
- **Generation screen:** mode picker (labels and short strength descriptions; the recommended default is preselected), Auto option, live credit cost shown before submit, aspect-ratio presets for target platforms (confirm the exact pixel sizes from each platform's current official guidance before hard-coding), reference-image upload (Creator and Pro only).
- **Waiting UX:** show a progress state with SSE updates. Models take **tens of seconds** per image, so show a fast low-resolution draft first, then replace it with the final when ready.
- **Gallery:** serve small WebP previews; fetch the full-resolution file only on download.
- **Errors:** human-readable messages mapped from `error_code`; failed jobs show "credits refunded."
- Accessibility basics (labels, keyboard operation, contrast) on all new UI.

---

## 11. Known pitfalls (found in research; design around them)

- **P1. Retired model.** A Grok quality model ID was reported retired on 2026-11-02, with requests now served by a different model at lower quality. Never hard-code old IDs; confirm via the discovery snapshot.
- **P2. Defaults can change the bill.** One provider doc showed a Seedream Pro call at 1K returning 2K and billing the higher rate. Always pass explicit size and resolution, and log the billed cost from every response.
- **P3. Parameter formats differ per model.** One provider rejects pixel-size strings for certain models. The adapter layer must map size and aspect-ratio inputs per model, with tests.
- **P4. Grok output tops out at 2K** per third-party sources. Creator and Pro advertise 4K. Do not route 4K requests to a model that cannot produce it unless a verified upscale step exists.
- **P5. "Preview" model IDs** can change or be deprecated. Pin them and configure a fallback.
- **P6. Aggregator limits.** One aggregator reportedly starts new accounts at low concurrency and raises it as credits are purchased. Check the real limit in the account dashboard or docs before launch, and set the limiter from that.
- **P7. Licenses.** Open-weight models (e.g., some FLUX variants) can carry non-commercial terms. Do not enable a model in production until the owner confirms commercial-use rights (`license_checked: true`).
- **P8. Latency is unproven.** One doc example showed 94 seconds for a single image. Benchmark before promising speed anywhere in the UI or copy.
- **P9. Prices conflict between sources** (see Appendix A). Treat every price as an estimate until read from the official page or a live response.

---

## 12. Phased work plan

Complete one phase at a time. At the end of each, produce the report in Section 14 and **stop for owner review**.

### Phase 0: Audit (no code changes)
- Identify framework, language, package manager, DB and ORM, auth, payments, queue (if any), hosting, test setup, existing generation code, and how the current Grok and Nano Banana calls are made.
- List the existing model IDs and where they are hard-coded.
- Produce `docs/AUDIT.md`: what exists, what is missing for Sections 4–9, risks, and a proposed file-level change list.
- **Acceptance:** every statement in `AUDIT.md` cites a file path. No assumptions about stack.

### Phase 1: Discovery and registry
- Write `scripts/discover-models.*`: calls each enabled provider's official model-list endpoint (confirm the endpoint in the provider's docs; OpenRouter's docs reportedly describe a model-list route for its Image API, but verify) and writes `config/models.snapshot.json` with timestamp and the raw fields needed (model ID, pricing lines, supported sizes, reference-image support).
- Implement the registry schema and validator (Section 5), plus the margin-guard script (Section 6).
- **Acceptance:** validator fails on `null` or unknown model IDs; margin guard runs; snapshot committed; `docs/VERIFICATION.md` lists every remaining unknown.

### Phase 2: Provider adapter layer
- Implement the `generate()` interface with an OpenRouter adapter (official docs only), plus a **mock adapter** for tests. Add the fal adapter only if the owner confirms (Section 15, Q7).
- Per-model parameter mapping with unit tests (P2, P3).
- **Acceptance:** adapter contract tests pass against the mock; one real call per enabled model succeeds **or** is reported as not run (no keys), with the reason.

### Phase 3: Credits and jobs core
- Ledger, reservation, commit, refund, idempotency (Sections 7–8).
- **Acceptance:** tests in Section 13 pass, including the concurrent-spend test.

### Phase 4: Queue and workers
- Job queue, workers, limiter, retry and backoff, fallback, circuit breaker, per-user caps, priorities (Section 9).
- **Acceptance:** chaos tests: provider 429s, timeouts and 5xx produce retries then fallback; no job stuck in `running` after worker crash (visibility timeout or reaper); no double charges.

### Phase 5: Post-processing and storage
- Persist originals, watermark (Starter), crops, WebP previews, signed URLs, optional verified upscaler.
- **Acceptance:** Starter users cannot obtain an un-watermarked URL (test it); `resolution_actual` matches the file's real pixel size.

### Phase 6: Website and UI
- Pricing page generated from plan config; generation screen; waiting UX; gallery; error states (Section 10).
- **Acceptance:** pricing page values match config exactly (snapshot test); every claim on the page maps to a verified capability.

### Phase 7: Optional, only with owner approval
- Text overlay with a server-side renderer (Satori, Sharp or Canvas: confirm which exist in the stack), so titles are exact and AI is used only for imagery. Smart-crop from one 16:9 master to other aspect ratios. OCR check if text is AI-rendered. Batch mode for non-urgent jobs.

### Phase 8: Hardening
- Load test, monitoring and alerts (queue depth, p95 latency per model, error rate, cost per generation, daily spend cap with kill switch), rate limiting, abuse protection, content-policy error handling.
- **Acceptance:** load-test report with numbers; alert rules documented.

---

## 13. Required tests

- **Credits:** (a) 50 parallel `POST /api/jobs` with a balance of 5 credits at 5 credits each → exactly 1 succeeds; (b) same `Idempotency-Key` twice → one job, one charge; (c) failed job → full refund exactly once; (d) payment webhook replay → credits granted once; (e) integer-only math.
- **Plan enforcement:** Starter cannot request Premium or Ultra, 4K, or reference images (server rejects even if the client sends them).
- **Pricing page:** generated values equal plan config.
- **Adapters:** per-model param mapping, error classification (retryable vs not), explicit size always sent.
- **Worker:** crash mid-job recovers; fallback stays within mode and equal-or-lower cost.
- **Watermark:** Starter's un-watermarked original is unreachable.
- **Registry:** validator rejects null prices, unknown IDs, stale `verified_at`.
- **Margin guard:** fails when a mode exceeds 35% cost-to-revenue.

---

## 14. Reporting format and stop-and-ask triggers

**After every phase, report exactly:**
1. **Changed:** files and a one-line reason each.
2. **Verified:** each item with evidence (command and output, test name and result, or doc URL fetched today).
3. **Unverified / assumed:** every item you could not verify, also appended to `docs/VERIFICATION.md`.
4. **Risks and questions.**
5. **Next phase** (do not start it).

**Stop and ask the owner when:**
- the stack differs from what this plan assumes in a way that changes the design;
- a verified price breaks the margin guard;
- no verified path to real 4K exists;
- a model's license is unclear;
- you are about to delete data, change the payment flow, or change what existing customers were promised;
- two sources conflict and you cannot resolve it from an official source.

---

## 15. Open questions for the owner (the agent must not guess these)

1. Tech stack and hosting (if Phase 0 cannot determine it).
2. Which provider(s) have working API keys now (OpenRouter? fal? direct vendors?).
3. Starter copy: keep "Up to 5 thumbnails," or change to "≈5 top-tier thumbnails, or more with Fast and Standard modes"?
4. Pro plan: keep 400 credits for $59 ($0.1475 per credit, which is *higher* than Creator's $0.145), or change to 450 credits ($0.131 per credit)? Or add a Pro-only perk (priority queue, Ultra-only models)?
5. Do credits expire? (Affects liability if API prices change.)
6. Should top-up credit packs be sold? At what price?
7. Add the fal.ai adapter now or later (after the Appendix B benchmark)?
8. Approve optional features in Phase 7?
9. Daily spend cap (USD) for the kill switch?
10. Target platforms and aspect ratios to support at launch.

---

## Appendix A: Reference facts (UNVERIFIED, from third-party sources, Nov 2026)

**Do not hard-code these. They exist so you know what to verify.** Prices conflict across sources.

| Model | Reported price | Notes |
|---|---|---|
| GPT Image 2 | ~$0.006 low / ~$0.053 medium / ~$0.211 high (1024²) | Token-billed; quality setting drives cost. Reported as top of Artificial Analysis arena (Elo ~1339) |
| GPT Image 2.5 | One test: ~$0.0326 for a 16:9 thumbnail at high | Token-billed; "Sunburst" and "Flare" variants reported |
| Nano Banana Pro (Gemini 3 Pro Image) | ~$0.134 at 1K/2K, ~$0.24 at 4K | Sources differ ($0.0804 on one reseller) |
| Nano Banana 2 (Gemini 3.1 Flash Image) | ~$0.045 (0.5K) to ~$0.151 (4K); Batch ~50% off | Reported "preview" naming on some IDs |
| Nano Banana 2.1 | One source: ~$0.0336 (1K) / $0.0168 batch; one measured test: $0.0418 for a 16:9 thumbnail | Another source says Google's price list does not show the claimed 50% cut |
| Grok Imagine 1.0 | ~$0.02 | |
| Grok Imagine 2.0 | ~$0.04 (1K) per one source; ~$0.025 per a reseller | Reported max 1K or 2K; up to 5 reference images |
| Grok Imagine quality (older) | ~$0.05 | Reported retired 2026-11-02 |
| Ideogram 3.0 / 4.x | ~$0.03 to $0.10 depending on tier and version | Text-focused |
| Seedream 5.0 Flash / Lite / Pro | ~$0.018 / ~$0.035 / ~$0.045 (Replicate) or ~$0.0675 (fal) | |
| FLUX.2 variants | dev ~$0.0084 to $0.012, klein ~$0.001 to $0.012, pro ~$0.03 to $0.073, flex ~$0.05 to $0.06 | Check licenses |

**Provider notes (unverified):**
- OpenRouter: reportedly no markup on inference, 5.5% fee on credit purchases, no plan-based rate limit on paid models (limits come from the underlying provider), failed-over calls not billed; ~30+ image models; dedicated Image API; bring-your-own-key option.
- fal.ai: reportedly 1,000+ media models, pay only for successful outputs, queue-first design, concurrency starts at 2 and rises to 40 with purchased credits.
- Midjourney: reportedly has no public API.
- Typical latency (single tests): Nano Banana 2.1 ~14 s, GPT Image 2.5 ~16 to 30 s per thumbnail prompt; one OpenRouter doc example showed 94 s.

---

## Appendix B: Benchmark spec (run before finalizing providers or credit weights)

- Use the same **50 thumbnail prompts** (mix: text-heavy titles, face or reference-photo edits, product shots, plain backgrounds) for the 3–4 candidate models, on each candidate provider.
- Always send explicit size and resolution.
- Record per call: `provider`, `model_id`, p50 and p95 latency, success and failure rate, error types, **actual billed cost** (from the response if available, otherwise from the provider's usage dashboard), output pixel dimensions.
- Score text accuracy (is the requested title spelled correctly?) and crop safety (does the focal point survive a 1280×720 and a 1:1 crop?) manually on a sample.
- Output: `docs/BENCHMARK.md` with a table, plus raw JSON. Do not draw conclusions the data does not support.
- Re-run after any model change. Update `verified_at` for every price confirmed.

---

## Appendix C: Definition of done

- [ ] No `null` or unverified values for any enabled mode; validator passes.
- [ ] Margin guard passes (≤ 35%) using prices verified from official sources or live billed cost.
- [ ] All Section 13 tests pass.
- [ ] Pricing page generated from config; every claim traceable to a capability.
- [ ] Real 4K or the claim removed.
- [ ] Starter watermark enforcement tested.
- [ ] Benchmark report exists; chosen provider justified by data.
- [ ] `docs/VERIFICATION.md` contains every remaining unknown; owner has reviewed it.
- [ ] Load test run; alerts and spend cap configured.
