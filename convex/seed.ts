import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { normalizeTags, rating } from "./validators";

function expectedToken() {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.SEED_TOKEN;
}

const postValidator = v.object({
  safebooruId: v.number(),
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
  createdAt: v.number(),
  tags: v.array(v.string()),
});

export const existingSafebooruIds = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("posts").withIndex("by_safebooruId").take(2000);
    return rows.flatMap((row) => (row.safebooruId === undefined ? [] : [row.safebooruId]));
  },
});

export const importBatch = mutation({
  args: {
    token: v.string(),
    posts: v.array(postValidator),
  },
  handler: async (ctx, args) => {
    const token = expectedToken();
    if (!token || args.token !== token) {
      throw new ConvexError("Seed is closed.");
    }
    let inserted = 0;
    for (const post of args.posts) {
      const existing = await ctx.db
        .query("posts")
        .withIndex("by_safebooruId", (q) => q.eq("safebooruId", post.safebooruId))
        .unique();
      if (existing) continue;
      const tags = normalizeTags(post.tags, 40);
      const id = await ctx.db.insert("posts", {
        storageKey: post.storageKey,
        contentType: post.contentType,
        byteSize: post.byteSize,
        width: post.width,
        height: post.height,
        originalName: post.originalName,
        artist: post.artist,
        source: post.source,
        caption: post.caption,
        rating: post.rating,
        createdAt: post.createdAt,
        authorId: "safebooru",
        safebooruId: post.safebooruId,
        tags,
      });
      await writeTags(ctx, id, tags);
      inserted += 1;
    }
    return { inserted };
  },
});

async function writeTags(ctx: MutationCtx, postId: Id<"posts">, tags: string[]) {
  for (const tag of tags) {
    await ctx.db.insert("postTags", { postId, tag });
    const stat = await ctx.db
      .query("tagStats")
      .withIndex("by_tag", (q) => q.eq("tag", tag))
      .unique();
    if (stat) await ctx.db.patch(stat._id, { count: stat.count + 1 });
    else await ctx.db.insert("tagStats", { tag, count: 1 });
  }
}
