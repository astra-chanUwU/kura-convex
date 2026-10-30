import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = ".env.local";
const backendUrl = `http://127.0.0.1:${composePort("PORT", "3210")}`;
const siteUrl = `http://127.0.0.1:${composePort("SITE_PROXY_PORT", "3211")}`;
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

const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const updates = {
  CONVEX_SELF_HOSTED_URL: backendUrl,
  CONVEX_SELF_HOSTED_ADMIN_KEY: key,
  VITE_CONVEX_URL: backendUrl,
  VITE_CONVEX_SITE_URL: siteUrl,
  VITE_SITE_URL: "http://127.0.0.1:5175",
  VITE_S3_PUBLIC_URL: "http://127.0.0.1:9000/kura-images",
};
writeFileSync(envPath, upsertAll(previous, updates));

console.log(`Wrote ${envPath}`);

function composePort(name, fallback) {
  if (!existsSync(".env")) return fallback;
  const match = readFileSync(".env", "utf8").match(new RegExp(`^${name}=(\\d+)`, "m"));
  return match?.[1] ?? fallback;
}

function upsertAll(text, updates) {
  let next = text;
  if (next && !next.endsWith("\n")) next += "\n";
  if (!next) next = "# Written by scripts/self-hosted-env.mjs. Do not commit.\n";
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}='${value}'`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    next = pattern.test(next) ? next.replace(pattern, line) : `${next}${line}\n`;
  }
  return next;
}

function isReady(text) {
  return (
    text.includes("CONVEX_SELF_HOSTED_URL=") &&
    text.includes("CONVEX_SELF_HOSTED_ADMIN_KEY=") &&
    !text.includes("CONVEX_DEPLOYMENT=")
  );
}
