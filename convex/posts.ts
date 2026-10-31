import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { canCurate, canModerate } from "../shared/roles";
import { thumbKeyFor } from "../shared/storage";
import { withArtistTag } from "../shared/tags";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { optionalUserId, requireModerator, requireUserId, roleFor } from "./authz";
import {
  applyPostSnapshot,
  emptySnapshot,
  recordPostChange,
  sameSnapshot,
  snapshotOf,
  type PostSnapshot,
} from "./history";
import { clipSource, clipText, markArtistCategory, resolveTags, searchTextFor, writeTags } from "./records";
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
    canModerate: userId ? canModerate(prefs?.role) : false,
    canCurate: userId ? canCurate(prefs?.role) : false,
  };
}

type Rating = Doc<"posts">["rating"];
type ListSort = "newest" | "oldest" | "saved" | undefined;

function matches(
  post: Doc<"posts">,
  showSensitive: boolean,
  include: string[],
  exclude: string[],
  needle: string,
  onlyRating?: Rating,
  authorId?: string,
) {
  if (post.removedAt) return false;
  if (!showSensitive && post.rating !== "safe") return false;
  if (onlyRating && post.rating !== onlyRating) return false;
  if (authorId && post.authorId !== authorId) return false;
  if (include.some((tag) => !post.tags.includes(tag))) return false;
  if (exclude.some((tag) => post.tags.includes(tag))) return false;
  if (!needle) return true;
  return (post.searchText ?? searchTextFor(post)).includes(needle);
}

function effectiveRating(showSensitive: boolean, requested: Rating | undefined) {
  if (!showSensitive) return "safe" as const;
  return requested;
}

async function rarestTag(ctx: QueryCtx, tags: string[]) {
  let best = tags[0]!;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const tag of tags) {
    const stat = await ctx.db
      .query("tagStats")
      .withIndex("by_tag", (q) => q.eq("tag", tag))
      .unique();
    const count = stat?.count ?? 0;
    if (count < bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  return best;
}

function counted(row: { tag: string; count: number; category?: Doc<"tagStats">["category"] }) {
  return { tag: row.tag, count: row.count, category: row.category ?? ("general" as const) };
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
    favoriteCount: post.favoriteCount ?? 0,
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
    sort: v.optional(v.union(v.literal("newest"), v.literal("oldest"), v.literal("saved"))),
    saved: v.optional(v.boolean()),
    rating: v.optional(rating),
    authorId: v.optional(v.string()),
  },
  returns: paginationResultValidator(postCard),
  handler: async (ctx, args) => {
    const filter = await viewerFilter(ctx);
    const include = await resolveTags(ctx, normalizeTags(args.tags ?? [], 12));
    const exclude = await resolveTags(ctx, normalizeTags(args.exclude ?? [], 12));
    const needle = (args.q ?? "").trim().toLowerCase();
    const onFavorites = args.saved === true;
    const oldest = args.sort === "oldest";
    const order = oldest ? "asc" : "desc";
    const wanted = effectiveRating(filter.showSensitive, args.rating);
    const authorId = onFavorites ? undefined : args.authorId;
    const accept = (post: Doc<"posts">) =>
      matches(post, filter.showSensitive, include, exclude, needle, wanted, authorId);

    async function cards(posts: Array<Doc<"posts"> | null>, knownFavorite?: boolean) {
      const page = [];
      for (const post of posts) {
        if (!post || !accept(post)) continue;
        page.push(toCard(post, knownFavorite ?? (await favoriteFlag(ctx, filter.userId, post._id))));
      }
      return page;
    }

    if (onFavorites) {
      const userId = filter.userId ?? "";
      const result = await ctx.db
        .query("favorites")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
        .order(order)
        .paginate(args.paginationOpts);
      const posts = [];
      for (const fav of result.page) posts.push(await ctx.db.get(fav.postId));
      return { ...result, page: await cards(posts, true) };
    }

    if (include.length > 0) {
      const tag = await rarestTag(ctx, include);
      const result = await ctx.db
        .query("postTags")
        .withIndex("by_tag_createdAt", (q) => q.eq("tag", tag))
        .order(order)
        .paginate(args.paginationOpts);
      const posts = [];
      for (const link of result.page) posts.push(await ctx.db.get(link.postId));
      return { ...result, page: await cards(posts) };
    }

    if (needle) {
      const result = await ctx.db
        .query("posts")
        .withSearchIndex("search_posts", (q) => {
          const searched = q.search("searchText", needle);
          return wanted ? searched.eq("rating", wanted) : searched;
        })
        .paginate(args.paginationOpts);
      return { ...result, page: await cards(result.page) };
    }

    if (authorId) {
      const result = await ctx.db
        .query("posts")
        .withIndex("by_author_createdAt", (q) => q.eq("authorId", authorId))
        .order(order)
        .paginate(args.paginationOpts);
      return { ...result, page: await cards(result.page) };
    }

    if (args.sort === "saved") {
      const result = await ctx.db
        .query("posts")
        .withIndex("by_favoriteCount_createdAt")
        .order("desc")
        .paginate(args.paginationOpts);
      return { ...result, page: await cards(result.page) };
    }

    const recent = wanted
      ? ctx.db.query("posts").withIndex("by_rating_createdAt", (q) => q.eq("rating", wanted))
      : ctx.db.query("posts").withIndex("by_createdAt");
    const result = await recent.order(order).paginate(args.paginationOpts);
    return { ...result, page: await cards(result.page) };
  },
});

