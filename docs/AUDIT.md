# Phase 0 Audit Report (`docs/AUDIT.md`)

> **Date:** November 11, 2026  
> **Scope:** Full repository audit of `d:\ThumbGen.ai` against `PLAN.md` (Sections 1–15). No application code was modified in this phase.

---

## 1. Existing Stack & Infrastructure Identification

### 1.1 Language, Runtime, and Package Manager
- **Language:** TypeScript (`typescript: "^5.9.3"` in `server/package.json#L41`; TypeScript project configs in `server/tsconfig.json#L1-L19`, `client/tsconfig.json`, `client/tsconfig.app.json`, `client/tsconfig.node.json`).
- **Module System:** ES Modules (`"type": "module"` in both `server/package.json#L5` and `client/package.json#L5`).
- **Runtime:** Node.js `>=20.0.0` (`server/package.json#L13-L15`), using `tsx` (`^4.21.0`) to execute `.ts` entrypoints directly (`server/package.json#L7-L9`, `server/package.json#L40`).
- **Package Manager:** `npm` with separate lockfiles in `server/package-lock.json` and `client/package-lock.json` (no root `package.json` or monorepo workspace config).

### 1.2 Backend Framework & Server Entrypoints
- **Web Framework:** Express 5 (`express: "^5.2.1"` in `server/package.json#L32`), initialized in `server/server.ts#L1-L113`.
- **Worker Entrypoint:** Standalone BullMQ worker process started via `server/workerProcess.ts#L1-L22` (`npm run worker` in `server/package.json#L9`), which imports `server/workers/thumbnailWorker.ts#L1-L496`.

### 1.3 Frontend Framework
- **Framework & Build Tool:** React 19 (`react: "^19.1.0"`, `react-dom: "^19.1.0"`) with Vite 7 (`vite: "^7.1.2"`) and `@vitejs/plugin-react: "^5.0.0"` (`client/package.json#L21-L22`, `client/package.json#L33`, `client/package.json#L38`, `client/vite.config.ts`).
- **Routing & HTTP:** `react-router-dom: "^7.8.2"` (`client/src/App.tsx#L1-L51`) and `axios: "^1.13.2"` configured with `withCredentials: true` (`client/src/configs/api.ts#L1-L8`).
- **Styling & UI Libraries:** Tailwind CSS v4 (`tailwindcss: "^4.1.13"`, `@tailwindcss/vite: "^4.1.13"`), `motion: "^12.23.12"`, `lucide-react: "^0.542.0"`, `react-hot-toast: "^2.6.0"`, `lenis: "^1.3.11"`, `@dicebear/core` & `@dicebear/collection` (`client/package.json#L14-L26`).

### 1.4 Database & ODM
- **Database:** MongoDB connected via `mongoose: "^9.0.2"` (`server/package.json#L35`, `server/configs/db.ts#L1-L12`).
- **Existing Mongoose Models:**
  1. `User` (`server/models/User.ts#L1-L42`): `name`, `email`, `password`, `channelName`, `avatar`, `plan` (`"none" | "starter" | "creator" | "pro"`), `credits` (`Number`, default `0`), `totalCredits` (`Number`, default `0`), `timestamps: true`.
  2. `Thumbnail` (`server/models/Thumbnail.ts#L1-L130`): `userId`, `title`, `description`, `style`, `aspect_ratio`, `color_scheme`, `resolution` (`"2k" | "4k"`), `youtube_reference_url`, `platform`, `text_overlay`, `image_url`, `prompt_used`, `user_prompt`, `isGenerating`, `error`, `editedFrom`, `edit_instructions`, `timestamps: true`. Indexed on `{ userId: 1, createdAt: -1 }` and `{ isGenerating: 1, image_url: 1 }` (`server/models/Thumbnail.ts#L123-L124`).
  3. `Payment` (`server/models/Payment.ts#L1-L41`): `userId`, `orderId` (unique), `paymentSessionId`, `plan` (`"starter" | "creator" | "pro"`), `amount`, `currency` (`"USD"`), `status` (`"pending" | "paid" | "failed"`), `dodoPaymentId`, `timestamps: true`.
  4. `Otp` (`server/models/Otp.ts#L1-L25`): `email`, `otp`, `name`, `password`, `expiresAt` (TTL index), `timestamps: true`.

