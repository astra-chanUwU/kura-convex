import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const path = ".env.local";
if (!existsSync(path)) {
  console.error(".env.local is missing. Create the admin key before setting auth env.");
  process.exit(1);
}
const text = readFileSync(path, "utf8");
const values = Object.fromEntries(
  [...text.matchAll(/^([A-Z0-9_]+)='([^']*)'/gm)].map((match) => [match[1], match[2]]),
);

const thumbSecret = values.KURA_THUMB_SECRET || randomBytes(32).toString("hex");
const additions = {
  VITE_CONVEX_SITE_URL: "http://127.0.0.1:3211",
  VITE_SITE_URL: "http://127.0.0.1:5175",
  VITE_S3_PUBLIC_URL: "http://127.0.0.1:9000/kura-images",
  BETTER_AUTH_SECRET: values.BETTER_AUTH_SECRET || randomBytes(32).toString("base64"),
  KURA_THUMB_SECRET: thumbSecret,
};

let next = text;
if (next && !next.endsWith("\n")) next += "\n";
for (const [key, value] of Object.entries(additions)) {
  if (!next.includes(`${key}=`)) next += `${key}='${value}'\n`;
}
if (next !== text) writeFileSync(path, next);

const convexEnv = {
  SITE_URL: "http://127.0.0.1:5175",
  BETTER_AUTH_SECRET: additions.BETTER_AUTH_SECRET,
  KURA_S3_ENDPOINT: "http://host.docker.internal:9000",
  KURA_S3_PUBLIC_ENDPOINT: "http://127.0.0.1:9000",
  KURA_S3_BUCKET: "kura-images",
  KURA_S3_ACCESS_KEY_ID: "kura",
  KURA_S3_SECRET_ACCESS_KEY: "kura-secret-key",
  KURA_THUMB_URL: "http://thumbnails:8080",
  KURA_THUMB_SECRET: thumbSecret,
};
for (const [key, value] of Object.entries(convexEnv)) {
  execFileSync("pnpm", ["exec", "convex", "env", "set", key, value], {
    stdio: ["ignore", "pipe", "inherit"],
    shell: true,
  });
  console.log(`Set Convex env ${key}`);
}
