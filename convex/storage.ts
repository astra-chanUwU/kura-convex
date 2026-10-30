"use node";

import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConvexError, v } from "convex/values";
import { thumbKeyFor } from "../shared/storage";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { requireUserId } from "./authz";
import { rating } from "./validators";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_THUMB_BYTES = 2 * 1024 * 1024;
const uploadKey = /^images\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function env(name: string, fallback: string) {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.[name];
  return value || fallback;
}

function bucket() {
  return env("KURA_S3_BUCKET", "kura-images");
}

function client(endpoint: string) {
  return new S3Client({
    region: "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env("KURA_S3_ACCESS_KEY_ID", "kura"),
      secretAccessKey: env("KURA_S3_SECRET_ACCESS_KEY", "kura-secret-key"),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export const prepareUpload = action({
  args: { contentType: v.string(), byteSize: v.number() },
  returns: v.object({
    storageKey: v.string(),
    uploadUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const ext = TYPES[args.contentType];
    if (!ext) throw new ConvexError("Use a JPEG, PNG, WebP, or GIF.");
    if (args.byteSize <= 0 || args.byteSize > MAX_BYTES) {
      throw new ConvexError("Pictures need to be under 20 MB.");
    }
    const storageKey = `images/${crypto.randomUUID()}.${ext}`;
    const signer = client(env("KURA_S3_PUBLIC_ENDPOINT", "http://127.0.0.1:9000"));
    const uploadUrl = await getSignedUrl(
      signer,
      new PutObjectCommand({
        Bucket: bucket(),
        Key: storageKey,
        ContentType: args.contentType,
      }),
      { expiresIn: 10 * 60 },
    );
    return { storageKey, uploadUrl };
  },
});

export const publish = action({
  args: {
    storageKey: v.string(),
    contentType: v.string(),
    byteSize: v.number(),
    width: v.number(),
    height: v.number(),
    originalName: v.string(),
    artist: v.string(),
    source: v.string(),
    caption: v.string(),
    rating,
    tags: v.array(v.string()),
    thumbKey: v.optional(v.string()),
  },
  returns: v.id("posts"),
  handler: async (ctx, args): Promise<Id<"posts">> => {
    const userId = await requireUserId(ctx);
    if (!TYPES[args.contentType] || !uploadKey.test(args.storageKey)) {
      throw new ConvexError("That upload is not a picture we signed.");
    }
    if (args.thumbKey !== undefined && args.thumbKey !== thumbKeyFor(args.storageKey)) {
      throw new ConvexError("That upload is not a picture we signed.");
    }
    const stored = client(env("KURA_S3_ENDPOINT", "http://minio:9000"));
    const head = await stored.send(new HeadObjectCommand({ Bucket: bucket(), Key: args.storageKey }));
    if (head.ContentLength !== args.byteSize || args.byteSize > MAX_BYTES) {
      throw new ConvexError("The upload size does not match the file.");
    }
    if (args.thumbKey) {
      const thumb = await stored.send(new HeadObjectCommand({ Bucket: bucket(), Key: args.thumbKey }));
      if (!thumb.ContentLength || thumb.ContentLength > MAX_THUMB_BYTES) {
        throw new ConvexError("The thumbnail did not land in storage.");
      }
    }
    const id = await ctx.runMutation(internal.posts.insertUploaded, {
      ...args,
      authorId: userId,
    });
    if (!args.thumbKey) {
      await ctx.scheduler.runAfter(0, internal.storage.ensureThumb, { postId: id, attempt: 0 });
    }
    return id;
  },
});

const retryDelays = [2_000, 15_000, 60_000];

export const ensureThumb = internalAction({
  args: { postId: v.id("posts"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.runQuery(internal.maintenance.thumbTarget, { postId: args.postId });
    if (!post || post.thumbKey) return null;
    const thumbKey = thumbKeyFor(post.storageKey);
    try {
      const response = await fetch(`${env("KURA_THUMB_URL", "http://thumbnails:8080")}/v1/thumbnails/batch`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env("KURA_THUMB_SECRET", "")}`,
        },
        body: JSON.stringify({ storageKeys: [post.storageKey] }),
        signal: AbortSignal.timeout(45_000),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: { storageKey: string; thumbKey: string; byteSize: number }[];
        failed?: { message: string }[];
        message?: string;
      } | null;
      if (response.status >= 400 && response.status < 500) {
        console.error(`Thumbnail refused for ${post.storageKey}: ${body?.message ?? response.status}`);
        return null;
      }
      const made = body?.ok?.find((item) => item.storageKey === post.storageKey && item.thumbKey === thumbKey);
      if (!response.ok || !made || made.byteSize <= 0 || made.byteSize > MAX_THUMB_BYTES) {
        throw new Error(body?.failed?.[0]?.message || body?.message || `Thumbnail service returned ${response.status}`);
      }
      const landed = await client(env("KURA_S3_ENDPOINT", "http://minio:9000")).send(
        new HeadObjectCommand({ Bucket: bucket(), Key: thumbKey }),
      );
      if (!landed.ContentLength || landed.ContentLength > MAX_THUMB_BYTES) {
        throw new Error("The thumbnail did not land in storage.");
      }
      const still = await ctx.runQuery(internal.maintenance.thumbTarget, { postId: args.postId });
      if (!still) {
        await ctx.scheduler.runAfter(0, internal.storage.deleteStored, { keys: [thumbKey] });
        return null;
      }
      await ctx.runMutation(internal.maintenance.setThumb, { postId: args.postId, thumbKey });
    } catch (error) {
      console.error(`Thumbnail failed for ${post.storageKey}`, error);
      const delay = retryDelays[args.attempt];
      if (delay !== undefined) {
        await ctx.scheduler.runAfter(delay, internal.storage.ensureThumb, {
          postId: args.postId,
          attempt: args.attempt + 1,
        });
      }
    }
    return null;
  },
});

export const deleteStored = internalAction({
  args: { keys: v.array(v.string()) },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const stored = client(env("KURA_S3_ENDPOINT", "http://minio:9000"));
    for (const key of args.keys) {
      if (!key.startsWith("images/")) continue;
      try {
        await stored.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
      } catch (error) {
        console.error(`Could not delete ${key}`, error);
      }
    }
    return null;
  },
});
