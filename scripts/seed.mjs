import { existsSync, realpathSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { BOARD_ORDER, boardFor, collect, helpText, resolvePlan, skipReason } from "./seed-lib.mjs";
import { assertLocalBackend } from "./target.mjs";

const BUCKET = "kura-images";
const ENDPOINT = "http://127.0.0.1:9000";

export async function main(args) {
  const plan = resolvePlan(args);
  if (plan.help) {
    console.log(helpText());
    return;
  }
  const env = readEnv(".env.local");
  const name = plan.preset || "custom";
  console.log(`${name}: ${plan.boards.join(", ")} · ${plan.ratings.join(", ")} · ${plan.tags.length} tags · target ${plan.limit}.`);
  console.log("Posts tagged as minors are skipped.");
  const boards = plan.boards
    .slice()
    .sort((a, b) => BOARD_ORDER.indexOf(a) - BOARD_ORDER.indexOf(b));
  if (!plan.dryRun && !env.CONVEX_SELF_HOSTED_ADMIN_KEY) {
    console.error("CONVEX_SELF_HOSTED_ADMIN_KEY is missing from .env.local.");
    process.exit(1);
  }
  if (!plan.dryRun) assertLocalBackend(env, "pnpm seed");

  let convex = null;
  if (!plan.dryRun) {
    const s3 = s3Client();
    await ensureBucket(s3);
    convex = new ConvexHttpClient(env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210");
    convex.setAdminAuth(env.CONVEX_SELF_HOSTED_ADMIN_KEY);
    await importBoards(plan, boards, env, convex, s3);
    return;
  }
  await previewBoards(plan, boards, env);
}

async function previewBoards(plan, boards, env) {
  let remaining = plan.limit;
  let seen = 0;
  let failed = 0;
  const queue = boards.slice();
  while (queue.length > 0 && remaining > 0) {
    const id = queue.shift();
    const board = boardFor(id, env);
    const reason = skipReason(board);
    const target = Math.ceil(remaining / (queue.length + 1));
    if (reason) {
      console.error(`${board.label}: ${reason}`);
      failed += 1;
      continue;
    }
    try {
      const posts = await collect(board, plan.tags, plan.ratings, target, plan.pages);
      const toward = Math.min(target, posts.length);
      remaining -= toward;
      seen += posts.length;
      const sample = posts
        .slice(0, 3)
        .map((post) => `${post.id} ${post.rating} ${post.score}`)
        .join(", ");
      console.log(`${board.label} would consider ${posts.length} (target ${target})${sample ? `: ${sample}` : ""}.`);
    } catch (error) {
      if (!error?.unavailable) throw error;
      console.error(`${board.label}: ${error.message}`);
      failed += 1;
    }
  }
  if (seen === 0 && failed > 0) process.exit(1);
}

async function importBoards(plan, boards, env, convex, s3) {
  let remaining = plan.limit;
  let imported = 0;
  let covered = 0;
  let failed = 0;
  const queue = boards.slice();
  while (queue.length > 0 && remaining > 0) {
    const id = queue.shift();
    const board = boardFor(id, env);
    const reason = skipReason(board);
    const target = Math.ceil(remaining / (queue.length + 1));
    if (reason) {
      console.error(`${board.label}: ${reason}`);
      failed += 1;
      continue;
    }
    try {
      const posts = await collect(board, plan.tags, plan.ratings, target, plan.pages);
      const existing = await existingIds(convex, board.id);
      const result = await storePosts(s3, convex, posts, existing, target);
      remaining -= result.toward;
      imported += result.imported;
      covered += result.toward;
      console.log(`${board.label} stored ${result.imported} new pictures (${result.toward}/${target} covered).`);
    } catch (error) {
      if (!error?.unavailable) throw error;
      console.error(`${board.label}: ${error.message}`);
      failed += 1;
    }
  }
  if (imported === 0 && covered === 0 && failed > 0) {
    console.error("No pictures were imported.");
    process.exit(1);
  }
  console.log(`Done. Imported ${imported} new pictures. Target ${plan.limit}.`);
}

async function storePosts(s3, convex, posts, existing, target) {
  let have = posts.filter((post) => existing.has(post.id)).length;
  let imported = 0;
  const pending = posts.filter((post) => !existing.has(post.id));
  let batch = [];
  for (let i = 0; i < pending.length && have + imported < target; i += 4) {
    const downloaded = await Promise.all(pending.slice(i, i + 4).map((post) => download(s3, post)));
    for (const item of downloaded) {
      if (!item || have + imported >= target) continue;
      batch.push(item);
      if (batch.length >= 8) {
        imported += await flush(convex, batch);
        batch = [];
        console.log(`Stored ${have + imported}/${target}`);
      }
    }
  }
  if (batch.length > 0 && have + imported < target) {
    imported += await flush(convex, batch);
    console.log(`Stored ${have + imported}/${target}`);
  }
  return { toward: Math.min(target, have + imported), imported };
}

async function existingIds(convex, boardId) {
  const ids = new Set();
  if (boardId === "safebooru") await eachPage(convex, "existingSafebooruIds", {}, ids);
  await eachPage(convex, "existingSourceIds", { sourceBoard: boardId }, ids);
  return ids;
}

async function eachPage(convex, name, extra, ids) {
  let cursor = null;
  for (;;) {
    const page = await convex.query(anyApi.seed[name], {
      ...extra,
      paginationOpts: { numItems: 200, cursor },
    });
    for (const id of page.page) ids.add(id);
    if (page.isDone) return;
    cursor = page.continueCursor;
  }
}

async function flush(convex, posts) {
  const result = await convex.mutation(anyApi.seed.importBatch, { posts });
  return result.inserted;
}

async function download(s3, post) {
  try {
    const storageKey = `images/${post.board}/${post.id}.${post.ext}`;
    const existing = await objectHead(s3, storageKey);
    let byteSize = existing?.ContentLength ?? 0;
    let type = existing?.ContentType || contentType(post.ext);
    let key = storageKey;
    if (!byteSize) {
      const response = await fetch(post.url, { headers: { "user-agent": "kura-convex-seed/0.1" } });
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > 20 * 1024 * 1024) return null;
      const ext = extension(post.url, response.headers.get("content-type"));
      key = `images/${post.board}/${post.id}.${ext}`;
      type = contentType(ext);
      byteSize = bytes.length;
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: type }));
    }
    return finish(post, key, byteSize, type);
  } catch (error) {
    console.error(`Skip ${post.board} ${post.id}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function finish(post, storageKey, byteSize, type) {
  return {
    sourceBoard: post.board,
    sourceId: post.id,
    ...(post.board === "safebooru" ? { safebooruId: post.id } : {}),
    storageKey,
    contentType: type,
    byteSize,
    width: post.width,
    height: post.height,
    originalName: post.name.slice(0, 180),
    artist: post.artist,
    source: post.page,
    caption: post.caption,
    rating: post.rating,
    createdAt: post.createdAt,
    tags: post.tags,
  };
}

function s3Client() {
  return new S3Client({
    region: "us-east-1",
    endpoint: ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: "kura", secretAccessKey: "kura-secret-key" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

async function objectHead(s3, key) {
  try {
    return await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    return null;
  }
}

function extension(url, header) {
  const path = url.split("?")[0].toLowerCase();
  if (header?.includes("png") || path.endsWith(".png")) return "png";
  if (header?.includes("webp") || path.endsWith(".webp")) return "webp";
  if (header?.includes("gif") || path.endsWith(".gif")) return "gif";
  return "jpg";
}

function contentType(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function ensureBucket(s3) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  for (const command of [
    new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      }),
    }),
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
          },
        ],
      },
    }),
  ]) {
    try {
      await s3.send(command);
    } catch (error) {
      console.warn(`Bucket setting skipped: ${error instanceof Error ? error.message : error}`);
    }
  }
}

function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)='?([^']*)'?$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function isEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

if (isEntry()) {
  main(process.argv.slice(2)).catch((error) => {
    if (error?.usage) console.error(error.message);
    else console.error(error);
    process.exit(1);
  });
}
