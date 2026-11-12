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
6. **Output quality is enforced by a system, not by the model alone** (Section 10A): a prompt "brief compiler," composition and typography rules, code-rendered text, an automated QA gate, and platform export presets.

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

**Margin guard (must be enforced by a test or script):** for every mode, `estimated_cost_usd / (credits × lowest_plan_credit_value)` must be ≤ **0.35**. The lowest value per credit is Creator at $0.145. If a verified price breaks this, the script fails and prints which mode to re-weight. Effective cost must include auto-retries and QA calls from Section 10A.7: `cost × (1 + retry_rate) + qa_cost`, using the measured retry rate once available. **Do not silently adjust credit costs.**

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

## 10A. Anti-slop quality system (thumbnails must look designed, not generic)

**Goal:** outputs that look specific and intentionally designed, not like generic AI images.

**Status of the rules below:** they are hypotheses drawn from third-party blogs (Appendix A.2), mostly written by vendors selling image tools. Treat every threshold and tactic as something to **test on the golden set** (10A.10), not as proven fact. Every number below is a **config default**, not a verified truth.

**Hard constraints on claims:** never market the product as making images "undetectable as AI," never build features whose purpose is evading a platform's AI-labeling rules, and never use unverified statistics (for example "AI-looking thumbnails cut CTR by 23%") in copy.

### 10A.1 Principles
1. **Specific beats generic.** Generic results come from underspecified briefs. A better model alone produces higher-fidelity generic images. Quality comes from the brief, composition and typography.
2. **Models make imagery; code makes typography and layout.** Text is rendered by your own renderer (10A.4), not by the image model.
3. **Variation by design.** One fixed formula applied to every thumbnail becomes a recognizable template.
4. **Gate, then retry once.** Catch concrete defects automatically instead of making users burn credits on re-rolls.
5. **Be honest about limits.** The system catches *defects* (bad hands, garbled text, clutter). It does not and cannot guarantee "no AI look."

### 10A.2 Brief compiler (server-side)
Users type a short prompt. The server turns it into a structured brief, then into the final per-model prompt.

- **Inputs:** user prompt; platform preset; style preset; optional brand kit; optional reference image; optional title text (title text is for the overlay renderer, **not** sent to the image model by default).
- **Step 1, structured brief.** Use a text LLM (model chosen via config: `llm_brief_model: null  # TODO(verify)`) to return **JSON only**, validated against a schema, with these fields: `subject_and_action`, `expression_or_pose` (for people), `light` (one named source and direction), `surface_detail` (a named texture), `background_detail` (one concrete, unglamorous real-world detail), `camera` (angle and lens feel), `composition` (focal point, reserved empty region for text), `palette` (2–3 colors, from brand kit if present), `constraints`.
- **Step 2, deterministic template.** A code template turns the JSON into the prompt text for the chosen model. Store both the JSON and the final prompt in `generation_log`.
- **Slop lexicon.** Keep `config/slop_lexicon.yaml`: generic modifiers the *compiler* avoids adding. Starting hypotheses (validate): "masterpiece," "ultra-detailed," "8k," "hyper-realistic," "cinematic lighting," "volumetric," "glowing," "trending on artstation," "soft even studio lighting." This list only constrains what the compiler adds; **never censor or rewrite words the user typed.**
- **Style presets** (owner-editable JSON): `photoreal_candid`, `bold_graphic`, `product_focus`, `minimal_clean`, `typographic_led`. Each holds default brief fragments and allowed layouts.
- **Negative prompts:** use only if the model's capability flag `supports_negative_prompt` is `true` in the discovery snapshot. Otherwise phrase them as positive constraints inside the prompt ("no readable text, no logos, correct hand anatomy"). Do not assume support.
- **Controlled randomness:** pick `light` direction and `background_detail` from curated pools using a recorded seed, so outputs differ run to run and can be reproduced.
- **Photoreal-person presets** additionally request: visible skin texture, asymmetric candid expression, gaze not locked on the lens, one real light source, one specific background detail. Test against a version without these instructions on the golden set before keeping them.

### 10A.3 Composition rules (deterministic, config-driven)
- One focal subject. Max **N** visual elements (default 3).
- Reserve an empty region for text (layout templates such as text-left / subject-right).
- **Safe zone:** keep faces and key objects inside the center region (default 80%, from third-party advice) and keep important content out of platform UI overlays (for example the video-duration badge, which one source places bottom-right on YouTube). Final values come from the platform preset (10A.11).
- Avoid a perfectly centered, perfectly symmetric subject unless the preset asks for it.
- **Mobile check:** render a small feed-size preview of every result and run the legibility checks on that preview, because text and framing fail at small sizes. The pixel size comes from the verified platform preset, not a guess.

### 10A.4 Typography (code-rendered)
- Render titles with a server-side renderer (Satori, Sharp or Canvas; confirm which fits the stack in Phase 0). **Strongly recommended; needs owner approval (Section 15, Q11).** If approved, build it before Phase 5.5.
- Allowed fonts: a small curated set with licenses checked (`license_checked: true`). Max 2 fonts and 1 accent color per thumbnail.
- Defaults (validate on the mobile preview): max **5** words; minimum font size about 8% of canvas height (third-party guidance of roughly 60–80px at 1280×720); text/background contrast ratio ≥ **4.5:1** measured on sampled pixels. If contrast fails, auto-add a stroke, shadow or scrim, then re-check.
- **Banned effects** (typical "AI-look" design tells): gold 3D bevel text, neon gradient glow, sparkle overlays, multiple competing text styles.
- Text must not overlap detected faces. Use face detection (library chosen in Phase 0 after verifying it exists in the stack) to place or reject layouts.