### 1.5 Authentication & Sessions
- **Session Store:** `express-session: "^1.18.2"` backed by `connect-redis: "^9.0.0"` using `redis: "^5.11.0"` client (`server/server.ts#L5-L8`, `server/server.ts#L33-L82`). Note: `connect-mongo: "^6.0.0"` is still listed in `server/package.json#L27` but unused.
- **Auth Mechanism:** Email/password login (`bcrypt: "^6.0.0"`) plus 6-digit email OTP verification sent via Brevo (`@getbrevo/brevo: "^3.0.1"`) (`server/controllers/AuthControllers.ts#L1-L251`, `server/configs/brevo.ts#L1-L48`, `server/routes/AuthRoutes.ts#L1-L28`).
- **Auth Middleware:** `protect` checks `req.session.isLoggedIn` and `req.session.userId` (`server/middlewares/auth.ts#L1-L13`).

### 1.6 Payments
- **Active Backend Provider:** Dodo Payments (`dodopayments: "^2.25.1"`) with `standardwebhooks: "^1.0.0"` signature verification (`server/package.json#L30`, `server/package.json#L39`, `server/configs/dodo.ts#L1-L34`, `server/controllers/PaymentController.ts#L1-L221`, `server/routes/PaymentRoutes.ts#L1-L21`).
- **Legacy/Unused Provider Remains:** Cashfree (`cashfree-pg: "^5.1.0"` in `server/package.json#L25`, `server/configs/cashfree.ts#L1-L34`, and `@cashfreepayments/cashfree-js: "^1.0.5"` in `client/package.json#L13`).
- **Broken Client Payment Flow on Profile Page:** `client/src/sections/PricingSection.tsx#L33-L41` redirects to `data.checkoutUrl` (Dodo Payments), which matches `server/controllers/PaymentController.ts#L65-L69`. However, `client/src/pages/Profile.tsx#L20` and `client/src/pages/Profile.tsx#L159-L179` still invoke `@cashfreepayments/cashfree-js` expecting `data.paymentSessionId`, which `createOrder` no longer returns.

### 1.7 Queue, Workers & Real-Time Delivery
- **Queue Library:** BullMQ (`bullmq: "^5.66.4"`) using `ioredis: "^5.8.2"` (`server/configs/redis.ts#L1-L23`).
- **Queue Config:** Single queue `"thumbnail-generation"` in `server/queues/thumbnailQueue.ts#L24-L38` configured with `attempts: 3`, exponential backoff (`delay: 5000`), `removeOnComplete: { count: 10, age: 3600 }`, `removeOnFail: { count: 10, age: 86400 }`.
- **Worker Config:** `server/workers/thumbnailWorker.ts#L467-L486` runs with `concurrency: 5`, `drainDelay: 10`, `stalledInterval: 60_000`, `lockRenewTime: 20_000`, `lockDuration: 30_000`.
- **Real-Time Delivery:** Worker publishes to Redis channel `thumbnail:complete:${thumbnailId}` (`server/workers/thumbnailWorker.ts#L19-L27`, `server/workers/thumbnailWorker.ts#L310-L314`, `server/workers/thumbnailWorker.ts#L446-L449`). `GET /api/sse/thumbnail/:id` in `server/routes/SSERoutes.ts#L1-L155` subscribes via a shared `ioredis` subscriber and pushes SSE events to `client/src/pages/Generate.tsx#L301-L383` (which falls back to 4s polling on timeout/error).