const NEIGHBOR_BATCH = 32;
const NEIGHBOR_LIMIT = 5;

type TimeDir = "newer" | "older";
type Side = "prev" | "next";
type NeighborAnchor =
  | { kind: "favorites"; userId: string; createdAt: number }
  | { kind: "tag"; tag: string; createdAt: number }
  | { kind: "author"; authorId: string; createdAt: number }
  | { kind: "saves"; count: number; createdAt: number }
  | { kind: "rating"; rating: Rating; createdAt: number }
  | { kind: "created"; createdAt: number };

function timeDir(sort: ListSort, side: Side): TimeDir {
  const oldest = sort === "oldest";
  if (side === "prev") return oldest ? "older" : "newer";
  return oldest ? "newer" : "older";
}

const NEIGHBOR_SCAN = NEIGHBOR_BATCH * NEIGHBOR_LIMIT;

function firstMatch(rows: Doc<"posts">[], pick: (post: Doc<"posts">) => Id<"posts"> | null) {
  for (const post of rows) {
    const id = pick(post);
    if (id) return id;
  }
  return null;
}

async function postsFrom<T extends { postId?: Id<"posts"> }>(
  ctx: QueryCtx,
  rows: T[],
  pick: (post: Doc<"posts">) => Id<"posts"> | null,
  idOf: (row: T) => Id<"posts">,
) {
  const posts: Doc<"posts">[] = [];
  for (const row of rows) {
    const post = await ctx.db.get(idOf(row));
    if (post) posts.push(post);
  }
  return firstMatch(posts, pick);
}

async function walkTime(
  ctx: QueryCtx,
  anchor: Exclude<NeighborAnchor, { kind: "saves" }>,
  direction: TimeDir,
  pick: (post: Doc<"posts">) => Id<"posts"> | null,
) {
  const order = direction === "newer" ? "asc" : "desc";
  const createdAt = anchor.createdAt;
  if (anchor.kind === "tag") {
    const tag = anchor.tag;
    const links = await ctx.db
      .query("postTags")
      .withIndex("by_tag_createdAt", (q) =>
        direction === "newer" ? q.eq("tag", tag).gt("createdAt", createdAt) : q.eq("tag", tag).lt("createdAt", createdAt),
      )
      .order(order)
      .take(NEIGHBOR_SCAN);
    return postsFrom(ctx, links, pick, (link) => link.postId);
  }
  if (anchor.kind === "favorites") {
    const userId = anchor.userId;
    const favs = await ctx.db
      .query("favorites")
      .withIndex("by_user_createdAt", (q) =>
        direction === "newer"
          ? q.eq("userId", userId).gt("createdAt", createdAt)
          : q.eq("userId", userId).lt("createdAt", createdAt),
      )
      .order(order)
      .take(NEIGHBOR_SCAN);
    return postsFrom(ctx, favs, pick, (fav) => fav.postId);
  }
  if (anchor.kind === "author") {
    const authorId = anchor.authorId;
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_author_createdAt", (q) =>
        direction === "newer"
          ? q.eq("authorId", authorId).gt("createdAt", createdAt)
          : q.eq("authorId", authorId).lt("createdAt", createdAt),
      )
      .order(order)
      .take(NEIGHBOR_SCAN);
    return firstMatch(rows, pick);
  }
  if (anchor.kind === "rating") {
    const onlyRating = anchor.rating;
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_rating_createdAt", (q) =>
        direction === "newer"
          ? q.eq("rating", onlyRating).gt("createdAt", createdAt)
          : q.eq("rating", onlyRating).lt("createdAt", createdAt),
      )
      .order(order)
      .take(NEIGHBOR_SCAN);
    return firstMatch(rows, pick);
  }
  const rows = await ctx.db
    .query("posts")
    .withIndex("by_createdAt", (q) => (direction === "newer" ? q.gt("createdAt", createdAt) : q.lt("createdAt", createdAt)))
    .order(order)
    .take(NEIGHBOR_SCAN);
  return firstMatch(rows, pick);
}

