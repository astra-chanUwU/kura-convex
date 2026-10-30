import { ConvexError, v } from "convex/values";
import { canModerate } from "../shared/roles";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireUserId, roleFor } from "./authz";
import { clipSource, clipText, replaceTags, searchTextFor } from "./records";
import { changeAction, normalizeTags, postSnapshot } from "./validators";

type Rating = "safe" | "questionable" | "explicit";

export type PostSnapshot = {
  artist: string;
  caption: string;
  source: string;
  tags: string[];
  rating: Rating;
  removed: boolean;
};

const changeEntry = v.object({
  _id: v.id("changes"),
  entityId: v.string(),
  actorId: v.string(),
  actorName: v.string(),
  action: changeAction,
  before: postSnapshot,
  after: postSnapshot,
  rollbackOf: v.union(v.id("changes"), v.null()),
  createdAt: v.number(),
  storageKey: v.union(v.string(), v.null()),
  thumbKey: v.union(v.string(), v.null()),
});

export function emptySnapshot(): PostSnapshot {
  return { artist: "", caption: "", source: "", tags: [], rating: "safe", removed: false };
}

export function snapshotOf(post: {
  artist: string;
  caption: string;
  source: string;
  tags: string[];
  rating: Rating;
  removedAt?: number;
}): PostSnapshot {
  return {
    artist: post.artist,
    caption: post.caption,
    source: post.source,
    tags: post.tags,
    rating: post.rating,
    removed: post.removedAt !== undefined,
  };
}

export function sameSnapshot(a: PostSnapshot, b: PostSnapshot) {
  if (a.artist !== b.artist || a.caption !== b.caption || a.source !== b.source) return false;
  if (a.rating !== b.rating || a.removed !== b.removed || a.tags.length !== b.tags.length) return false;
  return a.tags.every((tag, index) => tag === b.tags[index]);
}

export async function applyPostSnapshot(ctx: MutationCtx, post: Doc<"posts">, snapshot: PostSnapshot) {
  const artist = clipText(snapshot.artist, 80);
  const caption = clipText(snapshot.caption, 500);
  const source = clipSource(snapshot.source);
  const tags = normalizeTags(snapshot.tags, 40);
  const next: PostSnapshot = {
    artist,
    caption,
    source,
    tags,
    rating: snapshot.rating,
    removed: snapshot.removed,
  };
  await ctx.db.patch(post._id, {
    artist,
    caption,
    source,
    tags,
    rating: snapshot.rating,
    searchText: searchTextFor({ ...post, artist, caption, source, tags }),
    removedAt: snapshot.removed ? (post.removedAt ?? Date.now()) : undefined,
  });
  await replaceTags(ctx, post._id, tags, post.createdAt);
  return next;
}

export async function recordPostChange(
  ctx: MutationCtx,
  args: {
    postId: Id<"posts">;
    actorId: string;
    action: "post.created" | "post.updated" | "post.removed" | "rollback";
    before: PostSnapshot;
    after: PostSnapshot;
    rollbackOf?: Id<"changes">;
  },
) {
  const prefs = await ctx.db
    .query("preferences")
    .withIndex("by_user", (q) => q.eq("userId", args.actorId))
    .unique();
  await ctx.db.insert("changes", {
    entityType: "post",
    entityId: args.postId,
    actorId: args.actorId,
    actorName: (prefs?.displayName.trim() || "Someone").slice(0, 60),
    action: args.action,
    before: args.before,
    after: args.after,
    ...(args.rollbackOf ? { rollbackOf: args.rollbackOf } : {}),
    createdAt: Date.now(),
  });
}

async function viewer(ctx: QueryCtx) {
  const userId = await requireUserId(ctx);
  const prefs = await ctx.db
    .query("preferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return {
    userId,
    showSensitive: prefs?.showSensitive ?? false,
    staff: canModerate(await roleFor(ctx, userId)),
  };
}

function present(
  row: Doc<"changes">,
  post: Doc<"posts"> | null,
  showSensitive: boolean,
) {
  const sensitive =
    row.before.rating !== "safe" || row.after.rating !== "safe" || (post !== null && post.rating !== "safe");
  const visible = showSensitive || !sensitive;
  return {
    _id: row._id,
    entityId: row.entityId,
    actorId: row.actorId,
    actorName: row.actorName,
    action: row.action,
    before: row.before,
    after: row.after,
    rollbackOf: row.rollbackOf ?? null,
    createdAt: row.createdAt,
    storageKey: visible && post ? post.storageKey : null,
    thumbKey: visible && post?.thumbKey ? post.thumbKey : null,
  };
}

export const forPost = query({
  args: { postId: v.id("posts") },
  returns: v.array(changeEntry),
  handler: async (ctx, args) => {
    const view = await viewer(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) return [];
    if (post.removedAt && !view.staff) return [];
    if (!view.showSensitive && post.rating !== "safe") return [];
    const rows = await ctx.db
      .query("changes")
      .withIndex("by_entity_createdAt", (q) => q.eq("entityType", "post").eq("entityId", args.postId))
      .order("desc")
      .take(40);
    return rows.map((row) => present(row, post, view.showSensitive));
  },
});

export const recent = query({
  args: { actorId: v.optional(v.string()) },
  returns: v.array(changeEntry),
  handler: async (ctx, args) => {
    const view = await viewer(ctx);
    if (!view.staff) throw new ConvexError("History is for moderators and the owner.");
    const actorId = args.actorId;
    const rows = actorId
      ? await ctx.db
          .query("changes")
          .withIndex("by_actor_createdAt", (q) => q.eq("actorId", actorId))
          .order("desc")
          .take(80)
      : await ctx.db.query("changes").withIndex("by_createdAt").order("desc").take(80);
    const page = [];
    for (const row of rows) {
      const postId = ctx.db.normalizeId("posts", row.entityId);
      const post = postId ? await ctx.db.get(postId) : null;
      page.push(present(row, post, view.showSensitive));
    }
    return page;
  },
});

export const actors = query({
  args: {},
  returns: v.array(v.object({ id: v.string(), name: v.string() })),
  handler: async (ctx) => {
    const view = await viewer(ctx);
    if (!view.staff) return [];
    const rows = await ctx.db.query("changes").withIndex("by_createdAt").order("desc").take(200);
    const names = new Map<string, string>();
    for (const row of rows) {
      if (!names.has(row.actorId)) names.set(row.actorId, row.actorName);
    }
    return [...names.entries()].map(([id, name]) => ({ id, name }));
  },
});

export const rollback = mutation({
  args: { changeId: v.id("changes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!canModerate(await roleFor(ctx, userId))) {
      throw new ConvexError("Only a moderator can roll a change back.");
    }
    const entry = await ctx.db.get(args.changeId);
    if (!entry) throw new ConvexError("That change is gone.");
    if (entry.action === "post.created") {
      throw new ConvexError("An upload stays in the log. Remove the picture to take it off the board.");
    }
    const postId = ctx.db.normalizeId("posts", entry.entityId);
    const post = postId ? await ctx.db.get(postId) : null;
    if (!post) throw new ConvexError("That picture is gone.");
    const before = snapshotOf(post);
    if (sameSnapshot(before, entry.before)) {
      throw new ConvexError("That picture already matches this version.");
    }
    const after = await applyPostSnapshot(ctx, post, entry.before);
    await recordPostChange(ctx, {
      postId: post._id,
      actorId: userId,
      action: "rollback",
      before,
      after,
      rollbackOf: entry._id,
    });
    return null;
  },
});
