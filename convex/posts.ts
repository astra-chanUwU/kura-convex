import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { thumbKeyFor } from "../shared/storage";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { optionalUserId, requireUserId } from "./authz";
import { deletePostGraph, searchTextFor, writeTags } from "./records";
import { normalizeTag, normalizeTags, postCard, postDetail, rating, tagCount } from "./validators";

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

function matches(
  post: Doc<"posts">,
  showSensitive: boolean,
  include: string[],
  exclude: string[],
  needle: string,
) {
  if (!showSensitive && post.rating !== "safe") return false;
  if (include.some((tag) => !post.tags.includes(tag))) return false;
  if (exclude.some((tag) => post.tags.includes(tag))) return false;
  if (!needle) return true;
  return (post.searchText ?? searchTextFor(post)).includes(needle);
}

function toCard(post: Doc<"posts">, favorite: boolean) {
  return {
    _id: post._id,
    storageKey: post.storageKey,
    thumbKey: post.thumbKey ?? null,
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
    favorite,
  };
}

async function favoriteFlag(ctx: QueryCtx, userId: string | null, postId: Id<"posts">) {
  if (!userId) return false;
  const row = await ctx.db
    .query("favorites")
    .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", postId))
    .unique();
  return row !== null;
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    q: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    exclude: v.optional(v.array(v.string())),
    sort: v.optional(v.union(v.literal("newest"), v.literal("oldest"))),
    saved: v.optional(v.boolean()),
  },
  returns: paginationResultValidator(postCard),
  handler: async (ctx, args) => {
    const filter = await viewerFilter(ctx);
    const include = normalizeTags(args.tags ?? [], 12);
    const exclude = normalizeTags(args.exclude ?? [], 12);
    const needle = (args.q ?? "").trim().toLowerCase();
    const oldest = args.sort === "oldest";
    const order = oldest ? "asc" : "desc";

    if (args.saved) {
      const userId = filter.userId ?? "";
      const result = await ctx.db
        .query("favorites")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
        .order(order)
        .paginate(args.paginationOpts);
      const page = [];
      for (const fav of result.page) {
        const post = await ctx.db.get(fav.postId);
        if (!post || !matches(post, filter.showSensitive, include, exclude, needle)) continue;
        page.push(toCard(post, true));
      }
      return { ...result, page };
    }

    if (include[0]) {
      const result = await ctx.db
        .query("postTags")
        .withIndex("by_tag_createdAt", (q) => q.eq("tag", include[0]!))
        .order(order)
        .paginate(args.paginationOpts);
      const page = [];
      for (const link of result.page) {
        const post = await ctx.db.get(link.postId);
        if (!post || !matches(post, filter.showSensitive, include, exclude, needle)) continue;
        page.push(toCard(post, await favoriteFlag(ctx, filter.userId, post._id)));
      }
      return { ...result, page };
    }

    if (needle) {
      const result = await ctx.db
        .query("posts")
        .withSearchIndex("search_posts", (q) => {
          const searched = q.search("searchText", needle);
          return filter.showSensitive ? searched : searched.eq("rating", "safe");
        })
        .paginate(args.paginationOpts);
      const page = [];
      for (const post of result.page) {
        if (!matches(post, filter.showSensitive, include, exclude, needle)) continue;
        page.push(toCard(post, await favoriteFlag(ctx, filter.userId, post._id)));
      }
      return { ...result, page };
    }

    const recent = filter.showSensitive
      ? ctx.db.query("posts").withIndex("by_createdAt")
      : ctx.db.query("posts").withIndex("by_rating_createdAt", (q) => q.eq("rating", "safe"));
    const result = await recent.order(order).paginate(args.paginationOpts);
    const page = [];
    for (const post of result.page) {
      if (!matches(post, filter.showSensitive, include, exclude, "")) continue;
      page.push(toCard(post, await favoriteFlag(ctx, filter.userId, post._id)));
    }
    return { ...result, page };
  },
});

export const get = query({
  args: { id: v.id("posts") },
  returns: v.union(postDetail, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) return null;
    const filter = await viewerFilter(ctx);
    if (!matches(post, filter.showSensitive, [], [], "")) return null;
    return {
      ...toCard(post, await favoriteFlag(ctx, filter.userId, post._id)),
      originalName: post.originalName,
      mine: filter.userId !== null && filter.userId === post.authorId,
    };
  },
});

export const tags = query({
  args: {},
  returns: v.array(tagCount),
  handler: async (ctx) => {
    const rows = await ctx.db.query("tagStats").withIndex("by_count").order("desc").take(24);
    return rows.map((row) => ({ tag: row.tag, count: row.count }));
  },
});

export const suggest = query({
  args: { q: v.string() },
  returns: v.array(tagCount),
  handler: async (ctx, args) => {
    const needle = normalizeTag(args.q.replace(/^-/, ""));
    if (!needle) return [];
    const upper = needle.slice(0, -1) + String.fromCharCode(needle.charCodeAt(needle.length - 1) + 1);
    const prefixed = await ctx.db
      .query("tagStats")
      .withIndex("by_tag", (q) => q.gte("tag", needle).lt("tag", upper))
      .take(8);
    const seen = new Set(prefixed.map((row) => row.tag));
    const extra =
      prefixed.length >= 8
        ? []
        : (
            await ctx.db.query("tagStats").withIndex("by_count").order("desc").take(80)
          ).filter((row) => row.tag.includes(needle) && !seen.has(row.tag));
    return [...prefixed, ...extra].slice(0, 8).map((row) => ({ tag: row.tag, count: row.count }));
  },
});

export const toggleFavorite = mutation({
  args: { postId: v.id("posts") },
  returns: v.boolean(),
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
    await ctx.db.insert("favorites", { userId, postId: args.postId, createdAt: post.createdAt });
    return true;
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) return null;
    if (post.authorId !== userId) throw new ConvexError("You can only remove your own pictures.");
    const keys = [post.storageKey, post.thumbKey].filter((key): key is string => Boolean(key));
    await deletePostGraph(ctx, args.postId);
    await ctx.scheduler.runAfter(0, internal.storage.deleteStored, { keys });
    return null;
  },
});

export const insertUploaded = internalMutation({
  args: {
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
    tags: v.array(v.string()),
    authorId: v.string(),
  },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    if (args.thumbKey !== undefined && args.thumbKey !== thumbKeyFor(args.storageKey)) {
      throw new ConvexError("That upload is not a picture we signed.");
    }
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_storageKey", (q) => q.eq("storageKey", args.storageKey))
      .unique();
    if (existing) return existing._id;
    const tags = normalizeTags(args.tags);
    const source = clipSource(args.source);
    const createdAt = Date.now();
    const fields = {
      storageKey: args.storageKey,
      ...(args.thumbKey ? { thumbKey: args.thumbKey } : {}),
      contentType: args.contentType,
      byteSize: args.byteSize,
      width: args.width,
      height: args.height,
      originalName: clipText(args.originalName, 180),
      artist: clipText(args.artist, 80),
      source,
      caption: clipText(args.caption, 500),
      rating: args.rating,
      createdAt,
      authorId: args.authorId,
      tags,
    };
    const id = await ctx.db.insert("posts", { ...fields, searchText: searchTextFor(fields) });
    await writeTags(ctx, id, tags, createdAt);
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
