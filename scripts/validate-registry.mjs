/**
 * scripts/validate-registry.mjs
 *
 * Root wrapper forwarding to server/scripts/validate-registry.ts.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "../server");

const res = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx/esm",
    "scripts/validate-registry.ts",
    ...process.argv.slice(2),
  ],
  {
    cwd: serverDir,
    stdio: "inherit",
  }
);

process.exit(res.status ?? 1);