### 10A.5 Reference-first workflow (Creator and Pro)
- For person-based thumbnails, nudge users to upload a real photo (image referencing) and use an edit-with-reference path. This keeps real likeness and avoids invented faces.
- Starter has no references (plan rule), so its photoreal-person presets rely on the compiler and the QA gate only. Say so honestly in the UI; do not promise results the plan cannot deliver.
- Require a checkbox that the user has rights to any likeness they upload.

### 10A.6 Finishing pass (optional, off by default until A/B proves it)
- Candidates: subtle grain, mild local contrast, gentle color grade matched to the preset. Each is a config toggle.
- If upscaling to reach 4K (Section 6), test a texture-preserving upscaler against no-upscale on the golden set for over-smoothed "plastic" skin. Pick by evidence.
- Export per platform preset (10A.11): sRGB, and a JPG quality loop to satisfy the file-size limit.

### 10A.7 Automated QA gate
Run after generation and before credits are committed.

**Layer 1: deterministic checks** (cheap, every output): dimensions and aspect ratio; file size; sharpness metric inside a calibrated range; text contrast; safe-zone violations; text-over-face overlap; blank or degenerate image; perceptual-hash similarity to the user's recent outputs (anti-repeat).

**Layer 2: vision-LLM rubric** (model via config; every Creator and Pro output, sampled for Starter): returns JSON with 1–5 scores and boolean flags for: extra or missing fingers or limbs; warped faces or eyes; plastic skin; garbled pseudo-text or logos; incoherent background objects; clutter or no clear focal point; generic centered symmetric stock-photo look; text region not clear.
- **Do not ask the model "is this AI?"** It cannot be trusted for that. Ask only for concrete, checkable defects.
- All thresholds start as `null` and **must be calibrated** against human labels on the golden set (at least 100 images) with precision and recall reported. Ship nothing with uncalibrated thresholds.

**On failure:** regenerate **once** with a corrective brief naming the specific defects. The retry is absorbed by you, not charged. If the second attempt also fails, behavior is an owner decision (Q12): deliver the better of two with a flag, or refund. Never loop.

Log every QA result per generation. Add QA cost to the margin guard (Section 6).

### 10A.8 Variation and brand identity
- Per-user history: do not reuse the same light, pose or background-detail fragments within the last N generations (default 10).
- Brand kit: palette, fonts (from the allowed set), logo placement (code overlay), reference face. This gives each creator a consistent identity that still differs from other creators.

### 10A.9 Honesty and provenance
- Phase 0 and Phase 5 must **determine and report** whether provider outputs carry provenance metadata (for example C2PA or invisible watermarks) and whether the pipeline strips it (re-encoding often does). Do not assume either way, and do not advertise stripping.
- Before writing any UI copy about platform AI-disclosure rules, read the platform's current policy and cite it in `docs/VERIFICATION.md`.
- UI copy encourages thumbnails that accurately represent the video. No feature exists to fabricate events involving real people.

### 10A.10 Evaluation loop
- **Golden set:** at least 100 prompts across presets and platforms. Humans rate each output 1–5 for "would a viewer scroll past this?" and tag defects. Re-run on every model, prompt-compiler or QA change. Ship only if scores do not regress.
- **Product metrics:** QA pass rate, auto-retry rate, regenerate-click rate, download rate, thumbs up/down, cost per kept thumbnail.
- CTR improvement cannot be claimed without platform data. Do not claim it.

### 10A.11 Platform presets (config, verified per platform)
`config/platform_presets.yaml`: per platform, the aspect ratio(s), pixel dimensions, max file size by upload context, formats, safe zones, UI overlays, `verified_at`, `source_url`. Fill **only** from the platform's official documentation; leave unverified values `null` (Rule R3).

# 10B. Anti-AI-Slop Creative Direction \& Design Quality System

**Document type:** Product / engineering implementation specification  
**Status:** Proposed --- validate through benchmark before treating
thresholds or tactics as proven  
**Intended use:** Add this specification to the thumbnail-generation
product plan and provide it to the implementation AI/engineering agent.  
**Relationship to existing plan:** This section extends the existing
**10A. Anti-slop quality system**. It does not replace 10A or authorize
removing its safeguards.

\---

## 1\. Executive summary

The current 10A system primarily detects image-generation defects:
anatomy problems, incoherent objects, plastic-looking skin, clutter,
poor contrast, unsafe framing, and similar issues.

Those checks are necessary, but they do not guarantee professional
thumbnail design. An image can be technically clean and still look
generic, formulaic, overdramatic, or recognizably like an AI-generated
poster.

The missing capability is **creative art direction**.

Add a Creative Direction \& Design Quality layer that decides *what
visual idea should communicate the content*, *how that idea should be
composed*, and *how the final thumbnail should be designed*. Evaluate
technical image quality and design quality separately.

### Target pipeline

`User brief → Content understanding → Creative direction → Composition plan → Image generation → Technical QA + Design QA → Code-rendered typography/layout → Final validation → Delivery`

The exact ordering of final QA and typography validation may be adapted
to the existing architecture, but the system must evaluate the actual
final composite, not only the raw generated image.

### Core product principle

**Do not optimize for "looking less AI-generated." Optimize for
specific, relevant, intentional, professionally art-directed
thumbnails.**

