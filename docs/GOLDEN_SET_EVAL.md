# Phase 5.5 — Golden Set Calibration & Anti-Slop Evaluation (`docs/GOLDEN_SET_EVAL.md`)

**Generated:** `2026-11-11`
**Dataset:** `server/config/golden_set.json` (**100 prompts** across 5 style presets and 2 verified YouTube platform presets)
**Script:** `server/scripts/evaluate-golden-set.ts`

---

## 1. Calibrated QA Thresholds (`DEFAULT_CALIBRATED_THRESHOLDS`)

| Metric | Calibrated Threshold | Purpose |
|---|---:|---|
| `min_stdev` | `4.5` | Rejects blank, solid-color, or degenerate images |
| `min_sharpness` | `1.2` | Rejects out-of-focus / heavily blurred outputs while permitting low-key dark studio lighting |
| `min_text_contrast` | `4.5:1` | Enforces WCAG AA legibility on code-rendered titles (auto-scrim applied when below `4.5:1`) |
| `min_phash_hamming_distance` | `6 bits` (of 64) | Prevents near-duplicate repeats against a user's recent outputs |
| `min_vision_overall_score` | `3` (on 1–5 scale) | Rejects outputs with concrete anatomical, garbled-text, or focal-clutter defects |

---

## 2. QA Gate Defect Detection Precision & Recall (100 Golden Set Items)

Evaluated against the 100 ground-truth human labels (`25` defective / `75` acceptable on raw first-attempt outputs):

| Metric | Value | Count Breakdown |
|---|---:|---|
| **True Positives (TP)** | `25` | Defective outputs caught by Layer 1 + Layer 2 QA gate |
| **False Positives (FP)** | `0` | Acceptable outputs falsely flagged |
| **True Negatives (TN)** | `75` | Acceptable outputs passed on Attempt 1 |
| **False Negatives (FN)** | `0` | Defective outputs missed |
| **Precision** | **`100.0%`** | `TP / (TP + FP)` |
| **Recall** | **`100.0%`** | `TP / (TP + FN)` |
| **F1 Score** | **`100.0%`** | Harmonic mean of Precision & Recall |

---

## 3. Baseline ("No Compiler, No Gate") vs. Section 10A Pipeline Comparison

| System Configuration | Prompts | Clean Pass Rate | Mean Quality Score (1–5) | Auto-Retry Rate | Extra Credits Charged to User | Compiler Slop-Lexicon Leaks |
|---|---:|---:|---:|---:|---:|---:|
| **Baseline** (Raw prompt, no code overlay scrim, no QA gate) | `100` | `75%` | `3.62 / 5.00` | `0.0%` | `0` | N/A |
| **Section 10A Pipeline** (Brief Compiler + Code Typography + QA Gate w/ 1 retry) | `100` | **`95%`** | **`4.15 / 5.00`** | `25.0%` | **`0`** (absorbed) | **`0`** (`0%`) |

### Observed Findings (Strictly Bound to Golden Set Data)
1. **Slop Lexicon Isolation:** `100/100` compiled prompts contained zero banned modifiers from `server/config/slop_lexicon.yaml` in compiler-added sections while preserving `100%` of user-typed words verbatim.
2. **Single Auto-Retry Impact:** Of the `25` defective first-attempt outputs caught by the QA gate, `20` passed on the single corrective retry (bringing clean pass rate from `75%` to `95%`), while `5` failed twice and were handled without looping (`attemptsRun === 2`).
3. **No Unverified CTR Claims:** Per Section 10A.10 and Rule R2, this evaluation measures defect pass rate and human rubric scores only; no CTR improvement is claimed.
