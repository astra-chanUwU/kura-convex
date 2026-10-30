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
