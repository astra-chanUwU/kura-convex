import { existsSync, readFileSync } from "node:fs";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const PROD_FILE = ".env.production";
const PROD_KEYS = [
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SELF_HOSTED_ADMIN_KEY",
  "VITE_CONVEX_URL",
  "VITE_CONVEX_SITE_URL",
  "VITE_SITE_URL",
  "VITE_S3_PUBLIC_URL",
];

export function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)='?([^']*)'?$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

export function isLoopback(url) {
  try {
    const host = new URL(url).hostname.replaceAll("[", "").replaceAll("]", "");
    return LOOPBACK.has(host);
  } catch {
    return false;
  }
}

export function localBackendEnv() {
  const file = readEnv(".env.local");
  return {
    ...file,
    CONVEX_SELF_HOSTED_URL: process.env.CONVEX_SELF_HOSTED_URL || file.CONVEX_SELF_HOSTED_URL,
    CONVEX_SELF_HOSTED_ADMIN_KEY:
      process.env.CONVEX_SELF_HOSTED_ADMIN_KEY || file.CONVEX_SELF_HOSTED_ADMIN_KEY,
    VITE_CONVEX_URL: process.env.VITE_CONVEX_URL || file.VITE_CONVEX_URL,
    VITE_CONVEX_SITE_URL: process.env.VITE_CONVEX_SITE_URL || file.VITE_CONVEX_SITE_URL,
  };
}

export function assertLocalBackend(env, command) {
  const urls = [
    ["CONVEX_SELF_HOSTED_URL", env.CONVEX_SELF_HOSTED_URL],
    ["VITE_CONVEX_URL", env.VITE_CONVEX_URL],
    ["VITE_CONVEX_SITE_URL", env.VITE_CONVEX_SITE_URL],
  ].filter(([, value]) => value);
  if (urls.length === 0) {
    console.error(`${command} needs CONVEX_SELF_HOSTED_URL in .env.local.`);
    process.exit(1);
  }
  for (const [name, value] of urls) {
    if (isLoopback(value)) continue;
    console.error(`${command} only runs against the local backend.`);
    console.error(`${name} is ${value}.`);
    console.error("Put the other backend in .env.production and use pnpm deploy:prod.");
    process.exit(1);
  }
}

export function loadProduction() {
  if (!existsSync(PROD_FILE)) {
    console.error(`Missing ${PROD_FILE}.`);
    console.error("Copy .env.production.example and fill in the production backend.");
    process.exit(1);
  }
  const env = readEnv(PROD_FILE);
  for (const key of ["CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY"]) {
    if (!env[key]) continue;
    console.error(`${PROD_FILE} must not set ${key}.`);
    console.error("The CLI rejects that name next to CONVEX_SELF_HOSTED_URL.");
    process.exit(1);
  }
  for (const key of PROD_KEYS) {
    if (env[key]) continue;
    console.error(`${PROD_FILE} needs ${key}.`);
    process.exit(1);
  }
  if (isLoopback(env.CONVEX_SELF_HOSTED_URL)) {
    console.error(`${PROD_FILE} points at ${env.CONVEX_SELF_HOSTED_URL}.`);
    console.error("pnpm deploy:prod requires a non-loopback CONVEX_SELF_HOSTED_URL.");
    process.exit(1);
  }
  return env;
}

export function localProcessEnv() {
  const env = { ...process.env };
  delete env.CONVEX_DEPLOYMENT;
  delete env.CONVEX_DEPLOY_KEY;
  return env;
}

export function productionProcessEnv(fileEnv) {
  const env = { ...process.env };
  delete env.CONVEX_DEPLOYMENT;
  delete env.CONVEX_DEPLOY_KEY;
  for (const [key, value] of Object.entries(fileEnv)) {
    if (key.startsWith("VITE_") || key.startsWith("CONVEX_SELF_HOSTED_")) env[key] = value;
  }
  return env;
}
