import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localPortArgs } from "./convex-ports.mjs";

const cli = fileURLToPath(
  new URL("../node_modules/convex/bin/main.js", import.meta.url),
);
const [command, ...rest] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/convex.mjs <dev|deploy|dashboard> [args]");
  process.exit(1);
}

const selfHosted = command === "deploy";
const args = [cli, command];

if (command === "dev") {
  args.push(...localPortArgs(cli), ...rest);
} else if (command === "deploy") {
  args.push("--env-file", ".env.selfhosted.local", ...rest);
} else {
  args.push(...rest);
}

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: childEnv(selfHosted),
});

process.exit(result.status ?? 1);

function childEnv(selfHosted) {
  const env = { ...process.env };
  if (selfHosted) return env;
  env.CONVEX_AGENT_MODE = "anonymous";
  delete env.CONVEX_DEPLOY_KEY;
  return env;
}
