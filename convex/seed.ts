import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { searchTextFor, writeTags } from "./records";
import { font, normalizeTags, rating, theme } from "./validators";

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

const contributor = v.object({
  userId: v.string(),
  focus: v.union(v.literal("yuri"), v.literal("cute"), v.literal("cyberpunk"), v.literal("mixed")),
});

export const assignAuthors = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    authors: v.array(contributor),
  },
  returns: v.object({
    cursor: v.string(),
    isDone: v.boolean(),
    updated: v.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("posts").paginate({ numItems: 24, cursor: args.cursor });
    let updated = 0;
    let index = 0;
    for (const post of result.page) {
      if (post.authorId !== "safebooru" || args.authors.length === 0) continue;
      const focus = post.tags.includes("cyberpunk")
        ? "cyberpunk"
        : post.tags.includes("yuri")
          ? "yuri"
          : post.tags.includes("cute")
            ? "cute"
            : "mixed";
      const pool = args.authors.filter((author) => author.focus === focus);
      const use = pool.length > 0 ? pool : args.authors.filter((author) => author.focus === "mixed");
      const chosen = (use.length > 0 ? use : args.authors)[index % (use.length > 0 ? use.length : args.authors.length)];
      index += 1;
      if (!chosen) continue;
      await ctx.db.patch(post._id, { authorId: chosen.userId });
      updated += 1;
    }
    return { cursor: result.continueCursor, isDone: result.isDone, updated };
  },
});

export const saveProfile = internalMutation({
  args: {
    userId: v.string(),
    displayName: v.string(),
    bio: v.string(),
    location: v.string(),
    website: v.string(),
    theme,
    font,
    showSensitive: v.boolean(),
    includeTags: v.array(v.string()),
    excludeTags: v.array(v.string()),
    saveTag: v.optional(v.string()),
    saves: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const next = {
      userId: args.userId,
      displayName: args.displayName.slice(0, 60),
      bio: args.bio.slice(0, 500),
      location: args.location.slice(0, 80),
      website: args.website.slice(0, 200),
      theme: args.theme,
      font: args.font,
      showSensitive: args.showSensitive,
      includeTags: normalizeTags(args.includeTags),
      excludeTags: normalizeTags(args.excludeTags),
    };
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, next);
    else await ctx.db.insert("preferences", next);

    const want = Math.min(Math.max(args.saves, 0), 80);
    const saveTag = args.saveTag;
    if (want === 0) return null;
    const posts = saveTag
      ? (
          await ctx.db
            .query("postTags")
            .withIndex("by_tag_createdAt", (q) => q.eq("tag", saveTag))
            .order("desc")
            .take(want)
        ).map((link) => link.postId)
      : (
          await ctx.db.query("posts").withIndex("by_createdAt").order("desc").take(want)
        ).map((post) => post._id);
    for (const postId of posts) {
      const saved = await ctx.db
        .query("favorites")
        .withIndex("by_user_post", (q) => q.eq("userId", args.userId).eq("postId", postId))
        .unique();
      if (saved) continue;
      const post = await ctx.db.get(postId);
      if (!post) continue;
      await ctx.db.insert("favorites", { userId: args.userId, postId, createdAt: post.createdAt });
    }
    return null;
  },
});
