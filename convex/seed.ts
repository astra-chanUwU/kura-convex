import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { searchTextFor, writeTags } from "./records";
import { normalizeTags, rating } from "./validators";

const postValidator = v.object({
  safebooruId: v.number(),
  storageKey: v.string(),
  thumbKey: v.optional(v.string()),
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

export const existingSafebooruIds = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.number()),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("posts").withIndex("by_safebooruId").paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.flatMap((row) => (row.safebooruId === undefined ? [] : [row.safebooruId])),
    };
  },
});

export const importBatch = internalMutation({
  args: { posts: v.array(postValidator) },
  returns: v.object({ inserted: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const post of args.posts) {
      const existing = await ctx.db
        .query("posts")
        .withIndex("by_safebooruId", (q) => q.eq("safebooruId", post.safebooruId))
        .unique();
      if (existing) continue;
      const tags = normalizeTags(post.tags, 40);
      const fields = {
        storageKey: post.storageKey,
        thumbKey: post.thumbKey,
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
      };
      const id = await ctx.db.insert("posts", { ...fields, searchText: searchTextFor(fields) });
      await writeTags(ctx, id, tags, post.createdAt);
      inserted += 1;
    }
    return { inserted };
  },
});
