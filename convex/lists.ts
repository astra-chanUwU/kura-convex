import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./authz";
import { listSummary, postCard } from "./validators";

const LIST_ITEM_LIMIT = 2000;

type DbCtx = QueryCtx | MutationCtx;

function codePoints(value: string) {
  return [...value].length;
}

function listTitle(value: string) {
  const title = value.trim();
  const length = codePoints(title);
  if (length < 1 || length > 80) throw new ConvexError("Give the list a title (up to 80 characters).");
  return title;
}

function listDescription(value: string) {
  const description = value.trim();
  if (codePoints(description) > 300) throw new ConvexError("List descriptions are capped at 300 characters.");
  return description;
}

function storedVisibility(value: string) {
  return value === "public" ? ("public" as const) : ("private" as const);
}

function viewerOwns(list: { userId: string }, viewerId: string | null) {
  return viewerId !== null && viewerId === list.userId;
}

function canViewList(list: Doc<"lists">, viewerId: string | null) {
  return list.visibility !== "private" || viewerOwns(list, viewerId);
}

async function ownerLabel(ctx: DbCtx, userId: string) {
  const row = await ctx.db
    .query("preferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!row) return "Account";
  return row.displayName;
}

function summarize(list: Doc<"lists">, ownerName: string, mine: boolean) {
  return {
    _id: list._id,
    title: list.title,
    description: list.description,
    visibility: list.visibility,
    itemCount: list.itemCount,
    updatedAt: list.updatedAt,
    ownerId: list.userId,
    ownerName,
    mine,
  };
}

async function summaries(ctx: DbCtx, rows: Doc<"lists">[], viewerId: string | null) {
  const names = new Map<string, string>();
  const page = [];
  for (const row of rows) {
    let name = names.get(row.userId);
    if (name === undefined) {
      name = await ownerLabel(ctx, row.userId);
      names.set(row.userId, name);
    }
    page.push(summarize(row, name, viewerOwns(row, viewerId)));
  }
  return page;
}

async function requireOwned(ctx: MutationCtx, listId: Id<"lists">, userId: string) {
  const list = await ctx.db.get(listId);
  if (!list) throw new ConvexError("That list could not be found.");
  if (list.userId !== userId) throw new ConvexError("That list is not yours.");
  return list;
}

function itemsInOrder(ctx: DbCtx, listId: Id<"lists">) {
  return ctx.db
    .query("listItems")
    .withIndex("by_list_position", (q) => q.eq("listId", listId))
    .order("asc")
    .take(LIST_ITEM_LIMIT);
}

async function writePositions(ctx: MutationCtx, items: Doc<"listItems">[]) {
  for (let position = 0; position < items.length; position++) {
    const item = items[position];
    if (!item || item.position === position) continue;
    await ctx.db.patch(item._id, { position });
  }
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

async function viewerShowsSensitive(ctx: QueryCtx, userId: string | null) {
  if (!userId) return false;
  const prefs = await ctx.db
    .query("preferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return prefs?.showSensitive === true;
}

function visiblePost(post: Doc<"posts"> | null, showSensitive: boolean): post is Doc<"posts"> {
  if (!post) return false;
  if (post.removedAt !== undefined) return false;
  if (!showSensitive && post.rating !== "safe") return false;
  return true;
}

export const mine = query({
  args: {},
  returns: v.array(listSummary),
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("lists")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    return summaries(ctx, rows, userId);
  },
});

export const publicFor = query({
  args: { userId: v.string() },
  returns: v.array(listSummary),
  handler: async (ctx, args) => {
    const viewerId = await optionalUserId(ctx);
    const rows = await ctx.db
      .query("lists")
      .withIndex("by_user_visibility_updatedAt", (q) => q.eq("userId", args.userId).eq("visibility", "public"))
      .order("desc")
      .take(100);
    return summaries(ctx, rows, viewerId);
  },
});

export const get = query({
  args: { listId: v.id("lists") },
  returns: v.union(listSummary, v.null()),
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.listId);
    if (!list) return null;
    const viewerId = await optionalUserId(ctx);
    if (!canViewList(list, viewerId)) return null;
    return summarize(list, await ownerLabel(ctx, list.userId), viewerOwns(list, viewerId));
  },
});