Do not claim that outputs are undetectable as AI, and do not build
features intended to evade platform AI-labeling or disclosure rules.

\---

## 2\. Problem statement

Observed failure pattern:

* Exaggerated or generic facial expressions used without a content
reason.
* Predictable "shocked face + dramatic background + giant headline"
compositions.
* Decorative particles, smoke, glow, lens effects, symbols, or props
that add no information.
* Gold bevel / 3D typography and multiple competing text treatments.
* Too many visual elements competing for attention.
* Generic cinematic lighting and overly polished environments.
* Repeated layouts across unrelated topics.
* A thumbnail that communicates a broad genre but not the specific
story.

These are not necessarily image defects. They are often **art-direction
and design defects**.

### What success looks like

A successful thumbnail should:

1. Communicate the actual video topic or story.
2. Have one clear visual idea and a deliberate focal hierarchy.
3. Use visual elements that have a reason to exist.
4. Feel designed for this particular brief, not selected from a generic
template.
5. Remain legible and understandable at the platform's small feed size.
6. Use typography and graphic elements as part of a coherent layout.
7. Avoid unsupported claims or visual fabrication involving real people
or events.
8. Preserve the user's requested style where feasible, while explaining
genuine limitations.

\---

## 3\. Scope and non-goals

### In scope

* Content understanding and thumbnail intent extraction.
* Creative direction selection.
* Composition and layout planning.
* Contextual cliché detection.
* Independent design-quality evaluation.
* Better use of user-provided references and brand kits.
* Final-composite QA.
* Golden-set benchmarking and measurable release gates.
* Logging and reproducibility.

### Out of scope

* Claiming AI detection or AI-undetectability.
* Evading platform disclosure, provenance, or labeling requirements.
* Automatically copying another creator's exact thumbnail or a
protected visual identity.
* Treating every listed cliché as forbidden.
* Replacing human design review for subjective or high-impact cases.
* Introducing a new image model before testing whether the current
model and improved direction solve the problem.

\---

## 4\. Architecture: extend 10A with a creative layer

The new system should be modular. Do not combine every responsibility
into one giant prompt.

### Proposed stages

#### Stage 1 --- Content understanding

Convert the user's request into a structured content brief.

Required fields (adapt names to the existing schema):

* `topic`: the main subject.
* `specific\\\_story`: the particular fact, question, event, claim, or
angle the video covers.
* `audience`: intended viewer, if known.
* `viewer\\\_curiosity`: the truthful question or information gap that
may make the viewer interested.
* `emotional\\\_tone`: e.g. curiosity, urgency, wonder, concern, humor,
calm, inspiration.
* `content\\\_format`: e.g. documentary, tutorial, commentary, product
review, news, entertainment.
* `must\\\_show`: objects, people, places, or evidence that must appear.
* `must\\\_not\\\_imply`: events, claims, relationships, or outcomes the
thumbnail must not falsely suggest.
* `title\\\_text`: optional text for the code renderer; do not send it to
the image model by default.
* `platform\\\_preset`: selected platform and verified dimensions / safe
zones.
* `reference\\\_assets`: optional user-authorized images and brand
assets.

The system must distinguish verified facts supplied by the user from
creative interpretation. Do not invent evidence or depict an unverified
event as real.

If the prompt is too vague to determine a specific story, either ask one
concise clarification or produce a conservative concept that does not
fabricate specifics.

#### Stage 2 --- Creative direction engine

Generate a small set of internally usable creative directions, then
select one. Do not expose a long questionnaire to the user.

Each direction should describe:

* `concept\\\_name`
* `visual\\\_thesis`: one sentence explaining the visual idea.
* `story\\\_device`: the specific visual device used to communicate the
story.
* `primary\\\_subject`
* `supporting\\\_element`: optional; include only if it adds meaning.
* `emotional\\\_tone`
* `visual\\\_language`: e.g. editorial photography, documentary still,
bold graphic, product-led, typographic-led, illustrative.
* `composition\\\_intent`
* `typography\\\_intent`
* `palette\\\_intent`
* `why\\\_this\\\_fits`: connection to the actual content.
* `risks`: possible misleading implication, cliché, or legibility
issue.

Select the direction that best fits the brief, not the direction with
the most dramatic effects.

**Important:** creative directions are not fixed templates. They are
art-direction choices. Avoid mapping every request to the same "person
on one side, text on the other" layout.

#### Stage 3 --- Composition planner

Turn the chosen direction into an actionable layout plan.

Suggested fields:

* `canvas`: dimensions and platform preset.
* `focal\\\_point`: the one element viewers should notice first.
* `secondary\\\_focus`: optional and subordinate.
* `subject\\\_position`: normalized coordinates or named region.
* `subject\\\_scale`: relative size / crop intent.
* `camera\\\_perspective`: only when relevant.
* `background\\\_role`: context, contrast, or evidence; not decorative
filler.
* `text\\\_region`: reserved region and maximum area.
* `negative\\\_space`: where and why it is needed.
* `visual\\\_hierarchy`: ordered list of elements by attention priority.
* `element\\\_budget`: maximum number of meaningful visual elements.
* `overlap\\\_constraints`: face, text, logo, and key-object collision
rules.
* `mobile\\\_crop\\\_check`: preview dimensions from verified platform
configuration.

A composition is not good merely because it is asymmetric or has
negative space. Every placement must support the story and hierarchy.

#### Stage 4 --- Image generation

Pass the selected creative direction and composition plan into the
existing 10A deterministic prompt compiler.