async function walkSaves(
  ctx: QueryCtx,
  count: number,
  createdAt: number,
  side: Side,
  pick: (post: Doc<"posts">) => Id<"posts"> | null,
) {
  if (side === "prev") {
    const same = await ctx.db
      .query("posts")
      .withIndex("by_favoriteCount_createdAt", (q) => q.eq("favoriteCount", count).gt("createdAt", createdAt))
      .order("asc")
      .take(NEIGHBOR_SCAN);
    const hit = firstMatch(same, pick);
    if (hit) return hit;
    const higher = await ctx.db
      .query("posts")
      .withIndex("by_favoriteCount_createdAt", (q) => q.gt("favoriteCount", count))
      .order("asc")
      .take(NEIGHBOR_SCAN);
    return firstMatch(higher, pick);
  }
  const same = await ctx.db
    .query("posts")
    .withIndex("by_favoriteCount_createdAt", (q) => q.eq("favoriteCount", count).lt("createdAt", createdAt))
    .order("desc")
    .take(NEIGHBOR_SCAN);
  const hit = firstMatch(same, pick);
  if (hit) return hit;
  const lower = await ctx.db
    .query("posts")
    .withIndex("by_favoriteCount_createdAt", (q) => q.lt("favoriteCount", count))
    .order("desc")
    .take(NEIGHBOR_SCAN);
  return firstMatch(lower, pick);
}

export const neighbors = query({
  args: {
    id: v.id("posts"),
    q: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    exclude: v.optional(v.array(v.string())),
    sort: v.optional(v.union(v.literal("newest"), v.literal("oldest"), v.literal("saved"))),
    saved: v.optional(v.boolean()),
    rating: v.optional(rating),
    authorId: v.optional(v.string()),
  },
  returns: v.object({
    prev: v.union(v.id("posts"), v.null()),
    next: v.union(v.id("posts"), v.null()),
  }),
  handler: async (ctx, args) => {
    const none = { prev: null, next: null };
    const filter = await viewerFilter(ctx);
    const include = await resolveTags(ctx, normalizeTags(args.tags ?? [], 12));
    const exclude = await resolveTags(ctx, normalizeTags(args.exclude ?? [], 12));
    const needle = (args.q ?? "").trim().toLowerCase();
    const onFavorites = args.saved === true;
    const wanted = effectiveRating(filter.showSensitive, args.rating);
    const authorId = onFavorites ? undefined : args.authorId;
    const post = await ctx.db.get(args.id);
    if (!post || !matches(post, filter.showSensitive, include, exclude, needle, wanted, authorId)) return none;
    const pick = (row: Doc<"posts">) => {
      if (row._id === post._id) return null;
      if (!matches(row, filter.showSensitive, include, exclude, needle, wanted, authorId)) return null;
      return row._id;
    };
    let anchor: NeighborAnchor;
    if (onFavorites) {
      const userId = filter.userId ?? "";
      const fav = await ctx.db
        .query("favorites")
        .withIndex("by_user_post", (q) => q.eq("userId", userId).eq("postId", post._id))
        .unique();
      if (!fav) return none;
      anchor = { kind: "favorites", userId, createdAt: fav.createdAt ?? post.createdAt };
    } else if (include.length > 0) {
      anchor = { kind: "tag", tag: await rarestTag(ctx, include), createdAt: post.createdAt };
    } else if (needle) {
      anchor = authorId
        ? { kind: "author", authorId, createdAt: post.createdAt }
        : wanted
          ? { kind: "rating", rating: wanted, createdAt: post.createdAt }
          : { kind: "created", createdAt: post.createdAt };
    } else if (authorId) {
      anchor = { kind: "author", authorId, createdAt: post.createdAt };
    } else if (args.sort === "saved") {
      anchor = { kind: "saves", count: post.favoriteCount ?? 0, createdAt: post.createdAt };
    } else if (wanted) {
      anchor = { kind: "rating", rating: wanted, createdAt: post.createdAt };
    } else {
      anchor = { kind: "created", createdAt: post.createdAt };
    }
    const step = (side: Side) =>
      anchor.kind === "saves"
        ? walkSaves(ctx, anchor.count, anchor.createdAt, side, pick)
        : walkTime(ctx, anchor, timeDir(args.sort, side), pick);
    return { prev: await step("prev"), next: await step("next") };
  },
});

