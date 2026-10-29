import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
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
  };
}

function visible(
  post: { rating: "safe" | "questionable" | "explicit" },
  filter: { showSensitive: boolean },
) {
  return filter.showSensitive || post.rating === "safe";
}

function matchesQuery(
  post: Doc<"posts">,
  include: string[],
  exclude: string[],
  needle: string,
) {
  if (include.some((tag) => !post.tags.includes(tag))) return false;
  if (exclude.some((tag) => post.tags.includes(tag))) return false;
  if (!needle) return true;
  if (post.tags.includes(needle)) return true;
  return `${post.caption} ${post.artist} ${post.source} ${post.originalName} ${post.tags.join(" ")}`
    .toLowerCase()
    .includes(needle);
}

export const list = query({
  args: {
    q: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    exclude: v.optional(v.array(v.string())),
    sort: v.optional(v.union(v.literal("newest"), v.literal("oldest"))),
    before: v.optional(v.number()),
    saved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const filter = await viewerFilter(ctx);
    const include = normalizeTags(args.tags ?? [], 12);
    const exclude = normalizeTags(args.exclude ?? [], 12);
    const needle = (args.q ?? "").trim().toLowerCase();
    const oldest = args.sort === "oldest";
    const favoriteIds = new Set<Id<"posts">>();
    if (filter.userId) {
      const favs = await ctx.db
        .query("favorites")
        .withIndex("by_user_post", (q) => q.eq("userId", filter.userId!))
        .take(500);
      for (const fav of favs) favoriteIds.add(fav.postId);
    }

    const page: Array<{
      _id: Id<"posts">;
      storageKey: string;
      contentType: string;
      byteSize: number;
      width: number;
      height: number;
      artist: string;
      source: string;
      caption: string;
      rating: "safe" | "questionable" | "explicit";
      createdAt: number;
      tags: string[];
      safebooruId: number | null;
      favorite: boolean;
    }> = [];
    let cursor = args.before;
    for (let round = 0; round < 4 && page.length < pageSize; round++) {
      const batch = args.saved
        ? await savedPosts(ctx, filter.userId, cursor, oldest)
        : include[0]
          ? await taggedPosts(ctx, include[0], cursor, oldest)
          : await recentPosts(ctx, cursor, oldest);
      if (batch.length === 0) break;
      for (const post of batch) {
        if (!visible(post, filter) || !matchesQuery(post, include, exclude, needle)) continue;
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
      const edge = batch[batch.length - 1]?.createdAt;
      if (edge === undefined || edge === cursor) break;
      cursor = edge;
      if (args.saved) break;
    }
    return page;
  },
});

function inPage(createdAt: number, cursor: number | undefined, oldest: boolean) {
  if (cursor === undefined) return true;
  return oldest ? createdAt > cursor : createdAt < cursor;
}

async function savedPosts(ctx: QueryCtx, userId: string | null, cursor: number | undefined, oldest: boolean) {
  if (!userId) return [];
  const favs = await ctx.db
    .query("favorites")
    .withIndex("by_user_post", (q) => q.eq("userId", userId))
    .take(300);
  const posts: Doc<"posts">[] = [];
  for (const fav of favs) {
    const post = await ctx.db.get(fav.postId);
    if (!post || !inPage(post.createdAt, cursor, oldest)) continue;
    posts.push(post);
  }
  posts.sort((a, b) => (oldest ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
  return posts;
}

async function recentPosts(ctx: QueryCtx, cursor: number | undefined, oldest: boolean) {
  return ctx.db
    .query("posts")
    .withIndex("by_createdAt", (q) => {
      if (cursor === undefined) return q;
      return oldest ? q.gt("createdAt", cursor) : q.lt("createdAt", cursor);
    })
    .order(oldest ? "asc" : "desc")
    .take(160);
}

async function taggedPosts(ctx: QueryCtx, tag: string, cursor: number | undefined, oldest: boolean) {
  const links = await ctx.db
    .query("postTags")
    .withIndex("by_tag", (q) => q.eq("tag", tag))
    .take(400);
  const posts: Doc<"posts">[] = [];
  for (const link of links) {
    const post = await ctx.db.get(link.postId);
    if (!post || !inPage(post.createdAt, cursor, oldest)) continue;
    posts.push(post);
  }
  posts.sort((a, b) => (oldest ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
  return posts.slice(0, 160);
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

export const suggest = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeTags([args.q.replace(/^-/, "")], 1)[0];
    if (!needle) return [];
    const rows = await ctx.db.query("tagStats").withIndex("by_count").order("desc").take(300);
    return rows
      .filter((row) => row.tag.includes(needle))
      .slice(0, 8)
      .map((row) => ({ tag: row.tag, count: row.count }));
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
