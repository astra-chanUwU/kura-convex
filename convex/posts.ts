import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./authz";
import { normalizeTags, rating } from "./validators";

const pageSize = 48;

async function viewerFilter(ctx: QueryCtx) {
  const userId = await optionalUserId(ctx);
  const prefs = userId
    ? await ctx.db
        .query("preferences")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique()
    : null;
  return {
    userId,
    showSensitive: prefs?.showSensitive ?? false,
    includeTags: prefs?.includeTags ?? [],
    excludeTags: prefs?.excludeTags ?? [],
  };
}

function visible(
  post: { rating: "safe" | "questionable" | "explicit"; tags: string[] },
  filter: { showSensitive: boolean; includeTags: string[]; excludeTags: string[] },
) {
  if (!filter.showSensitive && post.rating !== "safe") return false;
  if (filter.includeTags.some((tag) => !post.tags.includes(tag))) return false;
  if (filter.excludeTags.some((tag) => post.tags.includes(tag))) return false;
  return true;
}

export const list = query({
  args: {
    q: v.optional(v.string()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const filter = await viewerFilter(ctx);
    const needle = (args.q ?? "").trim().toLowerCase();
    const favoriteIds = new Set<Id<"posts">>();
    if (filter.userId) {
      const favs = await ctx.db
        .query("favorites")
        .withIndex("by_user_post", (q) => q.eq("userId", filter.userId!))
        .take(500);
      for (const fav of favs) favoriteIds.add(fav.postId);
    }

    const posts = needle
      ? await postsForTag(ctx, needle, args.before)
      : await ctx.db
          .query("posts")
          .withIndex("by_createdAt", (q) =>
            args.before === undefined ? q : q.lt("createdAt", args.before),
          )
          .order("desc")
          .take(pageSize * 4);

    const page = [];
    for (const post of posts) {
      if (!visible(post, filter)) continue;
      if (
        needle &&
        !post.tags.includes(needle) &&
        !`${post.caption} ${post.artist} ${post.source}`.toLowerCase().includes(needle)
      ) {
        continue;
      }
      page.push({
        _id: post._id,
        storageKey: post.storageKey,
        contentType: post.contentType,
        byteSize: post.byteSize,
        width: post.width,
        height: post.height,
        artist: post.artist,
        source: post.source,
        caption: post.caption,
        rating: post.rating,
        createdAt: post.createdAt,
        tags: post.tags,
        safebooruId: post.safebooruId ?? null,
        favorite: favoriteIds.has(post._id),
      });
      if (page.length >= pageSize) break;
    }
    return page;
  },
});

async function postsForTag(ctx: QueryCtx, tag: string, before: number | undefined) {
  const links = await ctx.db
    .query("postTags")
    .withIndex("by_tag", (q) => q.eq("tag", tag))
    .take(1500);
  const posts = [];
  for (const link of links) {
    const post = await ctx.db.get(link.postId);
    if (!post) continue;
    if (before !== undefined && post.createdAt >= before) continue;
    posts.push(post);
  }
  posts.sort((a, b) => b.createdAt - a.createdAt);
  return posts.slice(0, pageSize * 4);
}

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("posts", args.id);
    if (!id) return null;
    const post = await ctx.db.get(id);
    if (!post) return null;
    const filter = await viewerFilter(ctx);
    if (!visible(post, filter)) return null;
    const favorite = filter.userId
      ? await ctx.db
          .query("favorites")
          .withIndex("by_user_post", (q) => q.eq("userId", filter.userId!).eq("postId", id))
          .unique()
      : null;
    return {
      _id: post._id,
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
      tags: post.tags,
      safebooruId: post.safebooruId ?? null,
      favorite: favorite !== null,
      mine: filter.userId !== null && filter.userId === post.authorId,
    };
  },
});

export const tags = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tagStats").withIndex("by_count").order("desc").take(24);
    return rows.map((row) => ({ tag: row.tag, count: row.count }));
  },
});

export const toggleFavorite = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new ConvexError("That picture is gone.");
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", args.postId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("favorites", { userId, postId: args.postId });
    return true;
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    if (post.authorId !== userId) throw new ConvexError("You can only remove your own pictures.");
    const tags = await ctx.db
      .query("postTags")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .take(80);
    for (const tag of tags) {
      await ctx.db.delete(tag._id);
      const stat = await ctx.db
        .query("tagStats")
        .withIndex("by_tag", (q) => q.eq("tag", tag.tag))
        .unique();
      if (stat) {
        if (stat.count <= 1) await ctx.db.delete(stat._id);
        else await ctx.db.patch(stat._id, { count: stat.count - 1 });
      }
    }
    const favs = await ctx.db
      .query("favorites")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .take(100);
    for (const fav of favs) await ctx.db.delete(fav._id);
    await ctx.db.delete(args.postId);
    return post.storageKey;
  },
});

export const insertUploaded = internalMutation({
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
    authorId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.authorId;
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_storageKey", (q) => q.eq("storageKey", args.storageKey))
      .unique();
    if (existing) return existing._id;
    const tags = normalizeTags(args.tags);
    const source = clipSource(args.source);
    const id = await ctx.db.insert("posts", {
      storageKey: args.storageKey,
      contentType: args.contentType,
      byteSize: args.byteSize,
      width: args.width,
      height: args.height,
      originalName: clipText(args.originalName, 180),
      artist: clipText(args.artist, 80),
      source,
      caption: clipText(args.caption, 500),
      rating: args.rating,
      createdAt: Date.now(),
      authorId: userId,
      tags,
    });
    for (const tag of tags) {
      await ctx.db.insert("postTags", { postId: id, tag });
      const stat = await ctx.db
        .query("tagStats")
        .withIndex("by_tag", (q) => q.eq("tag", tag))
        .unique();
      if (stat) await ctx.db.patch(stat._id, { count: stat.count + 1 });
      else await ctx.db.insert("tagStats", { tag, count: 1 });
    }
    return id;
  },
});

function clipText(value: string, max: number) {
  return value.trim().slice(0, max);
}

function clipSource(value: string) {
  const source = clipText(value, 300);
  if (source && !/^https?:\/\//i.test(source)) {
    throw new ConvexError("Source needs to start with http:// or https://.");
  }
  return source;
}
