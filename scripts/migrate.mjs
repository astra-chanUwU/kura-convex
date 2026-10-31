import { existsSync, readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { assertLocalBackend } from "./target.mjs";

const env = readEnv(".env.local");
assertLocalBackend(env, "pnpm migrate");
const adminKey = env.CONVEX_SELF_HOSTED_ADMIN_KEY;
if (!adminKey) {
  console.error("CONVEX_SELF_HOSTED_ADMIN_KEY is missing from .env.local.");
  process.exit(1);
}

const convex = new ConvexHttpClient(env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210");
convex.setAdminAuth(adminKey);

let cursor = null;
let updated = 0;
for (;;) {
  const page = await convex.mutation(anyApi.maintenance.backfill, { cursor });
  updated += page.updated;
  process.stdout.write(`\rIndexed ${updated} fields`);
  if (page.isDone) break;
  cursor = page.cursor;
}
console.log(`\nSearch text and tag order are filled.`);

cursor = null;
let saves = 0;
for (;;) {
  const page = await convex.mutation(anyApi.maintenance.backfillFavoriteCounts, { cursor });
  saves += page.updated;
  process.stdout.write(`\rFavorite counts ${saves}`);
  if (page.isDone) break;
  cursor = page.cursor;
}
console.log(`\nFavorite counts are filled.`);

cursor = null;
let thumbs = 0;
for (;;) {
  const page = await convex.query(anyApi.maintenance.postsMissingThumbs, { cursor });
  for (const post of page.posts) {
    try {
      await convex.action(anyApi.storage.ensureThumb, { postId: post.id, attempt: 0 });
    } catch (error) {
      console.error(`\nSkip thumb ${post.storageKey}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    const after = await convex.query(anyApi.maintenance.thumbTarget, { postId: post.id });
    if (!after?.thumbKey) {
      console.error(`\nSkip thumb ${post.storageKey}`);
      continue;
    }
    thumbs += 1;
    if (thumbs % 25 === 0) console.log(`Thumbnails ${thumbs}`);
  }
  if (page.isDone) break;
  cursor = page.cursor;
}
console.log(`Thumbnails written: ${thumbs}.`);

function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)='?([^']*)'?$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}