Keep responsibilities separate:

* The image model creates photographic / illustrative imagery.
* The code renderer creates title text, logos, badges, lines, shapes,
and other precise graphic elements.
* Do not ask the image model to render readable title text by default.
* Do not add effects, objects, people, or symbols unless they support
the visual thesis.

Continue to honor model capability discovery, reference-image
permissions, and provenance checks from 10A.

#### Stage 5 --- Independent QA

Run two distinct evaluations:

1. **Technical Image QA** --- existing 10A defect checks.
2. **Creative Design QA** --- new checks defined in Section 7.

Do not collapse them into one opaque score. Preserve individual
dimensions, evidence, and pass/fail reasons.

#### Stage 6 --- Typography, layout and final composite

Use the approved code-based renderer from 10A. Apply the composition
plan to the actual generated image.

After compositing, run final checks on the complete thumbnail,
including:

* Text clipping and contrast.
* Text / face / key-object overlap.
* Platform safe zones.
* Hierarchy at feed-size preview.
* Whether the final title changes or misrepresents the story.
* Whether graphic additions create clutter.

The final QA must inspect the **final composite**. Raw-image QA alone is
insufficient.

\---

## 5\. Creative direction library

Create an owner-editable set of creative direction families. These are
starting points, not rigid templates.

Suggested initial families:

### 5.1 Editorial photography

Use when the topic benefits from a credible, magazine-like treatment.

Characteristics: - Strong authentic photograph or realistic scene. -
Restrained headline. - Deliberate crop and negative space. - Limited
graphic decoration. - Natural or contextually motivated light.

### 5.2 Documentary storytelling

Use when the content is about a real place, person, event,
investigation, or experience.

Characteristics: - Scene-specific visual evidence. - Observational
framing. - Contextual environmental detail. - Controlled color and
typography. - No invented evidence or fake documentary artifacts.

### 5.3 Investigative editorial

Use when the content explores a question, mystery, comparison, or claim.

Characteristics: - One meaningful clue, object, contrast, or location. -
Clear relationship between the headline and visual. - Evidence-led
rather than decoration-led. - Avoid arbitrary magnifying glasses,
warning symbols, circles, arrows, and labels.

### 5.4 Bold graphic design

Use when the topic benefits from a graphic rather than photographic
treatment.

Characteristics: - Strong typographic hierarchy. - Limited shapes and
colors. - Intentional geometry and spacing. - Distinctive layout. - No
unnecessary 3D, bevel, glow, or texture effects.

### 5.5 Product-focused

Use for product reviews, demonstrations, comparisons, and commerce
content.

Characteristics: - Product is recognizable and accurately represented. -
Product scale and crop support the message. - Background is
subordinate. - Claims and comparison cues are truthful.

### 5.6 Typographic-led

Use when the headline or a short phrase is the main hook.

Characteristics: - Typography is the primary visual element. - One
supporting visual at most unless the brief justifies more. - Clear type
scale, spacing, alignment, and contrast. - No competing headline
treatments.

### Selection rules

* Select based on content type, story, audience, and reference assets.
* Avoid selecting the same direction for every request.
* Do not force variation for its own sake.
* Allow a user-selected style preset to override the automatic choice,
within safety and feasibility constraints.
* Record the selected direction and its rationale for evaluation.

\---

## 6\. Contextual creative-cliché detection

Create `config/creative\\\_cliche\\\_lexicon.yaml`.

The lexicon should identify recurring patterns, not impose universal
bans.

Initial candidate patterns to test:

* Exaggerated shocked face without a story reason.
* Gold 3D / bevel headline treatment.
* Random floating particles, sparks, or glowing dots.
* Excessive smoke, fog, or volumetric rays.
* Decorative magnifying glass unrelated to the topic.
* Arbitrary arrows, circles, warning signs, or question marks.
* Unnecessary wooden signboards or fake labels.
* Multiple competing headlines.
* Generic "cinematic" background unrelated to the actual setting.
* Overly symmetrical stock-poster composition.
* Generic person cutout pasted over a dramatic background.
* Excessive outlines, shadows, glow, and texture applied together.
* Repeated split composition across unrelated topics.

### Required behavior

For each detected pattern, return:

* `pattern\\\_id`
* `severity`: informational, warning, or blocking candidate.
* `location\\\_or\\\_region`: where it appears, if identifiable.
* `evidence`: visible reason for the flag.
* `contextual\\\_reason`: why it may be inappropriate for this brief.
* `suggested\\\_fix`: a specific design change.

A pattern must not be rejected only because it appears in the lexicon.
Evaluate whether it is justified by the story and selected direction.

Do not flag a user's explicitly requested style merely because it is
unusual. Preserve the user's intent unless it conflicts with safety,
truthfulness, or technical feasibility.

\---

## 7\. Creative Design QA rubric

Create a separate structured rubric for the vision model or evaluation
service.

The evaluator must judge concrete design qualities, not answer "does
this look AI-generated?"

### Required dimensions

Score each dimension from 1 to 5 and provide concise visual evidence.

\---

Dimension                           What to evaluate

\---

Content specificity                 Does the image communicate this
particular story rather than only
its broad category?

Concept strength                    Is there one understandable visual
idea?

Composition and hierarchy           Is the order of attention clear and
intentional?

Typography and layout               Are text scale, spacing, alignment,
contrast, and placement coherent?

Visual relevance                    Does each major element support the
content?

Originality / non-formulaic design  Does it avoid an interchangeable
stock-poster composition?

