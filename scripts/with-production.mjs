import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadProduction, productionProcessEnv } from "./target.mjs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: pnpm convex:prod -- <convex command>");
  console.error("Example: pnpm convex:prod -- env set SITE_URL https://kura.example.com");
  process.exit(1);
}

const cli = fileURLToPath(new URL("../node_modules/convex/bin/main.js", import.meta.url));
const result = spawnSync(process.execPath, [cli, ...args], {
  stdio: "inherit",
  env: productionProcessEnv(loadProduction()),
});
process.exit(result.status ?? 1);
