import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envPath = ".env.local";
const envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

if (!envText.includes("CONVEX_SELF_HOSTED_URL=")) {
  console.error(`Missing CONVEX_SELF_HOSTED_URL in ${envPath}.`);
  console.error("Start the backend, then write the admin key into .env.local:");
  console.error("  docker compose up -d");
  console.error("  docker compose exec backend ./generate_admin_key.sh");
  console.error("Or run: node scripts/self-hosted-env.mjs");
  process.exit(1);
}

const cli = fileURLToPath(
  new URL("../node_modules/convex/bin/main.js", import.meta.url),
);
const viteBin = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);

const children = [];
let stopping = false;

const dev = run(process.execPath, [cli, "dev"]);
const vite = run(process.execPath, [
  viteBin,
  "--host",
  "127.0.0.1",
  "--port",
  "5175",
]);

for (const child of [dev, vite]) {
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 0);
  });
}

function run(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  return child;
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