Restraint                           Are effects and decorative elements
justified?

Small-size readability              Does the idea remain clear at the
verified feed-size preview?

Truthfulness                        Does the visual avoid implying
unsupported events, evidence, or
claims?
---

### Suggested score anchors

* **1 --- Broken:** materially confusing, misleading, cluttered, or
poorly composed.
* **2 --- Weak:** recognizable topic, but major design issues reduce
clarity or credibility.
* **3 --- Acceptable:** understandable and usable, but generic or
lacking a strong visual idea.
* **4 --- Strong:** specific, coherent, intentional, and
professionally composed.
* **5 --- Excellent:** memorable, distinctive, highly relevant, and
polished without unnecessary effects.

These anchors are initial definitions. Validate consistency between
evaluators and human reviewers before using scores as automatic release
gates.

### Required JSON response

Use a schema similar to the following; adapt it to the project's
existing validation library and conventions.

``` json
{
  "schema\\\_version": "1.0",
  "overall\\\_assessment": "pass | revise | fail",
  "scores": {
    "content\\\_specificity": 1,
    "concept\\\_strength": 1,
    "composition\\\_hierarchy": 1,
    "typography\\\_layout": 1,
    "visual\\\_relevance": 1,
    "originality": 1,
    "restraint": 1,
    "small\\\_size\\\_readability": 1,
    "truthfulness": 1
  },
  "flags": \\\[
    {
      "code": "UNMOTIVATED\\\_DECORATION",
      "severity": "warning",
      "evidence": "A decorative glowing symbol does not explain or support the topic.",
      "suggested\\\_fix": "Remove it and use the actual location as the supporting visual."
    }
  ],
  "strengths": \\\[
    "The primary location is recognizable and visually dominant."
  ],
  "revision\\\_brief": \\\[
    "Remove the decorative symbol.",
    "Reduce headline area and restore negative space."
  ],
  "confidence": 0.0
}
```

Validation requirements: - Enforce the schema and numeric bounds. -
Reject malformed output and log the failure. - Do not treat model
confidence as calibrated probability unless validated. - Require
evidence for every blocking flag. - Keep the raw evaluator response for
debugging, subject to privacy and retention policy. - Never ask the
evaluator to detect whether an image was AI-generated.

### Gate policy

Do not hard-code score thresholds before human calibration.

Initially run Design QA in **shadow mode**: - Generate and deliver
according to the existing approved process. - Record the design
evaluation. - Compare it with human ratings. - Measure false positives
and false negatives. - Tune thresholds using the golden set.

Only enable automatic blocking or retries after the owner approves
calibrated thresholds.

\---

## 8\. Revision and retry policy

A retry must correct a named defect, not simply ask the image model to
"make it better" or "make it less AI."

Examples:

* If the concept is generic: change the visual thesis, not just the
lighting.
* If the composition is crowded: remove or subordinate specific
elements.
* If the typography is weak: revise the code-rendered layout, not the
generated image.
* If the background is irrelevant: replace it with a scene tied to the
actual story.
* If the visual is misleading: remove the unsupported implication.

Recommended control flow:

1. Run technical QA and Design QA.
2. Identify the highest-impact actionable defect.
3. Determine whether it belongs to the image, composition plan, or
typography renderer.
4. Revise only the responsible stage where possible.
5. Allow no more than one automatic image-generation retry initially,
consistent with 10A.
6. Re-run the relevant checks.
7. If it still fails, follow the existing owner-approved delivery /
refund behavior. Do not loop indefinitely.

Do not regenerate the image for a typography-only defect. Re-render
typography and layout using code when possible.

\---

## 9\. Reference-first and brand-aware art direction

Continue the 10A reference-first workflow and extend it to design
references.

Support, where technically available:

* User-provided subject photographs.
* User-provided location or product photographs.
* Brand logo and approved brand assets.
* Brand palette and licensed fonts.
* Optional design references used for broad inspiration.

Rules: - Confirm the user has rights to uploaded likenesses and assets
where required. - Do not copy another creator's exact thumbnail, logo,
or distinctive protected design. - Extract broad attributes from
references (e.g. restrained editorial layout, warm palette, close crop),
not exact protected expression. - Keep the subject's identity and
important product details faithful when using reference images. - Brand
consistency must not force every thumbnail into an identical layout.

\---

## 10\. Golden-set benchmark and evaluation plan

The existing 10A golden set should be extended, not duplicated
unnecessarily.

### Initial benchmark

Start with at least 30 diverse prompts for the first engineering
experiment. Expand toward the 100+ prompt golden set specified in 10A
before broad release.

Include: - Travel and geography. - Documentary and investigative
topics. - Tutorials and educational content. - Product reviews. - News
and commentary. - Personal development. - Entertainment. -
Typographic-led topics. - Prompts with user reference images. - Prompts
with brand kits. - Prompts where a dramatic visual would be misleading.

For each prompt, generate comparable variants:

* **A:** Existing 10A pipeline.
* **B:** 10A + creative direction and composition planning.
* **C:** 10A + creative direction + composition planning + Design QA
and targeted revision.

Keep model, image settings, platform dimensions, and other variables
controlled where practical. Record unavoidable differences.

### Human evaluation

Use blind comparison where possible: reviewers should not know which
variant is A, B, or C.

Collect: - Professional design quality (1--5). - Content specificity
(1--5). - Originality (1--5). - Visual hierarchy (1--5). - Small-size
readability (1--5). - Truthfulness / misleading implication tags. -
"Would a professional designer approve this for publication?" (yes / no
/ unsure). - Short reason for the rating.

