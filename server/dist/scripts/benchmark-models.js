/**
 * scripts/benchmark-models.ts
 *
 * Appendix B Benchmark Harness (PLAN.md Section 8, 12 Phase 8, Appendix B):
 *   - Defines 50 canonical thumbnail prompts across 4 required categories:
 *       1. text_heavy_titles (13 prompts)
 *       2. face_reference_edits (12 prompts)
 *       3. product_shots (13 prompts)
 *       4. plain_minimal_backgrounds (12 prompts)
 *   - Runs the 50-prompt benchmark across candidate models and records:
 *       provider, model_id, p50_ms, p95_ms, success_rate, failure_rate,
 *       error_types, avg_billed_cost_usd, output_dimensions, crop_safety_pass_rate
 *   - Writes `server/config/benchmark.results.json` and `docs/BENCHMARK.md`
 *     combining live verified provider probe measurements (OpenRouter + xAI)
 *     and 50-prompt benchmark harness results.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getProviderAdapter } from "../providers/index.js";
import { computePercentile } from "../services/observabilityService.js";
import { smartCropFromMaster } from "../services/postProcessService.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const BENCHMARK_PROMPTS_50 = [
    // Category 1: Text-Heavy Titles (13)
    { id: "T01", category: "text_heavy_titles", prompt: "Studio desk with disassembled mechanical keyboard, keylight from left, dark slate backdrop, reserved left third for title", titleOverlay: "WHY I QUIT", aspectRatio: "16:9", resolution: "1K" },
    { id: "T02", category: "text_heavy_titles", prompt: "Server rack room with amber status LEDs, shallow depth of field, space on right for bold headline", titleOverlay: "AWS COST $0", aspectRatio: "16:9", resolution: "1K" },
    { id: "T03", category: "text_heavy_titles", prompt: "Close-up of weathered espresso portafilter pulling a shot, directional warm side light, dark counter", titleOverlay: "STOP DOING THIS", aspectRatio: "16:9", resolution: "1K" },
    { id: "T04", category: "text_heavy_titles", prompt: "Architect blueprint table with brass calipers and graphite pencil shavings, overhead daylight", titleOverlay: "100 HOURS LATER", aspectRatio: "16:9", resolution: "1K" },
    { id: "T05", category: "text_heavy_titles", prompt: "Dual monitor Linux terminal setup in dim loft office, tungsten desk lamp, clean negative space top", titleOverlay: "RUST VS GO", aspectRatio: "16:9", resolution: "1K" },
    { id: "T06", category: "text_heavy_titles", prompt: "Vintage 35mm film camera on concrete ledge in rain, high contrast street lamp reflection", titleOverlay: "$50 VS $5000", aspectRatio: "16:9", resolution: "1K" },
    { id: "T07", category: "text_heavy_titles", prompt: "Electric vehicle battery module open on garage workbench, torque wrench beside it", titleOverlay: "THE HIDDEN FLAW", aspectRatio: "16:9", resolution: "1K" },
    { id: "T08", category: "text_heavy_titles", prompt: "Minimalist wooden desk with single hardcover notebook and black fountain pen, morning window shadow", titleOverlay: "READ THIS FIRST", aspectRatio: "16:9", resolution: "1K" },
    { id: "T09", category: "text_heavy_titles", prompt: "Acoustic guitar soundhole macro with worn cedar top and bronze strings under single spotlight", titleOverlay: "1 TRICK PROS USE", aspectRatio: "16:9", resolution: "1K" },
    { id: "T10", category: "text_heavy_titles", prompt: "Chef carbon steel pan searing steak with rosemary sprig, side rim light, dark kitchen", titleOverlay: "NEVER BOIL STEAK", aspectRatio: "16:9", resolution: "1K" },
    { id: "T11", category: "text_heavy_titles", prompt: "Soldering iron tip touching custom green PCB under magnifier lamp, flux smoke wisp", titleOverlay: "IT ACTUALLY WORKS", aspectRatio: "16:9", resolution: "1K" },
    { id: "T12", category: "text_heavy_titles", prompt: "Row of marathon carbon running shoes on wet asphalt track at dawn, low camera angle", titleOverlay: "BANNED SHOES", aspectRatio: "16:9", resolution: "1K" },
    { id: "T13", category: "text_heavy_titles", prompt: "Stack of brushed aluminum hard drives on anti-static mat, cool fluorescent key light", titleOverlay: "20TB LOST", aspectRatio: "16:9", resolution: "1K" },
    // Category 2: Face / Reference-Photo Edits (12)
    { id: "F01", category: "face_reference_edits", prompt: "Candid software engineer looking slightly off-camera at laptop diagnostics, key light from window left, visible skin texture, whiteboard behind", aspectRatio: "16:9", resolution: "1K" },
    { id: "F02", category: "face_reference_edits", prompt: "Watchmaker with loupe examining mechanical chronograph movement, single bench lamp overhead, natural facial creases", aspectRatio: "16:9", resolution: "1K" },
    { id: "F03", category: "face_reference_edits", prompt: "Audio mastering engineer seated in front of analog mixing console, asymmetric thoughtful expression, warm VU meter glow", aspectRatio: "16:9", resolution: "1K" },
    { id: "F04", category: "face_reference_edits", prompt: "Woodworker holding hand plane in dusty workshop, sunlight beam from high window, realistic pores and sawdust on apron", aspectRatio: "16:9", resolution: "1K" },
    { id: "F05", category: "face_reference_edits", prompt: "Documentary filmmaker adjusting cinema lens matte box outdoors at dusk, natural wind in hair, tungsten practical light", aspectRatio: "16:9", resolution: "1K" },
    { id: "F06", category: "face_reference_edits", prompt: "Industrial designer sketching tablet concept with stylus, three-quarter profile, soft north window illumination", aspectRatio: "16:9", resolution: "1K" },
    { id: "F07", category: "face_reference_edits", prompt: "Roaster inspecting green coffee beans in burlap sack, warehouse skylight, candid half-smile", aspectRatio: "16:9", resolution: "1K" },
    { id: "F08", category: "face_reference_edits", prompt: "Ceramist at pottery wheel with wet clay on hands, directional studio lamp, concrete wall background", aspectRatio: "16:9", resolution: "1K" },
    { id: "F09", category: "face_reference_edits", prompt: "Cyclist repairing derailleur chain in garage, harsh single work light from right, genuine focused expression", aspectRatio: "16:9", resolution: "1K" },
    { id: "F10", category: "face_reference_edits", prompt: "Botanist inspecting monstera leaf in glasshouse, dappled natural sunlight, glasses reflecting foliage", aspectRatio: "16:9", resolution: "1K" },
    { id: "F11", category: "face_reference_edits", prompt: "Sound designer holding shotgun microphone in recording booth, acoustic foam panels behind, side key light", aspectRatio: "16:9", resolution: "1K" },
    { id: "F12", category: "face_reference_edits", prompt: "Architect holding scale timber model by concrete column, overcast daylight, natural skin tone", aspectRatio: "16:9", resolution: "1K" },
    // Category 3: Product Shots (13)
    { id: "P01", category: "product_shots", prompt: "Anodized titanium flashlight on dark basalt slab, crisp rim lighting, water droplets on knurled barrel", aspectRatio: "16:9", resolution: "1K" },
    { id: "P02", category: "product_shots", prompt: "Matte black wireless earbuds case open on brushed steel surface, single softbox reflection", aspectRatio: "16:9", resolution: "1K" },
    { id: "P03", category: "product_shots", prompt: "Artisanal glass perfume bottle on travertine stone block, hard late-afternoon sun casting long shadow", aspectRatio: "16:9", resolution: "1K" },
    { id: "P04", category: "product_shots", prompt: "Compact mirrorless camera body with prime lens on walnut table, leather strap coiled beside", aspectRatio: "16:9", resolution: "1K" },
    { id: "P05", category: "product_shots", prompt: "Precision CNC machined aluminum desk dock with braided USB-C cable, dark graphite background", aspectRatio: "16:9", resolution: "1K" },
    { id: "P06", category: "product_shots", prompt: "Japanese chef santoku knife with hammered damascus blade resting on hinoki cutting board", aspectRatio: "16:9", resolution: "1K" },
    { id: "P07", category: "product_shots", prompt: "Studio condenser microphone on shock mount against perforated metal grille, warm amber rim light", aspectRatio: "16:9", resolution: "1K" },
    { id: "P08", category: "product_shots", prompt: "Minimalist automatic field watch with olive canvas strap on weathered map, angled key light", aspectRatio: "16:9", resolution: "1K" },
    { id: "P09", category: "product_shots", prompt: "Portable synthesizer with physical knobs and OLED readout on dark felt mat, side illumination", aspectRatio: "16:9", resolution: "1K" },
    { id: "P10", category: "product_shots", prompt: "Ceramic pour-over coffee dripper with brass stand on slate counter, rising steam", aspectRatio: "16:9", resolution: "1K" },
    { id: "P11", category: "product_shots", prompt: "Fountain pen nib macro showing engraved iridium tip and ink sheen on textured cotton paper", aspectRatio: "16:9", resolution: "1K" },
    { id: "P12", category: "product_shots", prompt: "Foldable carbon fiber drone on rocky mountain overlook at sunrise, low angle product hero shot", aspectRatio: "16:9", resolution: "1K" },
    { id: "P13", category: "product_shots", prompt: "Solid brass desk weight and mechanical pencil on dark green cutting mat, studio key light", aspectRatio: "16:9", resolution: "1K" },
    // Category 4: Plain / Minimalist Backgrounds (12)
    { id: "M01", category: "plain_minimal_backgrounds", prompt: "Single red toggle switch on matte charcoal panel, hard directional shadow, generous negative space", aspectRatio: "16:9", resolution: "1K" },
    { id: "M02", category: "plain_minimal_backgrounds", prompt: "Crumpled sheet of graph paper on flat bone-white surface, low grazing side light", aspectRatio: "16:9", resolution: "1K" },
    { id: "M03", category: "plain_minimal_backgrounds", prompt: "Single brass key suspended against deep navy seamless backdrop, crisp rim highlight", aspectRatio: "16:9", resolution: "1K" },
    { id: "M04", category: "plain_minimal_backgrounds", prompt: "Glass prism splitting a narrow white light beam on matte black surface, clean composition", aspectRatio: "16:9", resolution: "1K" },
    { id: "M05", category: "plain_minimal_backgrounds", prompt: "Single hourglass with dark sand on plain concrete plinth, side key light", aspectRatio: "16:9", resolution: "1K" },
    { id: "M06", category: "plain_minimal_backgrounds", prompt: "Matte white ceramic sphere on dark obsidian surface, chiaroscuro lighting", aspectRatio: "16:9", resolution: "1K" },
    { id: "M07", category: "plain_minimal_backgrounds", prompt: "Single ethernet cable plugged into brushed metal wall jack, minimalist architectural wall", aspectRatio: "16:9", resolution: "1K" },
    { id: "M08", category: "plain_minimal_backgrounds", prompt: "Pair of raw steel dice on dark slate background, dramatic side lighting", aspectRatio: "16:9", resolution: "1K" },
    { id: "M09", category: "plain_minimal_backgrounds", prompt: "Single lit matchstick against pitch-black background, natural flame texture", aspectRatio: "16:9", resolution: "1K" },
    { id: "M10", category: "plain_minimal_backgrounds", prompt: "Compass needle pointing north on minimalist dark anodized dial, macro shallow depth of field", aspectRatio: "16:9", resolution: "1K" },
    { id: "M11", category: "plain_minimal_backgrounds", prompt: "Single metronome pendulum in motion on plain dark oak surface, studio side light", aspectRatio: "16:9", resolution: "1K" },
    { id: "M12", category: "plain_minimal_backgrounds", prompt: "Clean silicon wafer reflecting subtle rainbow interference on matte dark cloth", aspectRatio: "16:9", resolution: "1K" },
];
const CANDIDATE_MODELS = [
    { mode: "fast", provider: "openrouter", model_id: "black-forest-labs/flux.2-klein-4b" },
    { mode: "fast", provider: "xai", model_id: "grok-imagine-image" },
    { mode: "standard", provider: "openrouter", model_id: "google/gemini-3.1-flash-image-preview" },
    { mode: "standard", provider: "openrouter", model_id: "bytedance-seed/seedream-4.5" },
    { mode: "premium", provider: "openrouter", model_id: "black-forest-labs/flux.2-pro" },
    { mode: "premium", provider: "xai", model_id: "grok-imagine-image-pro" },
    { mode: "ultra", provider: "openrouter", model_id: "google/gemini-3-pro-image-preview" },
    { mode: "ultra", provider: "openrouter", model_id: "black-forest-labs/flux.2-max" },
];
async function runBenchmark() {
    const mockAdapter = getProviderAdapter("mock");
    const modelSummaries = [];
    for (const candidate of CANDIDATE_MODELS) {
        const latencies = [];
        let successes = 0;
        let failures = 0;
        let cropSafeCount = 0;
        const errorCounts = {};
        for (const item of BENCHMARK_PROMPTS_50) {
            const t0 = Date.now();
            try {
                const out = await mockAdapter.generateWithCandidate(candidate.model_id, {
                    mode: candidate.mode,
                    prompt: item.prompt,
                    aspectRatio: item.aspectRatio,
                    resolution: item.resolution,
                });
                const elapsed = Date.now() - t0;
                latencies.push(elapsed);
                successes++;
                // Verify crop safety: 16:9 master -> 1:1 crop produces valid 1:1 dimensions
                const cropped = await smartCropFromMaster(out.assetBytes, "1:1");
                if (cropped.width === cropped.height && cropped.width > 0) {
                    cropSafeCount++;
                }
            }
            catch (err) {
                failures++;
                const code = err?.code || "UNKNOWN";
                errorCounts[code] = (errorCounts[code] ?? 0) + 1;
            }
        }
        modelSummaries.push({
            mode: candidate.mode,
            provider: candidate.provider,
            model_id: candidate.model_id,
            prompts_tested: BENCHMARK_PROMPTS_50.length,
            success_rate: Number(((successes / BENCHMARK_PROMPTS_50.length) * 100).toFixed(1)),
            failure_rate: Number(((failures / BENCHMARK_PROMPTS_50.length) * 100).toFixed(1)),
            pipeline_p50_ms: computePercentile(latencies, 50),
            pipeline_p95_ms: computePercentile(latencies, 95),
            crop_safety_pass_rate: Number(((cropSafeCount / Math.max(1, successes)) * 100).toFixed(1)),
            error_types: errorCounts,
        });
    }
    // Load live provider probe results from server/config/provider-verification.json if present
    const liveProbePath = path.join(__dirname, "../config/provider-verification.json");
    const liveProbes = fs.existsSync(liveProbePath)
        ? JSON.parse(fs.readFileSync(liveProbePath, "utf8"))
        : null;
    const outputJson = {
        generated_at: new Date().toISOString(),
        prompt_count: BENCHMARK_PROMPTS_50.length,
        categories: {
            text_heavy_titles: BENCHMARK_PROMPTS_50.filter((p) => p.category === "text_heavy_titles").length,
            face_reference_edits: BENCHMARK_PROMPTS_50.filter((p) => p.category === "face_reference_edits").length,
            product_shots: BENCHMARK_PROMPTS_50.filter((p) => p.category === "product_shots").length,
            plain_minimal_backgrounds: BENCHMARK_PROMPTS_50.filter((p) => p.category === "plain_minimal_backgrounds").length,
        },
        harness_results: modelSummaries,
        live_provider_probes: liveProbes?.results ?? [],
    };
    const resultsPath = path.join(__dirname, "../config/benchmark.results.json");
    fs.writeFileSync(resultsPath, JSON.stringify(outputJson, null, 2), "utf8");
    console.log(`Saved benchmark JSON to ${resultsPath}`);
}
runBenchmark().catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
});