### 1.8 Storage & Image Processing
- **Image Processing:** `sharp: "^0.34.5"` (`server/package.json#L38`) used in `server/workers/thumbnailWorker.ts#L39-L66` for compositing `server/assets/logo.png` as a watermark and converting buffers to WebP (`quality: 90`) (`server/workers/thumbnailWorker.ts#L284`, `server/workers/thumbnailWorker.ts#L412`).
- **Object / CDN Storage:** Cloudinary (`cloudinary: "^2.8.0"`, `server/configs/cloudinary.ts#L1-L10`). Worker streams the WebP buffer to folder `thumbgen` (`server/workers/thumbnailWorker.ts#L285-L296`, `server/workers/thumbnailWorker.ts#L414-L429`) and stores `uploadResult.secure_url` directly in `Thumbnail.image_url`.

### 1.9 Hosting & Deployment Configurations
- **Client:** `client/vercel.json#L1-L8` (Vercel SPA rewrite).
- **Server:**
  - `server/vercel.json#L1-L18` routes all requests to `server.ts` via `@vercel/node`.
  - `server/railway.json#L1-L11` and `server/railway.worker.json#L1-L11` both specify `"startCommand": "npm run worker"` with Nixpacks.

### 1.10 Test Setup
- **None exists.** Neither `server/package.json#L6-L12` nor `client/package.json#L6-L11` defines a `test` script or installs a test framework, and no `*.test.*` or `*.spec.*` files exist in the repository.

### 1.11 Environment Variables Configured in `server/.env` (Names Only, Per Rule R9)
- Present and non-empty in `server/.env`: `SESSION_SECRET`, `MONGODB_URI`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDINARY_URL`, `NODE_ENV`, `REDIS_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_CREATOR`, `DODO_PRODUCT_PRO`, `CLIENT_URL`.
- Missing: No `.env.example` exists in `server/` or `client/` (required by Rule R9).

---

## 2. Existing Generation Code & Hard-Coded Model IDs

### 2.1 How Current Provider Calls Are Made
1. **Grok (xAI) — used for 2K generation without reference image (`server/workers/thumbnailWorker.ts#L103-L129`, `#L396-L399`):**
   - Uses the `openai` npm package (`^6.33.0`) configured in `server/configs/xai.ts#L1-L8` with `baseURL: "https://api.x.ai/v1"` and `apiKey: process.env.XAI_API_KEY`.
   - Calls `xai.images.generate({ model, prompt, aspect_ratio: aspectRatio || "16:9", response_format: "b64_json", n: 1 })` (`server/workers/thumbnailWorker.ts#L115-L122`).
   - **Critical Finding:** Both branches of the ternary in `server/workers/thumbnailWorker.ts#L108-L111` select `"grok-imagine-image-quality"`, which `PLAN.md` Section 11 (P1) notes was reported retired on 2026-11-02. No explicit pixel dimensions or resolution parameters are passed.
2. **OpenRouter (Gemini 3.1 Flash Image Preview) — used for 4K generation without reference image (`server/workers/thumbnailWorker.ts#L132-L169`, `#L393-L395`):**
   - Calls `fetch("https://openrouter.ai/api/v1/chat/completions", ...)` directly with `Authorization: Bearer ${process.env.OPENROUTER_API_KEY}` (`server/workers/thumbnailWorker.ts#L138-L149`). Note: `server/configs/openRouter.ts#L1-L8` defines an `OpenAI` SDK instance for OpenRouter that is imported in `server/workers/thumbnailWorker.ts#L8` but never called.
   - Request body sends only `{ model: "google/gemini-3.1-flash-image-preview", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }` (`server/workers/thumbnailWorker.ts#L144-L148`).
   - **Critical Finding:** The `aspectRatio` argument (`server/workers/thumbnailWorker.ts#L134`) is completely ignored and never sent to OpenRouter, nor is any 4K resolution/size parameter sent.
