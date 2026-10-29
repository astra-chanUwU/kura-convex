import { existsSync, readFileSync } from "node:fs";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const TARGET = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? 1200);
const MILESTONE = 400;
const BUCKET = "kura-images";
const ENDPOINT = "http://127.0.0.1:9000";
const BLOCKED = new Set(["loli", "shota", "shotacon", "child", "underage", "toddler", "infant", "baby"]);
const SEARCHES = [
  "yuri 1girl -loli -shota -child",
  "cyberpunk 1girl -loli -shota -child",
  "cute 1girl -loli -shota -child",
  "yuri cute -loli -shota -child",
  "cyberpunk -loli -shota -child",
];

const env = readEnv(".env.local");
const convexUrl = env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210";
const seedToken = env.SEED_TOKEN;
if (!seedToken) {
  console.error("SEED_TOKEN is missing from .env.local. Run: node scripts/ensure-env.mjs");
  process.exit(1);
}

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: "kura", secretAccessKey: "kura-secret-key" },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const convex = new ConvexHttpClient(convexUrl);

await ensureBucket();
const chosen = await collectPosts();
const existing = new Set(await convex.query(anyApi.seed.existingSafebooruIds, {}));
console.log(`Safebooru pool ${chosen.length}. Already stored ${existing.size}. Target ${TARGET}.`);

let stored = chosen.filter((post) => existing.has(post.id)).length;
let announced = stored >= MILESTONE;
const pending = chosen.filter((post) => !existing.has(post.id));
let batch = [];

for (let i = 0; i < pending.length && stored < TARGET; i += 4) {
  const slice = pending.slice(i, i + 4);
  const downloaded = await Promise.all(slice.map((post) => download(post)));
  for (const item of downloaded) {
    if (!item || stored >= TARGET) continue;
    batch.push(item);
    if (batch.length >= 8) {
      stored += await flush(batch);
      batch = [];
      announce(stored);
    }
  }
}
if (batch.length > 0 && stored < TARGET) {
  stored += await flush(batch);
  announce(stored);
}
console.log(`Board has ${stored} Safebooru pictures (target ${TARGET}).`);

function announce(count) {
  if (!announced && count >= MILESTONE) {
    announced = true;
    console.log(`Milestone: ${MILESTONE} pictures are on the board. Continuing to ${TARGET}.`);
  }
  console.log(`Stored ${count}/${TARGET}`);
}

async function flush(posts) {
  const result = await convex.mutation(anyApi.seed.importBatch, {
    token: seedToken,
    posts,
  });
  return result.inserted;
}

async function collectPosts() {
  const byId = new Map();
  for (const tags of SEARCHES) {
    for (let page = 0; page < 12; page += 1) {
      const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=100&pid=${page}&tags=${encodeURIComponent(tags)}`;
      const response = await fetch(url, { headers: { "user-agent": "kura-convex-seed/0.1" } });
      if (!response.ok) break;
      const body = await response.json();
      const posts = Array.isArray(body) ? body : body?.post ?? [];
      if (!Array.isArray(posts) || posts.length === 0) break;
      for (const post of posts) {
        const normalized = normalize(post);
        if (normalized) byId.set(normalized.id, normalized);
      }
      if (byId.size >= TARGET * 2) break;
      await delay(200);
    }
    if (byId.size >= TARGET * 2) break;
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || b.change - a.change)
    .slice(0, TARGET + 80);
}

function normalize(post) {
  if (!post || post.rating !== "general" || typeof post.id !== "number") return null;
  const tags = String(post.tags ?? "")
    .split(/\s+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  if (tags.some((tag) => BLOCKED.has(tag))) return null;
  const sample = post.sample_url || post.file_url;
  if (!sample) return null;
  const liked = ["yuri", "cute", "cyberpunk", "1girl"];
  tags.sort((a, b) => Number(liked.includes(b)) - Number(liked.includes(a)));
  let score = 0;
  if (tags.includes("yuri")) score += 3;
  if (tags.includes("cyberpunk")) score += 3;
  if (tags.includes("cute")) score += 2;
  if (tags.includes("1girl")) score += 1;
  const caption = tags
    .filter((tag) => tag.includes("(") || tag.includes("_"))
    .slice(0, 2)
    .map((tag) => tag.replaceAll("_", " ").replaceAll("(", "("))
    .join(", ");
  return {
    id: post.id,
    tags,
    score,
    change: Number(post.change) || 0,
    width: Number(post.sample_width || post.width) || 0,
    height: Number(post.sample_height || post.height) || 0,
    url: String(sample).replaceAll("\\/", "/"),
    page: `https://safebooru.org/index.php?page=post&s=view&id=${post.id}`,
    caption,
    name: String(post.image ?? `${post.id}.jpg`),
  };
}

async function download(post) {
  try {
    const response = await fetch(post.url, { headers: { "user-agent": "kura-convex-seed/0.1" } });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 20 * 1024 * 1024) return null;
    const ext = extension(post.url, response.headers.get("content-type"));
    const storageKey = `images/safebooru/${post.id}.${ext}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        Body: bytes,
        ContentType: contentType(ext),
      }),
    );
    return {
      safebooruId: post.id,
      storageKey,
      contentType: contentType(ext),
      byteSize: bytes.length,
      width: post.width,
      height: post.height,
      originalName: post.name.slice(0, 180),
      artist: "",
      source: post.page,
      caption: post.caption.slice(0, 500),
      rating: "safe",
      createdAt: post.change * 1000 + (post.id % 1000),
      tags: post.tags.slice(0, 16),
    };
  } catch (error) {
    console.error(`Skip ${post.id}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function extension(url, header) {
  if (header?.includes("png") || url.endsWith(".png")) return "png";
  if (header?.includes("webp") || url.endsWith(".webp")) return "webp";
  if (header?.includes("gif") || url.endsWith(".gif")) return "gif";
  return "jpg";
}

function contentType(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function ensureBucket() {
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