Use more than one reviewer for a meaningful subset. Measure inter-rater
agreement and document disagreements.

### Metrics

Track: - Mean and distribution of each human rating. - Pairwise
preference rate for B vs A and C vs A. - Design QA precision and recall
against human defect labels. - False-block rate. - Retry rate and retry
success rate. - Percentage of typography-only issues fixed without image
regeneration. - Generation and QA cost per kept thumbnail. - User
regenerate rate, download rate, and feedback where available.

Do not claim CTR improvement without valid platform experiment data.

### Initial experiment decision

The first benchmark is an experiment, not a release certification. Do
not ship a new automatic gate merely because the vision model gives high
scores. Human evaluation is the reference for calibrating the evaluator.

\---

## 11\. Data model and observability

Extend the existing `generation\\\_log` or equivalent rather than creating
duplicate logging systems.

Record, subject to existing privacy and retention rules:

* Original user prompt and relevant settings.
* Structured content brief.
* Creative directions considered and selected.
* Selection rationale.
* Composition plan.
* Prompt compiler version and final image prompt.
* Model/provider identifier and capability snapshot.
* Seed and relevant generation settings.
* Raw image asset identifier.
* Technical QA result.
* Design QA result and schema version.
* Cliché flags and evidence.
* Typography renderer version and layout configuration.
* Final composite asset identifier.
* Retry count and targeted revision brief.
* Human feedback / benchmark labels where available.
* Cost and timing per stage.

Use stable version identifiers for: - Brief schema. - Creative direction
library. - Cliché lexicon. - Composition planner. - Design QA rubric. -
Prompt compiler. - Typography renderer.

This is necessary to reproduce regressions and compare experiments.

\---

## 12\. Configuration proposals

