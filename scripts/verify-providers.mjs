import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "../server");

const result = spawnSync(
  process.execPath,
  ["--import", "tsx/esm", "scripts/verify-providers.ts", ...process.argv.slice(2)],
  {
    cwd: serverDir,
    stdio: "inherit",
    env: process.env,
  }
);

process.exit(result.status ?? 1);

