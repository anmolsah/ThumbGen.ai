# ThumbGen.ai — Hybrid AI Model Strategy & Social Media Support

> A comprehensive plan for using **Google Imagen Ultra** for premium 4K generation and **xAI Grok Imagine** for fast 2K generation, plus social media platform-specific thumbnail support.

---

## Table of Contents

1. [Model Strategy Overview](#1-model-strategy-overview)
2. [Grok Models — Fast Generation (2K)](#2-grok-models--fast-generation-2k)
3. [Google Imagen Ultra — Premium Generation (4K)](#3-google-imagen-ultra--premium-generation-4k)
4. [Resolution Tiers & User Experience](#4-resolution-tiers--user-experience)
5. [API Integration (Node.js)](#5-api-integration-nodejs)
6. [Social Media Platform Support](#6-social-media-platform-support)
7. [Cost Analysis](#7-cost-analysis)
8. [Migration & Implementation Plan](#8-migration--implementation-plan)
9. [Recommendation](#9-recommendation)

---

## 1. Model Strategy Overview

ThumbGen.ai uses a **dual-provider hybrid approach** — fast generation via Grok and premium quality via Google Imagen Ultra.

| Quality Tier | Provider | Model | Speed | Best For |
|---|---|---|---|---|
| **2K (Fast)** | xAI Grok | `grok-imagine-image` | **3–8 sec** | Quick iterations, everyday thumbnails |
| **2K (Fast Pro)** | xAI Grok | `grok-imagine-image-pro` | **5–12 sec** | Higher quality fast generation |
| **4K (Premium)** | Google | Imagen 4.0 Ultra | **30–45 sec** | Maximum quality, photorealistic output |

> [!IMPORTANT]
> When a user selects **2K resolution** → Grok handles it (fast).  
> When a user selects **4K resolution** → Google Imagen Ultra handles it (slower but highest quality).

---

## 2. Grok Models — Fast Generation (2K)

xAI offers two image generation models under the **Grok Imagine** family:

### 2.1 Available Models

| Model | Price Per Image | Speed | Best For |
|---|---|---|---|
| `grok-imagine-image` (Standard) | **$0.02** (~₹1.7) | **3–8 sec** | Fast, everyday generation |
| `grok-imagine-image-pro` (Pro) | **$0.07** (~₹5.9) | **5–12 sec** | Higher quality output |

> [!TIP]
> For image **editing** (reference images), you're charged for **both** the input image and the output image. So editing with the Standard model = $0.04/operation, and Pro = $0.14/operation.

### 2.2 Grok Features

| Feature | Support |
|---|---|
| Text-to-Image | ✅ |
| Batch generation | ✅ Up to **10 images** per request |
| Aspect ratio control | ✅ **14 ratios** (1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 2:1, 1:2, 19.5:9, 9:19.5, 20:9, 9:20, auto) |
| Base64 output | ✅ (`response_format: "b64_json"`) |
| URL output | ✅ (temporary URLs) |
| Content moderation | ✅ Built-in |
| Image editing (reference) | ✅ via `/v1/images/edits` endpoint |
| Multi-image input | ✅ Up to **3 images** per edit |
| Style transfer | ✅ Built-in |
| Multi-turn editing | ✅ Iterative refinement |
| OpenAI SDK compatible | ✅ Drop-in integration with `openai` npm package |

### 2.3 Grok Rate Limits

| Tier | Spending Threshold | Rate Limits |
|---|---|---|
| Tier 1 | $0+ | Basic limits (start here) |
| Tier 2 | After moderate spending | Increased limits |
| Tier 3 | After significant spending | High limits |
| Custom | Contact sales | Unlimited / custom |

- Default: **5 requests/second** for image generation
- Up to **10 images per request** (so 50 images/second theoretical max)
- Rate limits auto-upgrade as you spend more

---

## 3. Google Imagen Ultra — Premium Generation (4K)

Google Imagen 4.0 Ultra remains the **premium quality provider** for users who need the absolute best.

### 3.1 Why Keep Imagen Ultra for 4K

| Strength | Details |
|---|---|
| **Highest image quality** | Best-in-class photorealistic generation |
| **Text rendering** | Superior text rendering in images |
| **Up to 2K native resolution** | Higher native resolution than Grok (1024x1024) |
| **Mature & battle-tested** | Years of iteration; stable at scale |
| **Prompt adherence** | Better at handling very complex, multi-element prompts |

### 3.2 Imagen Ultra Pricing

| Operation | Cost |
|---|---|
| Per image (no reference) | ~$0.06–0.08 |
| Gemini 3 Pro (reference image) | ~$0.05–0.15 (token-based) |

> [!NOTE]
> The 4K tier uses Google Imagen Ultra with upscaling. The slower generation time (30–45s) is the expected trade-off for maximum quality.

---

## 4. Resolution Tiers & User Experience

### 4.1 How It Works for the User

```
User selects resolution:
  ┌─────────────────────────────────────────────┐
  │  🚀 2K (Fast)      →  Grok Imagine          │
  │     ~5–12 seconds   →  Quick & good quality  │
  ├─────────────────────────────────────────────┤
  │  👑 4K (Premium)    →  Google Imagen Ultra    │
  │     ~30–45 seconds  →  Best quality possible  │
  └─────────────────────────────────────────────┘
```

### 4.2 Internal Model Routing Logic

| User Choice | Resolution | AI Provider | Model | Expected Time |
|---|---|---|---|---|
| **2K (Fast)** — Free/Starter | 1920×1080 | xAI Grok | `grok-imagine-image` | 3–8 sec |
| **2K (Fast)** — Creator/Pro | 1920×1080 | xAI Grok | `grok-imagine-image-pro` | 5–12 sec |
| **4K (Premium)** — Pro only | 3840×2160 | Google | Imagen 4.0 Ultra | 30–45 sec |

### 4.3 UX Expectations

- **2K selection**: Show a "⚡ Fast Generation" badge. No loading spinner needed for long waits.
- **4K selection**: Show a "👑 Premium Quality — takes ~30–45 seconds" message with a progress indicator.
- Users on free/starter plans only see the 2K option. 4K is a Pro-tier perk.

---

## 5. API Integration (Node.js)

### 5.1 Grok — Fast 2K Generation

```typescript
import OpenAI from "openai";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Fast 2K thumbnail generation
const response = await xai.images.generate({
  model: "grok-imagine-image", // or "grok-imagine-image-pro"
  prompt: "Bold YouTube thumbnail for '10 Tips for Better Sleep', vibrant colors",
  // @ts-expect-error — xAI-specific parameter
  aspect_ratio: "16:9",
  response_format: "b64_json",
  n: 1,
});

const imageBase64 = response.data[0].b64_json;
const imageBuffer = Buffer.from(imageBase64, "base64");
```

### 5.2 Grok — Image Editing (Reference Image)

```typescript
const editResponse = await fetch("https://api.x.ai/v1/images/edits", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.XAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "grok-imagine-image",
    prompt: "Create a YouTube thumbnail featuring this person...",
    image: { url: referenceImageUrl },
    aspect_ratio: "16:9",
    response_format: "b64_json",
  }),
});
```

### 5.3 Google Imagen Ultra — Premium 4K Generation

```typescript
// Existing Google Imagen Ultra code stays as-is
// Used only when user selects 4K resolution
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const response = await ai.models.generateImages({
  model: "imagen-4.0-ultra-generate-exp-05-20",
  prompt: thumbnailPrompt,
  config: {
    numberOfImages: 1,
    aspectRatio: "16:9",
  },
});
```

### 5.4 Router Logic (Pseudocode)

```typescript
async function generateThumbnail(prompt: string, resolution: "2k" | "4k", plan: string) {
  if (resolution === "4k") {
    // Premium 4K — Google Imagen Ultra (slow, highest quality)
    return await generateWithImagenUltra(prompt);
  } else {
    // Fast 2K — Grok
    const model = plan === "starter" || plan === "free"
      ? "grok-imagine-image"       // Standard for free/starter
      : "grok-imagine-image-pro";  // Pro model for Creator/Pro plans
    return await generateWithGrok(prompt, model);
  }
}
```

### 5.5 Required Environment Variables

```bash
# .env
XAI_API_KEY=your_xai_api_key          # For Grok (fast 2K)
GOOGLE_API_KEY=your_google_api_key    # For Imagen Ultra (premium 4K)
```

---

## 6. Social Media Platform Support

> [!IMPORTANT]
> Users can select which social media platform they are generating a thumbnail for. ThumbGen auto-configures the **aspect ratio**, **dimensions**, and **design style** to match that platform's requirements.

### 6.1 Supported Platforms & Thumbnail Specs

| Platform | Thumbnail Type | Dimensions (px) | Aspect Ratio | Max File Size | Format |
|---|---|---|---|---|---|
| **YouTube** | Video Thumbnail | **1280 × 720** | 16:9 | 2 MB | JPG, PNG |
| **YouTube Shorts** | Shorts Cover | **1080 × 1920** | 9:16 | 2 MB | JPG, PNG |
| **Instagram** | Post (Square) | **1080 × 1080** | 1:1 | — | JPG, PNG |
| **Instagram** | Post (Portrait) | **1080 × 1350** | 4:5 | — | JPG, PNG |
| **Instagram** | Story / Reel | **1080 × 1920** | 9:16 | — | JPG, PNG |
| **TikTok** | Video Cover | **1080 × 1920** | 9:16 | — | JPG, PNG |
| **X (Twitter)** | Post Image | **1200 × 675** | 16:9 | 5 MB | JPG, PNG |
| **LinkedIn** | Post Image | **1200 × 627** | 1.91:1 | — | JPG, PNG |
| **LinkedIn** | Video Thumbnail | **1280 × 720** | 16:9 | — | JPG, PNG |
| **Facebook** | Post Image | **1200 × 630** | 1.91:1 | — | JPG, PNG |
| **Facebook** | Video Thumbnail | **1280 × 720** | 16:9 | — | JPG, PNG |
| **Pinterest** | Pin Image | **1000 × 1500** | 2:3 | — | JPG, PNG |

### 6.2 Platform Selector — User Flow

```
Step 1: User selects platform
  ┌──────────────────────────────────────────────┐
  │  📺 YouTube          📸 Instagram             │
  │  🎵 TikTok           🐦 X (Twitter)           │
  │  💼 LinkedIn          📘 Facebook              │
  │  📌 Pinterest                                  │
  └──────────────────────────────────────────────┘

Step 2: Platform auto-configures settings
  - Aspect ratio is set automatically
  - Output dimensions match platform requirements
  - Prompt augmented with platform-specific style tips

Step 3: User can still override aspect ratio if needed
```

### 6.3 Platform-Specific Prompt Enhancements

When a user selects a platform, ThumbGen **appends platform-specific style guidance** to the AI prompt for better results:

| Platform | Style Guidance Appended to Prompt |
|---|---|
| **YouTube** | "Bold, eye-catching, high contrast. Large text overlay friendly. Expressive faces if applicable. Designed for 16:9 video thumbnail." |
| **Instagram Post** | "Clean, aesthetic, Instagram-worthy. Vibrant or muted tones depending on niche. Designed for square or portrait feed format." |
| **Instagram Story/Reel** | "Vertical format, full-bleed design. Bold text at center, avoid top/bottom edges (UI overlaps). Story/Reel optimized." |
| **TikTok** | "Vertical format, bold and trendy. Eye-catching at small sizes. Avoid text in top 15% and bottom 20% (UI overlaps)." |
| **X (Twitter)** | "Clean, newsworthy composition. Works well at small preview size. Horizontal format. Minimal text overlay." |
| **LinkedIn** | "Professional, polished, corporate-friendly. Clean typography. Horizontal format. Appropriate for business audience." |
| **Facebook** | "Engaging, shareable composition. Works at multiple preview sizes. Horizontal format. Broad audience appeal." |
| **Pinterest** | "Tall, vertical format. Text overlay friendly. Lifestyle/aspirational aesthetic. Designed to stop the scroll in a feed." |

### 6.4 Aspect Ratio Mapping (for API calls)

```typescript
const PLATFORM_CONFIG: Record<string, { aspectRatio: string; width: number; height: number }> = {
  "youtube":           { aspectRatio: "16:9",  width: 1280, height: 720  },
  "youtube-shorts":    { aspectRatio: "9:16",  width: 1080, height: 1920 },
  "instagram-post":    { aspectRatio: "1:1",   width: 1080, height: 1080 },
  "instagram-portrait":{ aspectRatio: "4:5",   width: 1080, height: 1350 },
  "instagram-story":   { aspectRatio: "9:16",  width: 1080, height: 1920 },
  "tiktok":            { aspectRatio: "9:16",  width: 1080, height: 1920 },
  "twitter":           { aspectRatio: "16:9",  width: 1200, height: 675  },
  "linkedin":          { aspectRatio: "1.91:1",width: 1200, height: 627  },
  "facebook":          { aspectRatio: "1.91:1",width: 1200, height: 630  },
  "pinterest":         { aspectRatio: "2:3",   width: 1000, height: 1500 },
};
```

> [!TIP]
> Grok supports **14 aspect ratios** natively — this covers all social media platforms above without needing to crop or resize.

---

## 7. Cost Analysis

### 7.1 Per-Image Cost by Tier

| Scenario | Provider | Model | Cost |
|---|---|---|---|
| 2K Fast (Free/Starter) | Grok | `grok-imagine-image` | **$0.02** |
| 2K Fast (Creator/Pro) | Grok | `grok-imagine-image-pro` | **$0.07** |
| 4K Premium (Pro only) | Google | Imagen 4.0 Ultra | **~$0.06–0.08** |
| Reference image (Grok Std) | Grok | `grok-imagine-image` | **$0.04** |
| Reference image (Google) | Google | Gemini 3 Pro | **~$0.05–0.15** |

### 7.2 At Scale (1,000 daily users × 3 thumbnails)

| Metric | 2K Grok Standard | 4K Imagen Ultra |
|---|---|---|
| Daily cost | **$60** (~₹5,040) | ~$180–240 |
| Peak throughput | 50 images/sec | ~5-10 images/sec |
| Generation time | 3–8 sec | 30–45 sec |
| Server timeout issues | None | Frequent (Vercel limits) |

---

## 8. Migration & Implementation Plan

### Step 1: Add xAI Client (30 min)

```bash
npm install openai  # Already OpenAI-compatible
```

Create `configs/xai.ts`:
```typescript
import OpenAI from "openai";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export default xai;
```

### Step 2: Build Resolution Router (1–2 hours)

Update `thumbnailWorker.ts` to:
1. Accept `resolution` param (`"2k"` or `"4k"`)
2. Route to Grok for 2K, Imagen Ultra for 4K
3. Accept `platform` param to set aspect ratio and prompt style

### Step 3: Add Social Media Platform Selector (2–3 hours)

1. Add platform selector UI to the thumbnail generation page
2. Create `PLATFORM_CONFIG` mapping (see section 6.4)
3. Auto-set aspect ratio and append platform-specific prompt guidance
4. Allow user override if needed

### Step 4: Add XAI_API_KEY to Environment (5 min)

Get API key from [console.x.ai](https://console.x.ai) and add to `.env`.

### Step 5: Test & Compare Quality (1 day)

Generate 20–30 test thumbnails with both providers and compare quality for each platform.

### Step 6: Gradual Rollout

- Week 1: Grok for 2K only, Imagen Ultra stays for all 4K
- Week 2: Enable platform selector for all users
- Week 3: Monitor quality feedback, tune prompt enhancements

---

## 9. Recommendation

> [!TIP]
> **Use a hybrid model**: Grok for fast 2K generation, Google Imagen Ultra for premium 4K. This gives users speed for everyday use and top quality when they need it.

### Summary

| Metric | 2K Fast (Grok) | 4K Premium (Imagen Ultra) |
|---|---|---|
| Generation time | **3–8 seconds** | 30–45 seconds |
| Cost per image | **$0.02** (std) / $0.07 (pro) | ~$0.06–0.08 |
| Quality | Very High | **Best in class** |
| Text rendering | Good | **Excellent** |
| Batch variants | Up to 10 | Up to 4 |
| Aspect ratios | **14 options** | 3 options |
| Best for | Quick iterations, most users | Pro users, final quality |

### Key Benefits of This Approach

1. **Speed**: 90% of users get thumbnails in **3–12 seconds** (vs 30–45s before)
2. **Quality option**: Pro users still access the **best quality available** via 4K
3. **Cost savings**: ~65% cheaper for the majority of generations
4. **Social media support**: Auto-optimized for **10 platform formats** covering YouTube, Instagram, TikTok, X, LinkedIn, Facebook, and Pinterest
5. **No vendor lock-in**: Two providers = fallback if one has issues
6. **Clear UX**: Users understand the trade-off — fast vs premium
