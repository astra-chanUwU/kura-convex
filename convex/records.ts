import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export function searchTextFor(post: {
  caption: string;
  artist: string;
  source: string;
  originalName: string;
  tags: string[];
}) {
  return `${post.caption} ${post.artist} ${post.source} ${post.originalName} ${post.tags.join(" ")}`.toLowerCase();
}

export function clipText(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function clipSource(value: string) {
  const source = clipText(value, 300);
  if (source && !/^https?:\/\//i.test(source)) {
    throw new ConvexError("Source needs to start with http:// or https://.");
  }
  return source;
}

async function bumpTag(ctx: MutationCtx, tag: string, delta: number) {
  const stat = await ctx.db
    .query("tagStats")
    .withIndex("by_tag", (q) => q.eq("tag", tag))
    .unique();
  if (delta > 0) {
    if (stat) await ctx.db.patch(stat._id, { count: stat.count + 1 });
    else await ctx.db.insert("tagStats", { tag, count: 1 });
    return;
  }
  if (!stat) return;
  if (stat.count <= 1) await ctx.db.delete(stat._id);
  else await ctx.db.patch(stat._id, { count: stat.count - 1 });
}

// Rewrites the tag index to match the post. Tags that stay keep their row.
export async function replaceTags(ctx: MutationCtx, postId: Id<"posts">, tags: string[], createdAt: number) {
  const links = await ctx.db
    .query("postTags")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .take(80);
  const next = new Set(tags);
  const previous = new Set(links.map((link) => link.tag));
  for (const link of links) {
    if (next.has(link.tag)) continue;
    await ctx.db.delete(link._id);
    await bumpTag(ctx, link.tag, -1);
  }
  for (const tag of tags) {
    if (previous.has(tag)) continue;
    await ctx.db.insert("postTags", { postId, tag, createdAt });
    await bumpTag(ctx, tag, 1);
  }
}

export async function writeTags(
  ctx: MutationCtx,
  postId: Id<"posts">,
  tags: string[],
  createdAt: number,
) {
  for (const tag of tags) {
    await ctx.db.insert("postTags", { postId, tag, createdAt });
    const stat = await ctx.db
      .query("tagStats")
      .withIndex("by_tag", (q) => q.eq("tag", tag))
      .unique();
    if (stat) await ctx.db.patch(stat._id, { count: stat.count + 1 });
    else await ctx.db.insert("tagStats", { tag, count: 1 });
  }
}

// Hard delete. Board removal is soft (removedAt) so a rollback can restore the picture.
export async function deletePostGraph(ctx: MutationCtx, postId: Id<"posts">) {
  const tags = await ctx.db
    .query("postTags")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .take(80);
  for (const tag of tags) {
    await ctx.db.delete(tag._id);
    const stat = await ctx.db
      .query("tagStats")
      .withIndex("by_tag", (q) => q.eq("tag", tag.tag))
      .unique();
    if (!stat) continue;
    if (stat.count <= 1) await ctx.db.delete(stat._id);
    else await ctx.db.patch(stat._id, { count: stat.count - 1 });
  }
  const favs = await ctx.db
    .query("favorites")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .take(100);
  for (const fav of favs) await ctx.db.delete(fav._id);
  await ctx.db.delete(postId);
}