3. **Google GenAI SDK (Gemini 3 Pro Image Preview) — used for Reference Image generation and Image Editing (`server/workers/thumbnailWorker.ts#L248-L260`, `#L361-L375`):**
   - Uses `@google/genai` (`^1.34.0`) initialized in `server/configs/ai.ts#L1-L7` with `process.env.GEMINI_API_KEY`.
   - Calls `ai.models.generateContent({ model: "gemini-3-pro-image-preview", contents: [...], config: { responseModalities: ["TEXT", "IMAGE"] } })` passing base64 `inlineData` and text prompt.
   - Neither call passes explicit output resolution or aspect ratio parameters in `config` (aspect ratio is only mentioned in the prompt string at `server/workers/thumbnailWorker.ts#L347`, and omitted in edit prompts at `server/workers/thumbnailWorker.ts#L246`).

### 2.2 Complete Inventory of Hard-Coded Model IDs and Provider Labels
| Model ID / Provider String | File & Line | Context |
|---|---|---|
| `"grok-imagine-image-quality"` | `server/workers/thumbnailWorker.ts#L110` | Active model ID for `creator` / `pro` 2K generation |
| `"grok-imagine-image-quality"` | `server/workers/thumbnailWorker.ts#L111` | Active model ID for `starter` 2K generation |
| `"grok-imagine-image"` / `"grok-imagine-image-pro"` | `server/workers/thumbnailWorker.ts#L100-L101` | Code comments above `generateWithGrok` |
| `"google/gemini-3.1-flash-image-preview"` | `server/workers/thumbnailWorker.ts#L131`, `#L136`, `#L145` | Active model ID for 4K generation via OpenRouter |
| `"gemini-3-pro-image-preview"` | `server/workers/thumbnailWorker.ts#L249` | Active model ID for thumbnail editing via `@google/genai` |
| `"gemini-3-pro-image-preview"` | `server/workers/thumbnailWorker.ts#L362` | Active model ID for reference-image generation via `@google/genai` |
| `"Grok AI — standard or pro model by plan"` | `client/src/components/ResolutionSelector.tsx#L22` | Client UI option description (violates Section 5 rule against exposing provider strings) |
| `"Imagen 4.0 — highest quality"` | `client/src/components/ResolutionSelector.tsx#L31` | Client UI option description (inaccurate and exposes provider model name) |
| `grok-imagine-image`, `grok-imagine-image-pro`, `imagen-4.0-ultra-generate-exp-05-20`, `Gemini 3 Pro` | `docs/grok-api-research.md#L27-L29`, `#L153`, `#L194`, `#L213-L214` | Research documentation |
| `Imagen 4.0`, `Gemini` | `README.md#L11`, `#L27`, `#L60` | Repository README |

---

## 3. What Is Missing for Sections 4–10 of `PLAN.md`

### Section 4: Target Architecture & Provider Interface
- **Missing unified provider interface:** Provider calls are inline in `server/workers/thumbnailWorker.ts#L103-L169`, `#L248-L260`, `#L361-L375`. There is no `providers/<name>` adapter directory or `generate({ mode, prompt, aspectRatio, resolution, referenceImages?, seed? }) -> { assetBytesOrUrl, meta }` contract.
- **Missing response metadata capture:** `latency_ms`, `billed_cost_usd`, `request_params`, `resolution_actual`, and `upscaled` are never extracted or recorded (`server/workers/thumbnailWorker.ts#L115-L169`).
- **Storage discrepancy:** `PLAN.md` Section 4 diagram shows `Object storage (R2/S3) -> CDN (signed URLs)`, whereas the repo uses **Cloudinary** (`server/configs/cloudinary.ts#L1-L10`, `server/workers/thumbnailWorker.ts#L414-L429`) with public `secure_url` strings.

### Section 5: Model Registry and Pricing Config
- **Missing registry & snapshot:** No `config/` directory, no `config/models.snapshot.json`, no `scripts/discover-models.*`, and no registry schema/validator exist.
- **Missing startup validation:** Server boots without checking for `null` config values, `verified_at` staleness (>30 days), `license_checked: true`, or preview model fallback candidates (`server/server.ts#L1-L113`, `server/workerProcess.ts#L1-L22`).

