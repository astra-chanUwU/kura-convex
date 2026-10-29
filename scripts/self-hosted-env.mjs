import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = ".env.local";
const backendUrl = "http://127.0.0.1:3210";
const force = process.argv.includes("--force");

execFileSync("docker", ["compose", "up", "-d", "--wait"], { stdio: "inherit" });

if (existsSync(envPath) && !force && isReady(readFileSync(envPath, "utf8"))) {
  console.log(`${envPath} already has CONVEX_SELF_HOSTED_URL`);
  process.exit(0);
}

const output = execFileSync(
  "docker",
  ["compose", "exec", "-T", "backend", "./generate_admin_key.sh"],
  { encoding: "utf8" },
);
const lines = output
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const key = lines.findLast((line) => line.includes("|")) ?? lines.at(-1);

if (!key || /\s/.test(key)) {
  console.error("generate_admin_key.sh did not return an admin key.");
  process.exit(1);
}

writeFileSync(
  envPath,
  [
    "# Written by scripts/self-hosted-env.mjs. Do not commit.",
    `CONVEX_SELF_HOSTED_URL='${backendUrl}'`,
    `CONVEX_SELF_HOSTED_ADMIN_KEY='${key}'`,
    `VITE_CONVEX_URL='${backendUrl}'`,
    "",
  ].join("\n"),
);

console.log(`Wrote ${envPath}`);

function isReady(text) {
  return (
    text.includes("CONVEX_SELF_HOSTED_URL=") &&
    text.includes("CONVEX_SELF_HOSTED_ADMIN_KEY=") &&
    !text.includes("CONVEX_DEPLOYMENT=")
  );
}