export const get = query({
  args: { id: v.id("posts") },
  returns: v.union(postDetail, v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) return null;
    const filter = await viewerFilter(ctx);
    const removed = post.removedAt !== undefined;
    if (removed && !filter.canModerate) return null;
    if (!removed && !matches(post, filter.showSensitive, [], [], "")) return null;
    if (removed && !filter.showSensitive && post.rating !== "safe") return null;
    const author = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", post.authorId))
      .unique();
    const mine = filter.userId !== null && filter.userId === post.authorId;
    return {
      ...toCard(post, await favoriteFlag(ctx, filter.userId, post._id)),
      originalName: post.originalName,
      mine,
      canRemove: (mine || filter.canModerate) && !removed,
      canEdit: mine || filter.canCurate,
      removed,
      authorName: author?.displayName ?? null,
      authorId: post.authorId,
      sourceBoard: post.sourceBoard ?? null,
      sourceId: post.sourceId ?? null,
    };
  },
});

const relationCard = v.object({
  _id: v.id("posts"),
  caption: v.string(),
});

export const relations = query({
  args: { id: v.id("posts") },
  returns: v.object({
    parent: v.union(relationCard, v.null()),
    children: v.array(relationCard),
  }),
  handler: async (ctx, args) => {
    const filter = await viewerFilter(ctx);
    const post = await ctx.db.get(args.id);
    const visible = (row: Doc<"posts"> | null): row is Doc<"posts"> => {
      if (!row) return false;
      if (row.removedAt !== undefined && !filter.canModerate) return false;
      if (!filter.showSensitive && row.rating !== "safe") return false;
      return true;
    };
    let parent: { _id: Id<"posts">; caption: string } | null = null;
    if (post?.parentId) {
      const row = await ctx.db.get(post.parentId);
      if (visible(row)) parent = { _id: row._id, caption: row.caption };
    }
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_parent", (q) => q.eq("parentId", args.id))
      .order("desc")
      .take(80);
    const children = rows
      .filter(visible)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 24)
      .map((row) => ({ _id: row._id, caption: row.caption }));
    return { parent, children };
  },
});

export const tags = query({
  args: {},
  returns: v.array(tagCount),
  handler: async (ctx) => {
    const rows = await ctx.db.query("tagStats").withIndex("by_count").order("desc").take(24);
    return rows.map(counted);
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
    const hits = [...prefixed, ...extra].map(counted);
    const alias = await ctx.db
      .query("tagAliases")
      .withIndex("by_alias", (q) => q.eq("alias", needle))
      .unique();
    const canonical = alias?.canonical;
    if (canonical) {
      const index = hits.findIndex((row) => row.tag === canonical);
      if (index < 0) {
        const row = await ctx.db
          .query("tagStats")
          .withIndex("by_tag", (q) => q.eq("tag", canonical))
          .unique();
        hits.unshift(row ? counted(row) : { tag: canonical, count: 0, category: "general" });
      } else if (index >= 8) {
        const row = hits[index];
        if (row) {
          hits.splice(index, 1);
          hits.unshift(row);
        }
      }
    }
    return hits.slice(0, 8);
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
    const count = post.favoriteCount ?? 0;
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(post._id, { favoriteCount: Math.max(0, count - 1) });
      return false;
    }
    await ctx.db.insert("favorites", { userId, postId: args.postId, createdAt: post.createdAt });
    await ctx.db.patch(post._id, { favoriteCount: count + 1 });
    return true;
  },
});