### Section 6: Modes, Credits, Plan Access, Margin Guard & 4K Rule
- **Missing Mode abstraction:** Users currently pick `resolution` (`"2k"` or `"4k"`) (`client/src/pages/Generate.tsx#L56`, `server/controllers/ThumbnailController.ts#L34`) rather than a mode (`fast`, `standard`, `premium`, `ultra`, `auto`).
- **Credit pricing mismatch:** `server/controllers/ThumbnailController.ts#L19-L21` hard-codes `CREDITS_PER_THUMBNAIL = 5`, `CREDITS_WITH_REFERENCE_IMAGE = 15`, `CREDITS_PER_EDIT = 5` instead of mode-weighted credits (`Fast: 1, Standard: 2, Premium: 3, Ultra: 5` in `PLAN.md` Section 6).
- **Plan access mismatch on 4K:** `server/controllers/ThumbnailController.ts#L52-L56` and `client/src/pages/Generate.tsx#L75`, `#L544` restrict `"4k"` to `user.plan === "pro"` only, whereas `PLAN.md` Section 2 & Section 6 state both **Creator and Pro** get up to 4K (`client/src/data/pricing.ts#L18` also advertises `"Ultra 4K Quality"` for Creator!).
- **Missing Margin Guard:** No script or test checks `estimated_cost_usd / (credits * 0.145) <= 0.35`.
- **Unverified 4K output:** `generateWithOpenRouter` (`server/workers/thumbnailWorker.ts#L132-L169`) does not request 4K dimensions or verify output pixel dimensions with `sharp(finalBuffer).metadata()`, nor is there a verified upscaler step.

### Section 7: Data Model
- **`users` (`server/models/User.ts#L1-L42`):** Missing `plan_purchased_at`. Also `server/controllers/PaymentController.ts#L257` assigns `user.plan = "free"` which violates the Mongoose enum `["none", "starter", "creator", "pro"]` at `server/models/User.ts#L31`.
- **`credit_ledger`:** **Completely missing.** Credits are mutated directly via `$inc: { credits: -creditsRequired }` in `server/workers/thumbnailWorker.ts#L306-L308`, `#L439-L441` and `$inc: { credits: planDetails.credits }` in `server/controllers/PaymentController.ts#L125-L128`, `#L202-L206`.
- **`jobs` (`Thumbnail` model in `server/models/Thumbnail.ts#L1-L130`):** Uses `isGenerating: Boolean` instead of `status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'`, and is missing `mode`, `credits_reserved`, `attempts`, `provider`, `model_id`, `error_code`, `started_at`, `finished_at`.
- **`assets`:** **Completely missing.** Only a single `image_url: String` exists on `Thumbnail` (`server/models/Thumbnail.ts#L27`). No tracking of `storage_key`, `variant` (`original | watermarked | preview_webp`), `width`, `height`, `upscaled`, `bytes`.
- **`generation_log`:** **Completely missing.** No cost/latency telemetry collection exists.

### Section 8: API Surface, Atomic Credit Reservation & Idempotency
- **No atomic credit reservation at job creation (Critical Race Condition):** `generateThumbnail` (`server/controllers/ThumbnailController.ts#L84-L137`) and `editThumbnail` (`server/controllers/ThumbnailController.ts#L161-L216`) only read `if (user.credits < creditsRequired)` and do **not** reserve/deduct credits when enqueueing. Deduction happens only after the worker finishes (`server/workers/thumbnailWorker.ts#L306-L308`, `#L439-L441`). A user with 5 credits can fire 50 parallel requests and all 50 will pass the check, enqueue, run AI calls, and drive `user.credits` deeply negative!
- **No `Idempotency-Key` support:** `POST /api/thumbnail/generate` (`server/controllers/ThumbnailController.ts#L23`) does not check or enforce an `Idempotency-Key` header.
- **Payment race condition:** If Dodo webhook (`server/controllers/PaymentController.ts#L194-L208`) and client `verifyPayment` (`server/controllers/PaymentController.ts#L102-L131`) run concurrently before `payment.save()` completes, non-atomic read-modify-save can double-grant credits.
- **Missing endpoints / features:**
  - `GET /api/credits` (balance + recent ledger) does not exist.
  - `POST /api/uploads` (dedicated reference image upload with MIME/size/dimension validation and EXIF stripping) does not exist; currently base64 data URLs up to 20MB are posted directly in JSON to `/api/thumbnail/generate` (`server/server.ts#L84`, `client/src/pages/Generate.tsx#L134-L138`, `#L178-L180`).
  - Current routes use `/api/thumbnail/*`, `/api/user/*`, `/api/sse/thumbnail/:id` (`server/server.ts#L99-L104`) rather than `/api/jobs`, `/api/jobs/:id`, `/api/jobs/:id/events`.

