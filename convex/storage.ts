"use node";

import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireUserId } from "./authz";
import { rating } from "./validators";

const MAX_BYTES = 20 * 1024 * 1024;
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
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const ext = TYPES[args.contentType];
    if (!ext) throw new ConvexError("Use a JPEG, PNG, WebP, or GIF.");
    if (args.byteSize <= 0 || args.byteSize > MAX_BYTES) {
      throw new ConvexError("Pictures need to be under 20 MB.");
    }
    const storageKey = `images/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = await getSignedUrl(
      client(env("KURA_S3_PUBLIC_ENDPOINT", "http://127.0.0.1:9000")),
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
  },
  handler: async (ctx, args): Promise<Id<"posts">> => {
    const userId = await requireUserId(ctx);
    if (!TYPES[args.contentType] || !/^images\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(args.storageKey)) {
      throw new ConvexError("That upload is not a picture we signed.");
    }
    const head = await client(env("KURA_S3_ENDPOINT", "http://minio:9000")).send(
      new HeadObjectCommand({ Bucket: bucket(), Key: args.storageKey }),
    );
    if (head.ContentLength !== args.byteSize || args.byteSize > MAX_BYTES) {
      throw new ConvexError("The upload size does not match the file.");
    }
    return await ctx.runMutation(internal.posts.insertUploaded, {
      ...args,
      authorId: userId,
    });
  },
});
