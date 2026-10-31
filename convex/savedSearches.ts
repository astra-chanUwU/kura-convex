import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./authz";
import { clip, normalizeTags, savedRating, savedSort } from "./validators";

const savedSearch = v.object({
  _id: v.id("savedSearches"),
  name: v.string(),
  tags: v.array(v.string()),
  exclude: v.array(v.string()),
  q: v.string(),
  sort: savedSort,
  rating: savedRating,
  createdAt: v.number(),
});

export const list = query({
  args: {},
  returns: v.array(savedSearch),
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("savedSearches")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(24);
    return rows.map((row) => ({
      _id: row._id,
      name: row.name,
      tags: row.tags,
      exclude: row.exclude,
      q: row.q,
      sort: row.sort,
      rating: row.rating,
      createdAt: row.createdAt,
    }));
  },
});

export const save = mutation({
  args: {
    name: v.string(),
    tags: v.array(v.string()),
    exclude: v.array(v.string()),
    q: v.string(),
    sort: savedSort,
    rating: savedRating,
  },
  returns: v.id("savedSearches"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = clip(args.name, 40);
    if (!name) throw new ConvexError("Name the search.");
    const saved = await ctx.db
      .query("savedSearches")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(24);
    if (saved.length >= 24) throw new ConvexError("Remove a saved search first.");
    return ctx.db.insert("savedSearches", {
      userId,
      name,
      tags: normalizeTags(args.tags, 12),
      exclude: normalizeTags(args.exclude, 12),
      q: clip(args.q, 80),
      sort: args.sort,
      rating: args.rating,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("savedSearches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new ConvexError("That saved search is not yours.");
    await ctx.db.delete(args.id);
    return null;
  },
});