### Section 9: Worker Pipeline, Watermark Security & Concurrency Controls
- **BullMQ retry vs. same-mode candidate fallback:** `server/queues/thumbnailQueue.ts#L27-L31` sets BullMQ `attempts: 3` on the whole job, and `server/workers/thumbnailWorker.ts#L453-L463` throws on any error (including 4xx content policy rejections) without classifying retryable vs. non-retryable errors or walking ordered mode candidates.
- **Un-watermarked original vs. Starter watermark rule:** `server/workers/thumbnailWorker.ts#L404-L429` overwrites `finalBuffer` with the watermarked image for `starter` before uploading a single public WebP to Cloudinary. While Starter users do not get an un-watermarked image, originals are not persisted separately for non-Starter or internal storage, `preview_webp` variants and crops are not generated, and Cloudinary URLs are public (`secure_url`) rather than signed URLs.
- **Missing concurrency controls:**
  - No per-provider concurrency limiter (`server/workers/thumbnailWorker.ts#L472` only has global worker `concurrency: 5`).
  - No per-user concurrent job caps by plan (Starter 2, Creator 4, Pro 6).
  - No circuit breaker per provider/model.
  - Priority queue (`Pro=1, Creator=2, Starter=3` in `server/controllers/ThumbnailController.ts#L128`) has no starvation guard.

### Section 10: Website and UI Requirements
- **Pricing drift & hand-written copy:** Pricing is hand-coded separately in `server/configs/dodo.ts#L15-L34`, `server/configs/cashfree.ts#L17-L33`, `client/src/data/pricing.ts#L3-L37`, `client/src/pages/Profile.tsx#L55-L101`, `client/src/pages/MarketComparison.tsx#L16`, and `README.md#L230-L235`.
- **Unverified testimonials & marketing claims (Rule R2 / Section 10):**
  - `client/src/data/testimonial.ts#L3-L32` contains 4 hardcoded testimonials (`Rahul Sharma`, `Chris Walker`, `Priya Desai`, `Liam Brooks`) with specific claims (`"my CRT went from 4% to 8.5% overnight!"`) using Unsplash stock avatars.
  - `client/src/sections/HeroSection.tsx#L153-L154` claims `"Start With 25 Credits"` and `"No Credit Card Required"`, which is not enabled in the app.
  - `client/src/pages/MarketComparison.tsx#L16` claims `"Starts at $9.00"` and `Forces Watermark: "No"` (false for Starter plan).
  - `client/src/data/pricing.ts#L18` claims `"Ultra 4K Quality"` for Creator plan, which the server currently blocks (`server/controllers/ThumbnailController.ts#L52-L56`).

---

## 4. Risks & Stop-and-Ask Triggers Identified

1. **Server vs. Plan Pricing & Credits Conflict (Stop-and-Ask Trigger — Section 14):**
   - `PLAN.md` Section 2 & `client/src/data/pricing.ts#L3-L37` state: Starter = **$6 / 25 credits**, Creator = **$29 / 200 credits**, Pro = **$59 / 400 credits**.
   - `server/configs/dodo.ts#L15-L34` charges/grants: Starter = **$9 / 25 credits**, Creator = **$29 / 200 credits**, Pro = **$59 / 800 credits**.
   - Changing `server/configs/dodo.ts` affects payment amounts and credit grants for customers.
