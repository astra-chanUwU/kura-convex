import { existsSync, readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { requestThumbnails } from "./thumb-client.mjs";

const env = readEnv(".env.local");
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
let thumbs = 0;
for (;;) {
  const page = await convex.query(anyApi.maintenance.postsMissingThumbs, { cursor });
  if (page.posts.length > 0) {
    if (!env.KURA_THUMB_SECRET) {
      console.error("KURA_THUMB_SECRET is missing. Run node scripts/ensure-env.mjs, then pnpm thumbs.");
      process.exit(1);
    }
    const result = await requestThumbnails(
      page.posts.map((post) => post.storageKey),
      env,
    );
    const posts = new Map(page.posts.map((post) => [post.storageKey, post]));
    for (const item of result.ok) {
      const post = posts.get(item.storageKey);
      if (!post) continue;
      await convex.mutation(anyApi.maintenance.setThumb, { postId: post.id, thumbKey: item.thumbKey });
      thumbs += 1;
      if (thumbs % 25 === 0) console.log(`Thumbnails ${thumbs}`);
    }
    for (const item of result.failed) {
      console.error(`\nSkip thumb ${item.storageKey}: ${item.message}`);
    }
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