export const update = mutation({
  args: {
    postId: v.id("posts"),
    artist: v.string(),
    caption: v.string(),
    source: v.string(),
    rating,
    tags: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new ConvexError("That picture is gone.");
    if (post.authorId !== userId && !canCurate(await roleFor(ctx, userId))) {
      throw new ConvexError("You can only edit your own pictures.");
    }
    const before = snapshotOf(post);
    const artist = clipText(args.artist, 80);
    const draft: PostSnapshot = {
      artist,
      caption: clipText(args.caption, 500),
      source: clipSource(args.source),
      tags: await resolveTags(ctx, withArtistTag(normalizeTags(args.tags, 40), artist)),
      rating: args.rating,
      removed: before.removed,
    };
    if (sameSnapshot(before, draft)) return false;
    const after = await applyPostSnapshot(ctx, post, draft);
    if (sameSnapshot(before, after)) return false;
    await recordPostChange(ctx, {
      postId: post._id,
      actorId: userId,
      action: "post.updated",
      before,
      after,
    });
    return true;
  },
});

export const remove = mutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post || post.removedAt) return null;
    if (post.authorId !== userId) await requireModerator(ctx, userId);
    const before = snapshotOf(post);
    await ctx.db.patch(args.postId, { removedAt: Date.now() });
    await recordPostChange(ctx, {
      postId: post._id,
      actorId: userId,
      action: "post.removed",
      before,
      after: { ...before, removed: true },
    });
    return null;
  },
});

async function postByStorageKey(ctx: QueryCtx | MutationCtx, storageKey: string) {
  return ctx.db
    .query("posts")
    .withIndex("by_storageKey", (q) => q.eq("storageKey", storageKey))
    .unique();
}

async function storeUpload(
  ctx: MutationCtx,
  args: {
    storageKey: string;
    thumbKey?: string;
    contentType: string;
    byteSize: number;
    width: number;
    height: number;
    originalName: string;
    artist: string;
    source: string;
    caption: string;
    rating: Rating;
    tags: string[];
    authorId: string;
    sha256: string;
    parentId?: Id<"posts">;
  },
  withHash: boolean,
) {
  const artist = clipText(args.artist, 80);
  const tags = await resolveTags(ctx, withArtistTag(normalizeTags(args.tags, 40), artist));
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
    artist,
    source,
    caption: clipText(args.caption, 500),
    rating: args.rating,
    createdAt,
    authorId: args.authorId,
    ...(withHash ? { sha256: args.sha256 } : {}),
    ...(args.parentId && !withHash ? { parentId: args.parentId } : {}),
    favoriteCount: 0,
    tags,
  };
  const id = await ctx.db.insert("posts", { ...fields, searchText: searchTextFor(fields) });
  await writeTags(ctx, id, tags, createdAt);
  await markArtistCategory(ctx, artist, tags);
  await recordPostChange(ctx, {
    postId: id,
    actorId: args.authorId,
    action: "post.created",
    before: emptySnapshot(),
    after: snapshotOf({ ...fields, tags }),
  });
  return id;
}

export const storageKeyOwner = internalQuery({
  args: { storageKey: v.string() },
  returns: v.union(v.id("posts"), v.null()),
  handler: async (ctx, args) => {
    const post = await postByStorageKey(ctx, args.storageKey);
    return post?._id ?? null;
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
    sha256: v.string(),
    parentId: v.optional(v.id("posts")),
  },
  returns: v.object({
    id: v.id("posts"),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{64}$/.test(args.sha256)) throw new ConvexError("That file hash is not a SHA-256.");
    if (args.thumbKey !== undefined && args.thumbKey !== thumbKeyFor(args.storageKey)) {
      throw new ConvexError("That upload is not a picture we signed.");
    }
    const hashed = await ctx.db
      .query("posts")
      .withIndex("by_sha256", (q) => q.eq("sha256", args.sha256))
      .unique();
    if (hashed && args.parentId === undefined) {
      return { id: hashed._id, duplicate: true as const };
    }
    if (hashed && args.parentId !== undefined) {
      if (args.parentId !== hashed._id) throw new ConvexError("That parent does not match this file.");
      if (hashed.removedAt) throw new ConvexError("That picture is gone.");
      const owner = await postByStorageKey(ctx, args.storageKey);
      if (owner) return { id: owner._id, duplicate: false as const };
      const id = await storeUpload(ctx, args, false);
      return { id, duplicate: false as const };
    }
    if (args.parentId !== undefined) throw new ConvexError("That parent does not match this file.");
    const existing = await postByStorageKey(ctx, args.storageKey);
    if (existing) return { id: existing._id, duplicate: false as const };
    const id = await storeUpload(ctx, args, true);
    return { id, duplicate: false as const };
  },
});