export const items = query({
  args: {
    listId: v.id("lists"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(postCard),
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.listId);
    const viewerId = await optionalUserId(ctx);
    if (!list || !canViewList(list, viewerId)) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const showSensitive = await viewerShowsSensitive(ctx, viewerId);
    const result = await ctx.db
      .query("listItems")
      .withIndex("by_list_position", (q) => q.eq("listId", args.listId))
      .order("asc")
      .paginate(args.paginationOpts);
    const page = [];
    for (const row of result.page) {
      const post = await ctx.db.get(row.postId);
      if (!visiblePost(post, showSensitive)) continue;
      page.push(toCard(post, await favoriteFlag(ctx, viewerId, post._id)));
    }
    return { ...result, page };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    visibility: v.string(),
  },
  returns: listSummary,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const title = listTitle(args.title);
    const description = listDescription(args.description);
    const visibility = storedVisibility(args.visibility);
    const now = Date.now();
    const _id = await ctx.db.insert("lists", {
      userId,
      title,
      description,
      visibility,
      createdAt: now,
      updatedAt: now,
      itemCount: 0,
    });
    return {
      _id,
      title,
      description,
      visibility,
      itemCount: 0,
      updatedAt: now,
      ownerId: userId,
      ownerName: await ownerLabel(ctx, userId),
      mine: true,
    };
  },
});

export const update = mutation({
  args: {
    listId: v.id("lists"),
    title: v.string(),
    description: v.string(),
    visibility: v.string(),
  },
  returns: listSummary,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await requireOwned(ctx, args.listId, userId);
    const title = listTitle(args.title);
    const description = listDescription(args.description);
    const visibility = storedVisibility(args.visibility);
    const updatedAt = Date.now();
    await ctx.db.patch(list._id, { title, description, visibility, updatedAt });
    return summarize({ ...list, title, description, visibility, updatedAt }, await ownerLabel(ctx, list.userId), true);
  },
});

export const remove = mutation({
  args: { listId: v.id("lists") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await requireOwned(ctx, args.listId, userId);
    const rows = await itemsInOrder(ctx, list._id);
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.delete(list._id);
    return null;
  },
});

export const add = mutation({
  args: { listId: v.id("lists"), postId: v.id("posts") },
  returns: v.object({ added: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await requireOwned(ctx, args.listId, userId);
    const post = await ctx.db.get(args.postId);
    if (!post || post.removedAt !== undefined) throw new ConvexError("That picture is not on the board.");
    const existing = await ctx.db
      .query("listItems")
      .withIndex("by_list_post", (q) => q.eq("listId", list._id).eq("postId", args.postId))
      .unique();
    if (existing) return { added: false };
    const tail = await ctx.db
      .query("listItems")
      .withIndex("by_list_position", (q) => q.eq("listId", list._id))
      .order("desc")
      .first();
    const now = Date.now();
    await ctx.db.insert("listItems", {
      listId: list._id,
      postId: args.postId,
      position: tail ? tail.position + 1 : 0,
      createdAt: now,
    });
    await ctx.db.patch(list._id, { itemCount: list.itemCount + 1, updatedAt: now });
    return { added: true };
  },
});

export const takeOff = mutation({
  args: { listId: v.id("lists"), postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await requireOwned(ctx, args.listId, userId);
    const item = await ctx.db
      .query("listItems")
      .withIndex("by_list_post", (q) => q.eq("listId", list._id).eq("postId", args.postId))
      .unique();
    if (!item) return null;
    await ctx.db.delete(item._id);
    await ctx.db.patch(list._id, {
      itemCount: Math.max(0, list.itemCount - 1),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const reorder = mutation({
  args: { listId: v.id("lists"), postIds: v.array(v.id("posts")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await requireOwned(ctx, args.listId, userId);
    const seen = new Set<Id<"posts">>();
    for (const postId of args.postIds) {
      if (seen.has(postId)) throw new ConvexError("Reorder has a duplicate item.");
      seen.add(postId);
    }
    const items = await itemsInOrder(ctx, list._id);
    const byPost = new Map(items.map((item) => [item.postId, item]));
    if (args.postIds.length !== items.length || byPost.size !== items.length || args.postIds.some((id) => !byPost.has(id))) {
      throw new ConvexError("Reorder must include every item in the list.");
    }
    const ordered = [];
    for (const postId of args.postIds) {
      const item = byPost.get(postId);
      if (!item) throw new ConvexError("Reorder must include every item in the list.");
      ordered.push(item);
    }
    await writePositions(ctx, ordered);
    return null;
  },
});

export const move = mutation({
  args: {
    listId: v.id("lists"),
    postId: v.id("posts"),
    afterId: v.union(v.id("posts"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const list = await requireOwned(ctx, args.listId, userId);
    const items = await itemsInOrder(ctx, list._id);
    const from = items.findIndex((item) => item.postId === args.postId);
    if (from < 0) throw new ConvexError("That post is not in this list.");
    if (args.postId === args.afterId) return null;
    const moving = items[from];
    if (!moving) throw new ConvexError("That post is not in this list.");
    const rest = items.filter((_, index) => index !== from);
    let index = 0;
    if (args.afterId !== null) {
      index = rest.findIndex((item) => item.postId === args.afterId);
      if (index < 0) throw new ConvexError("Move relative to a post in this list.");
      index += 1;
    }
    rest.splice(index, 0, moving);
    await writePositions(ctx, rest);
    return null;
  },
});