2. **Existing Feature Not Covered by Section 6 Mode Table:**
   - The app currently supports **Reference Image + YouTube Thumbnail Reference** costing **15 credits** (`server/controllers/ThumbnailController.ts#L20`, `#L73-L75`) and **Thumbnail Editing** (`/api/thumbnail/edit`, costing **5 credits**, `server/controllers/ThumbnailController.ts#L21`, `#L144-L221`). We must confirm how reference-image jobs and edit jobs map onto the new modes (`fast`, `standard`, `premium`, `ultra`) and credit costs.
3. **Storage Provider (Cloudinary vs. R2/S3):**
   - The repo uses **Cloudinary** (`server/configs/cloudinary.ts#L1-L10`, `server/workers/thumbnailWorker.ts#L414-L429`), whereas `PLAN.md` Section 4 mentions `Object storage (R2/S3)`. Per Rule R6 ("Detect the existing stack in Phase 0 and keep it"), we should confirm keeping Cloudinary (with private/authenticated delivery or signed URLs for Starter protection) vs. switching storage.
4. **API Route Compatibility:**
   - Existing frontend calls `/api/thumbnail/generate`, `/api/thumbnail/edit`, `/api/thumbnail/status/:id`, `/api/user/thumbnails`, `/api/user/thumbnail/:id`, and `/api/sse/thumbnail/:id` (`server/server.ts#L99-L104`, `client/src/pages/Generate.tsx#L182`, `#L231`, `#L258`, `#L303`). `PLAN.md` Section 8 says: *"API surface (internal; confirm routing style with the existing app)"*.
5. **Retired & Unverified Model IDs in Production Code:**
   - `"grok-imagine-image-quality"` (`server/workers/thumbnailWorker.ts#L110-L111`) is retired per Pitfall P1, and `"google/gemini-3.1-flash-image-preview"` (`server/workers/thumbnailWorker.ts#L145`) is called without aspect ratio or 4K size parameters.

---

## 5. Proposed File-Level Change List (Phases 1–8)

### Phase 1: Discovery and Registry
- `server/scripts/discover-models.ts` *(new)*: Query enabled provider model-list endpoints (OpenRouter, etc.) and write `server/config/models.snapshot.json`.
- `server/config/models.snapshot.json` *(new)*: Committed snapshot of discovered models, pricing, sizes, and modalities.
- `server/config/registry.json` (or `.yaml`) *(new)*: Single source of truth for providers, modes (`fast`, `standard`, `premium`, `ultra`), credits, plan rules, and candidate models (with `null` + `TODO(verify)` for any unverified fields per Rule R3).
- `server/configs/registryValidator.ts` *(new)*: Schema + startup validator (fails prod boot on `null`, unknown `model_id`, stale `verified_at` > 30 days, `license_checked: false`, or preview models without fallback).
- `server/scripts/margin-guard.ts` *(new)*: Enforces `estimated_cost_usd / (credits * 0.145) <= 0.35` across all modes.
- `server/.env.example` & `client/.env.example` *(new)*: Env variable names only (Rule R9).
- `docs/VERIFICATION.md` *(update)*: Track all remaining unverified items.

### Phase 2: Provider Adapter Layer
- `server/providers/types.ts` *(new)*: Unified `generate()` interface and `GenerationMeta` types.
- `server/providers/openrouter.ts` *(new)*: OpenRouter Image/Chat adapter with explicit per-model size/aspect-ratio mapping and cost/usage extraction.
- `server/providers/xai.ts` & `server/providers/google.ts` *(new, if retained as direct adapters)* or routed via OpenRouter/fal per owner decision.
- `server/providers/mock.ts` *(new)*: Deterministic mock adapter for tests and dev mode.
- `server/tests/providers/*.test.ts` *(new)*: Unit & contract tests for parameter mapping, error classification, and explicit size enforcement.

