import { ConvexError, v } from "convex/values";
import { thumbKeyFor } from "../shared/storage";
import { internalMutation, internalQuery } from "./_generated/server";
import { searchTextFor } from "./records";

export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    cursor: v.string(),
    isDone: v.boolean(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("posts").paginate({ numItems: 8, cursor: args.cursor });
    let updated = 0;
    for (const post of result.page) {
      const searchText = searchTextFor(post);
      if (post.searchText !== searchText) {
        await ctx.db.patch(post._id, { searchText });
        updated += 1;
      }
      const links = await ctx.db
        .query("postTags")
        .withIndex("by_post", (q) => q.eq("postId", post._id))
        .take(80);
      const have = new Set(links.map((link) => link.tag));
      for (const link of links) {
        if (link.createdAt === post.createdAt) continue;
        await ctx.db.patch(link._id, { createdAt: post.createdAt });
        updated += 1;
      }
      for (const tag of post.tags) {
        if (have.has(tag)) continue;
        await ctx.db.insert("postTags", { postId: post._id, tag, createdAt: post.createdAt });
        updated += 1;
      }
      const favs = await ctx.db
        .query("favorites")
        .withIndex("by_post", (q) => q.eq("postId", post._id))
        .take(100);
      for (const fav of favs) {
        if (fav.createdAt === post.createdAt) continue;
        await ctx.db.patch(fav._id, { createdAt: post.createdAt });
        updated += 1;
      }
    }
    return { cursor: result.continueCursor, isDone: result.isDone, updated };
  },
});

export const postsMissingThumbs = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    cursor: v.string(),
    isDone: v.boolean(),
    posts: v.array(v.object({ id: v.id("posts"), storageKey: v.string() })),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("posts").paginate({ numItems: 20, cursor: args.cursor });
    return {
      cursor: result.continueCursor,
      isDone: result.isDone,
      posts: result.page.flatMap((post) => (post.thumbKey ? [] : [{ id: post._id, storageKey: post.storageKey }])),
    };
  },
});

export const thumbTarget = internalQuery({
  args: { postId: v.id("posts") },
  returns: v.union(
    v.object({ storageKey: v.string(), thumbKey: v.union(v.string(), v.null()) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    return { storageKey: post.storageKey, thumbKey: post.thumbKey ?? null };
  },
});

export const setThumb = internalMutation({
  args: { postId: v.id("posts"), thumbKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post || post.thumbKey) return null;
    if (args.thumbKey !== thumbKeyFor(post.storageKey)) {
      throw new ConvexError("That thumbnail does not belong to this picture.");
    }
    await ctx.db.patch(args.postId, { thumbKey: args.thumbKey });
    return null;
  },
});
