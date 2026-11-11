# Design System (`DESIGN.md`)

## Visual Direction
**Darkroom Precision Workbench.** Because thumbnails are high-saturation, high-contrast media assets, the application chrome uses a neutral, low-reflectance obsidian palette (`#090a0c` base canvas, `#111317` elevated panels, `#171a20` interactive controls) with `1px solid rgba(255, 255, 255, 0.08)` hairline borders so the surrounding UI never competes with the user's artwork chroma.

## Typography
- **UI & Prose (`--font-sans`):** `Plus Jakarta Sans` — clean geometric-humanist sans used across both Persuade and Operate surfaces.
  - Display / Hero (`Persuade` only): `2.5rem`–`3.75rem`, tracking `-0.03em`, `font-weight: 600`.
  - Section Headings: `1.5rem`–`2.25rem`, tracking `-0.02em`, `font-weight: 600` (never preceded by kickers/eyebrows per Craft Floor).
  - Studio Inspector Labels (`Operate`): `0.75rem` (`12px`), `font-weight: 500`, `text-zinc-300`.
  - Body Copy: `0.875rem`–`1rem`, measure constrained to `60ch–72ch`, contrast `>= 4.5:1`.
- **Measurements, Credits, Dimensions & Timers (`--font-mono`):** `JetBrains Mono` with `font-variant-numeric: tabular-nums` used exclusively for credit costs (`1 cr`–`5 cr`), pixel dimensions (`3840×2160`), aspect ratios (`16:9`), and elapsed timers (`00:14`).

## Color Tokens
- **Canvas Surface:** `#090a0c`
- **Elevated Panel Surface:** `#111317`
- **Interactive Control Surface:** `#171a20`
- **Primary Text:** `#f4f4f5` (`zinc-100`)
- **Secondary Text:** `#a1a1aa` (`zinc-400`, `>= 4.5:1` on `#090a0c` and `#111317`)
- **Primary Brand Accent:** `#e11d48` / `#f43f5e` (`brand-500` / `brand-400`) — reserved for active selection states, live credit indicators, and primary CTAs.
- **Semantic Status:**
  - Verified / Refund Guaranteed: `#34d399` (`emerald-400`)
  - Entitlement Lock / Warning: `#fbbf24` (`amber-400`)
  - Error / Rejection: `#f87171` (`red-400`)

## Elevation, Radii & Browser Surfaces
- **Single-Source Elevation:** Panels declare elevation via `1px solid rgba(255, 255, 255, 0.08)` border on dark surfaces (never combining a 1px border with a wide soft drop shadow).
- **Radii Scale:** `12px` (`rounded-xl`) for Studio inspector sections and canvas frames; `8px` (`rounded-lg`) for inputs and buttons; `6px` (`rounded-md`) for compact badges.
- **Browser Surfaces (`globals.css`):** Custom themed scrollbar (`#1f232b` thumb on `#090a0c` track), custom text selection (`rgba(244, 63, 94, 0.28)`), and high-visibility `:focus-visible` ring (`2px solid #f43f5e`, `offset 2px`).