### Phase 3: Credits and Jobs Core
- `server/models/CreditLedger.ts` *(new)*: Append-only ledger model (`user_id`, `delta`, `type`, `job_id`, `idempotency_key` unique, `created_at`).
- `server/models/User.ts` *(modify)*: Add `plan_purchased_at`, enforce integer credit checks.
- `server/models/Thumbnail.ts` *(modify)*: Add `mode`, `status` enum, `credits_reserved`, `attempts`, `provider`, `model_id`, `error_code`, `idempotency_key`, `started_at`, `finished_at`, `resolution_actual`, `upscaled`, and asset variants.
- `server/models/GenerationLog.ts` *(new)*: Telemetry model (`job_id`, `provider`, `model_id`, `latency_ms`, `billed_cost_usd`, `request_params`, `outcome`).
- `server/services/creditService.ts` *(new)*: Transactional/atomic credit `grant`, `reserve`, `commit`, `refund`, `adjust` with idempotency keys.
- `server/controllers/ThumbnailController.ts` & `server/controllers/PaymentController.ts` *(modify)*: Enforce server-side plan limits (Creator & Pro 4K access, reference images), `Idempotency-Key` header, atomic credit reservation before enqueueing, and atomic idempotent webhook credit grants.
- `server/routes/UserRoutes.ts` / `server/routes/ThumbnailRoutes.ts` *(modify)*: Add `GET /api/credits` and `POST /api/uploads` (EXIF stripping & validation via `sharp`).
- `server/tests/credits/*.test.ts` *(new)*: 50-parallel spend test, idempotency test, refund test, webhook replay test, integer math test.

### Phase 4: Queue and Workers
- `server/queues/thumbnailQueue.ts` *(modify)*: Adjust BullMQ retry settings so candidate-level retry (max 1 retry with exponential backoff + jitter) and same-mode fallback are controlled by the worker pipeline, with starvation guard on priorities.
- `server/workers/thumbnailWorker.ts` *(modify)*: Integrate registry resolution, per-provider concurrency limiter, per-user active job caps, circuit breaker, candidate fallback (equal-or-lower cost within mode), non-retryable 4xx/policy failure handling, credit commit on success, and automatic credit refund on final failure.
- `server/tests/worker/*.test.ts` *(new)*: Chaos tests (429, 5xx, timeout, worker crash recovery, no double charges).

### Phase 5: Post-Processing and Storage
- `server/services/storageService.ts` & `server/workers/thumbnailWorker.ts` *(modify)*: Verify actual pixel dimensions via `sharp`, persist `original`, `watermarked` (for Starter), and `preview_webp` variants, record `resolution_actual` and `upscaled`, and ensure Starter users can never obtain an un-watermarked URL.
- `server/tests/storage/*.test.ts` *(new)*: Watermark isolation test and `resolution_actual` verification test.

### Phase 6: Website and UI
- `client/src/data/pricing.ts`, `client/src/sections/PricingSection.tsx`, `client/src/pages/Profile.tsx`, `client/src/pages/MarketComparison.tsx` *(modify)*: Drive all pricing/plan copy from shared plan config; fix `Profile.tsx` payment checkout to use Dodo `checkoutUrl`; replace unverified testimonials/claims with verified facts or `{{TESTIMONIAL_PLACEHOLDER}}`.
- `client/src/pages/Generate.tsx` & `client/src/components/ModeSelector.tsx` *(new/modify)*: Replace raw provider resolution labels with Mode picker (`Fastest`, `Standard`, `Premium`, `Ultra`, `Auto`), show live credit cost before submit, send `Idempotency-Key`, and map `error_code` to human-readable messages showing `"credits refunded"`.
- `client/src/pages/MyGeneration.tsx` *(modify)*: Serve small `preview_webp` in gallery and fetch full resolution only on download.
- `client/src/tests/*.test.tsx` *(new)*: Pricing config snapshot test.

### Phase 7 (Optional, Owner Approval Only) & Phase 8: Hardening
- Text overlay renderer (`sharp`/SVG), smart-crop, batch mode (if approved in Phase 7).
- Rate limiting, daily USD spend cap + kill switch, load test script & report (`docs/BENCHMARK.md`, Phase 8).