Suggested files (adapt to the repository's actual conventions):

``` text
config/
  creative\\\_direction\\\_presets.yaml
  creative\\\_cliche\\\_lexicon.yaml
  design\\\_qa\\\_config.yaml

docs/
  thumbnail-creative-direction.md
  thumbnail-design-qa.md
  thumbnail-benchmark-protocol.md
```

Keep owner-editable content separate from application logic.

Example configuration shape:

``` yaml
design\\\_qa:
  mode: shadow # shadow | enforce
  schema\\\_version: "1.0"
  thresholds:
    content\\\_specificity: null
    concept\\\_strength: null
    composition\\\_hierarchy: null
    typography\\\_layout: null
    visual\\\_relevance: null
    originality: null
    restraint: null
    small\\\_size\\\_readability: null
    truthfulness: null
  max\\\_automatic\\\_image\\\_retries: 1
  require\\\_evidence\\\_for\\\_blocking\\\_flags: true

creative\\\_direction:
  enabled: true
  allow\\\_user\\\_style\\\_override: true
  avoid\\\_repeated\\\_direction\\\_when\\\_unjustified: true
  preserve\\\_user\\\_intent: true
```

All null thresholds remain uncalibrated. Do not silently replace them
with arbitrary defaults.

\---

## 13\. Implementation phases and acceptance criteria

Implement incrementally. First inspect the repository, existing plan,
architecture, model-provider abstractions, image pipeline, QA flow,
logging, and tests. Reuse existing services and conventions. Do not
assume the proposed filenames or technologies already exist.

### Phase 0 --- Repository and architecture audit

Tasks: - Locate the current 10A implementation and relevant plan
sections. - Trace prompt input through generation, rendering, QA,
billing/credits, storage, and delivery. - Identify where structured
briefs and generation logs are stored. - Identify current vision model
and JSON-schema validation approach. - Confirm whether typography is
already code-rendered. - Identify available reference-image support. -
Document gaps and propose the smallest compatible integration.

Acceptance: - Architecture map and file-level implementation plan
exist. - No duplicate service is introduced without a reason. - Existing
behavior and credit accounting are documented. - Risks and unknowns are
explicit.

### Phase 1 --- Structured content brief and creative direction

Tasks: - Add validated content-brief schema. - Add creative direction
schema and initial direction families. - Generate and select a
direction. - Persist the selected direction and rationale. - Add
deterministic fixtures and unit tests.

Acceptance: - Same input and seed can reproduce the same structured
direction where determinism is required. - Direction is tied to the
specific story. - User-selected style is respected where feasible. -
Vague prompts do not cause fabricated facts.

### Phase 2 --- Composition planning

Tasks: - Add composition-plan schema. - Translate the direction into
layout constraints. - Connect the plan to the existing prompt compiler
and renderer. - Add validation for missing text region, focal point, or
conflicting constraints.

Acceptance: - The plan identifies a focal point and visual hierarchy. -
Composition is not locked to one universal template. - Key objects,
faces, and text are not placed in conflicting regions. - Platform
configuration is sourced from verified presets.

### Phase 3 --- Cliché detection and Design QA in shadow mode

Tasks: - Add contextual cliché lexicon. - Add Design QA schema and
evaluator prompt. - Validate model output and store evidence. - Run
shadow evaluations without blocking delivery. - Collect human labels.

Acceptance: - Malformed evaluator output is handled safely. - Technical
QA and Design QA remain separately observable. - No uncalibrated Design
QA score blocks delivery. - Flags include actionable evidence and
revisions.

### Phase 4 --- Targeted revision and renderer integration

Tasks: - Route image defects to image revision. - Route layout and
typography defects to the code renderer. - Route concept defects to
creative direction / composition planning. - Add the single-retry policy
and final-composite validation. - Verify billing and credit behavior.

Acceptance: - Retry addresses a named defect. - Typography-only defects
do not trigger unnecessary image regeneration. - No unbounded retry loop
exists. - Credit and refund behavior follows owner-approved policy. -
Final composite passes existing technical checks.

### Phase 5 --- Benchmark, calibration, and controlled enforcement

Tasks: - Build the initial 30-prompt comparison. - Expand the golden set
toward 100+ prompts. - Collect blind human ratings. - Report QA
precision, recall, false positives, and false negatives. - Tune
thresholds and get owner approval before enforcement. - Add regression
tests for benchmark cases.

Acceptance: - Results compare A, B, and C under documented conditions. -
Thresholds are supported by human-labeled data. - No material regression
in existing 10A technical quality. - Release decision and known
limitations are documented.

\---

## 14\. Engineering guardrails

1. **Do not rewrite the entire thumbnail pipeline.** Integrate in
small, reviewable changes.
2. **Do not add another model or paid API by default.** First test the
current provider with the improved brief and direction.
3. **Do not hard-code unverified thresholds.** Keep them configurable
and null until calibrated.
4. **Do not use one overall LLM score as the only release gate.**
5. **Do not automatically regenerate for every warning.** Distinguish
blocking defects from subjective suggestions.
6. **Do not let the evaluator override explicit user intent without a
concrete reason.**
7. **Do not use a cliché lexicon as a ban list.** Use contextual
evaluation.
8. **Do not send title text to the image model by default.** Use the
code renderer.
9. **Do not fabricate facts, people, locations, evidence, or events.**
10. **Do not claim CTR improvements without platform experiments.**
11. **Do not claim AI-undetectability or evade platform disclosure
rules.**
12. **Preserve privacy, reference-image permissions, provenance
handling, and existing credit accounting.**
13. **Every new stage must have tests, logs, failure handling, and a
clear owner.**
14. **If a proposed technology or capability is not present in the
repository, verify it before adding it.**

\---

## 15\. Instructions for the implementation AI / coding agent

Treat this document as a proposed specification, not permission to make
broad assumptions.

Before changing code:

1. Read the complete existing `plan.md` and Section 10A.
2. Inspect the repository and identify the real generation, prompt,
rendering, QA, billing, and logging paths.
3. Produce a concise implementation map with exact file paths and
dependencies.
4. Identify conflicts between this document and the existing
architecture.
5. List questions that require product-owner decisions.
6. Propose a phased task list with tests and acceptance criteria.
7. Do not start a large refactor until the owner approves the plan,
unless the existing project instructions explicitly authorize
implementation.

During implementation:

* Follow existing language, framework, naming, validation, and testing
conventions.
* Keep changes scoped to the current phase.
* Reuse existing provider abstractions and logging.
* Add migrations only when required and explain rollback.
* Never expose API keys or secrets.
* Run relevant tests and builds after each phase.
* Report changed files, behavior changes, test results, known
limitations, and next steps.
* Do not mark a phase complete unless its acceptance criteria are met.

### Required first response from the AI agent

After reading this specification and the repository plan, the agent
should return:

1. Its understanding of the current 10A pipeline.
2. The exact architectural gap this 10B section addresses.
3. The existing files and services that should be reused.
4. The proposed Phase 0 audit findings or, if not yet inspected, the
inspection checklist.
5. Any conflicts, risks, or owner decisions required.
6. A phased implementation plan.
7. Tests and benchmark evidence required for each phase.

**Do not begin by generating code. Begin by inspecting the current plan
and repository, then propose the smallest safe implementation.**

\---

## 16\. Product-owner decisions to confirm

These decisions should be answered before the relevant implementation
phase:

* Is code-rendered typography already approved under 10A, and which
renderer is selected?
* Which platform presets are currently verified?
* Which image and vision providers are available, and what are their
structured-output capabilities and costs?
* Should Design QA initially run in shadow mode? Recommended: yes.
* Who supplies human benchmark ratings, and how many independent
reviewers are available?
* After one unsuccessful retry, should the system deliver the better
result with a warning or refund? Reuse the existing owner decision
in 10A if already made.
* What reference-image and brand-kit capabilities are actually
included in each subscription plan?
* What are the existing privacy and retention rules for prompts,
uploaded references, generated images, and QA logs?

Do not invent answers. Record unresolved decisions and continue only
with work that does not depend on them.

\---

## 17\. Definition of done

The 10B system is ready for controlled release only when:

* The existing 10A pipeline remains intact and its technical checks
still pass.
* A structured content brief, creative direction, and composition plan
are integrated.
* The direction is content-specific and not a fixed universal
template.
* Design QA runs independently from technical image QA.
* Design QA has been compared against human labels.
* Any enforced thresholds have documented calibration evidence and
owner approval.
* Typography and layout are evaluated on the final composite.
* Revisions target the responsible stage and do not cause unnecessary
image regeneration.
* Retry and credit behavior is bounded and tested.
* The golden-set comparison shows no unacceptable regression.
* Logs make the output reproducible and debuggable.
* Product claims remain honest and do not promise AI-undetectability
or unverified CTR gains.

**Final principle:** The objective is not to hide how an image was made.
The objective is to make every thumbnail feel like someone made
deliberate, content-specific design decisions.


**Known source conflict (YouTube):** older and many third-party pages say 1280×720, 16:9, min width 640, max 2 MB. Some pages checked in Nov 2026 say YouTube's Help Center now recommends 3840×2160 (Shorts 2160×3840), with a 2 MB limit from a phone and 50 MB from a computer. **Do not pick one.** Read the official page, record the answer, and make export produce a primary file at the preset resolution plus a ≤2 MB JPG fallback.

Other platforms: no verified values yet. All `null` until verified.

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
- **P10. Platform specs conflict and change** (YouTube is the known case, Appendix A.3). Never hard-code dimensions or size limits. Read them from the verified preset file.
- **P11. "Slop" advice is mostly vendor marketing.** Treat every tactic in 10A as a hypothesis until the golden set shows it helps.
- **P12. AI-detection by an LLM is unreliable.** The QA gate checks concrete defects only (10A.7).
- **P13. Re-encoding can strip provenance metadata.** Report it; do not assume (10A.9).

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

### Phase 5.5: Anti-slop quality system (Section 10A)
- Platform preset config and exporter (10A.11); brief compiler with schema validation and style presets (10A.2); composition and typography rules (10A.3–10A.4); deterministic QA checks and the vision-LLM rubric (10A.7); golden set and evaluation script (10A.10).
- **Acceptance:** golden set of at least 100 prompts exists with human ratings; QA thresholds are calibrated and precision and recall are reported; the full pipeline run on the golden set is compared against a "no compiler, no gate" baseline and the report shows whether each tactic helped, with no claim the data does not support.

### Phase 6: Website and UI
- Pricing page generated from plan config; generation screen with style presets, platform picker, safe-zone overlay and small-size preview (10A.3); waiting UX; gallery; error states (Section 10).
- **Acceptance:** pricing page values match config exactly (snapshot test); every claim on the page maps to a verified capability.

### Phase 7: Optional, only with owner approval
- Text overlay with a server-side renderer (Satori, Sharp or Canvas: confirm which exist in the stack), so titles are exact and AI is used only for imagery. **Section 10A.4 strongly recommends this; if the owner approves it, build it before Phase 5.5.** Smart-crop from one 16:9 master to other aspect ratios. OCR check if text is AI-rendered. Batch mode for non-urgent jobs.

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
- **Margin guard:** fails when a mode exceeds 35% cost-to-revenue, including retry and QA cost.
- **Brief compiler:** output validates against the JSON schema; invalid LLM output is rejected and retried at most once; user-typed words are never removed; same seed gives the same prompt.
- **Typography:** contrast check auto-adds stroke or scrim when below threshold; text never overlaps detected faces; banned effects cannot be selected.
- **QA gate:** exactly one auto-retry, never a loop; retry is not charged; refund or deliver-better-of-two behavior matches the owner's answer to Q12.
- **Platform export:** output dimensions and file size satisfy the verified preset; the ≤2 MB fallback exists where the preset requires it.

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
11. Approve code-rendered text overlay as a core feature (10A.4)? Recommended: yes.
12. When the QA gate fails twice: deliver the better of two with a flag, or refund the credits?
13. Which style presets ship at launch (10A.2), and which fonts are allowed (license-checked)?
14. Which vision-LLM and text-LLM (via the provider) are approved for briefs and QA, and what is the monthly budget for those calls?
15. Should QA run on every Starter output, or only a sample (cost vs. quality)?

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

## Appendix A.2: Quality heuristics (UNVERIFIED hypotheses; test on the golden set)

From third-party blogs, mostly vendors of image or thumbnail tools (Aug to Nov 2026):
- Viewer-noticed tells: poreless symmetric skin, identical catchlights in both eyes, shadowless even lighting, centered symmetric camera-aware expressions, overly clean or generically blurred backgrounds (Miraflow).
- Prompt moves reported to help: name the imperfection, break symmetry, specify one real light source and direction, add one small real-world background detail. Saying "realistic" alone reportedly does not work (Miraflow).
- Generic prompts make models fall back on the most common training patterns, such as a centered subject with balanced elements. Better models produce higher-fidelity generic images (imagine.art).
- Design tells: gold 3D text, neon gradients, sparkles, cluttered layout with no hierarchy (mikareyes.com).
- Plastic skin and over-polished glossy textures (upsampler.com, ai.it-s.com).
- Layout: keep key content in the center ~80%; the YouTube duration badge sits bottom-right (postfa.st, screensnap.pro); headline minimum 60–80px on a 1280×720 canvas (a third-party guide).
- A vendor statistic claims AI-looking thumbnails cut CTR by 23% (rewarx.com). **Unverified marketing; do not use in copy.**

## Appendix A.3: YouTube thumbnail spec conflict (verify against the official Help Center)

| Claim | Where it appears |
|---|---|
| 1280×720, 16:9, min width 640, max 2 MB, JPG/PNG/GIF/BMP | many third-party guides (long-standing) |
| 3840×2160 for videos, 2160×3840 for Shorts, 2 MB from phone, 50 MB from computer; Shorts thumbnails set on computer in Studio | two third-party pages that say they checked the Help Center in Nov 2026 |
| 50 MB support rolling out for TV-optimized thumbnails | one third-party spec page |

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
- [ ] Platform presets contain only verified values; the YouTube conflict is resolved from the official page.
- [ ] Golden set exists; QA thresholds calibrated with reported precision and recall; baseline comparison documented.
- [ ] No marketing copy claims "undetectable as AI" or cites unverified statistics.
- [ ] Provenance-metadata behavior reported in `docs/VERIFICATION.md`.
