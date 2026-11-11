/**
 * scripts/discover-models.mjs
 *
 * Root entrypoint forwarding to server/scripts/discover-models.ts via tsx.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "../server");

const res = spawnSync(
  process.execPath,
  ["--import", "tsx/esm", "scripts/discover-models.ts"],
  {
    cwd: serverDir,
    stdio: "inherit",
  }
);

process.exit(res.status ?? 1);

