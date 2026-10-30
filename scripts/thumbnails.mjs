import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const env = readEnv(".env.local");
if (!env.KURA_THUMB_SECRET) {
  console.error("KURA_THUMB_SECRET is missing. Run node scripts/ensure-env.mjs first.");
  process.exit(1);
}

const child = spawn("docker", ["compose", "--profile", "thumbs", "up", "-d", "--build", "thumbnails"], {
  stdio: "inherit",
  env: { ...process.env, KURA_THUMB_SECRET: env.KURA_THUMB_SECRET },
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));

function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)='?([^']*)'?$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}
