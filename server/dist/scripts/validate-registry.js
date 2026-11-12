/**
 * scripts/validate-registry.ts
 *
 * CLI runner for registry schema + snapshot + freshness validation.
 * Exits with code 1 if any validation errors are present.
 */
import { loadRegistryConfig, loadModelsSnapshot, validateRegistry, } from "../configs/registryValidator.js";
function main() {
    const allowMock = process.argv.includes("--allow-mock");
    const registry = loadRegistryConfig();
    const snapshot = loadModelsSnapshot();
    console.log(`Validating registry (snapshot fetched_at: ${snapshot.fetched_at}, models: ${snapshot.models.length})...`);
    const result = validateRegistry(registry, snapshot, { allowMock });
    if (result.valid) {
        console.log("Registry validation PASSED.");
        process.exit(0);
    }
    else {
        console.error(`Registry validation FAILED with ${result.errors.length} error(s):`);
        for (const err of result.errors) {
            console.error(`  [${err.code}] ${err.path}: ${err.message}`);
        }
        process.exit(1);
    }
}
main();
