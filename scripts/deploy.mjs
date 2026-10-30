import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertLocalBackend,
  loadProduction,
  localBackendEnv,
  localProcessEnv,
  productionProcessEnv,
} from "./target.mjs";

const cli = fileURLToPath(new URL("../node_modules/convex/bin/main.js", import.meta.url));
const prod = process.argv.includes("--prod");

if (!prod) {
  assertLocalBackend(localBackendEnv(), "pnpm deploy");
  const result = spawnSync(process.execPath, [cli, "deploy"], {
    stdio: "inherit",
    env: localProcessEnv(),
  });
  process.exit(result.status ?? 1);
}

const fileEnv = loadProduction();
const result = spawnSync(
  process.execPath,
  [
    cli,
    "deploy",
    "--env-file",
    ".env.production",
    "--cmd",
    "pnpm build",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
  ],
  { stdio: "inherit", env: productionProcessEnv(fileEnv) },
);
process.exit(result.status ?? 1);
