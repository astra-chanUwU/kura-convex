import { ConvexError, v } from "convex/values";
import type { TagCategory } from "../shared/tags";
import { mutation, query } from "./_generated/server";
import { requireCurator } from "./authz";
import { normalizeTag, tagCategory } from "./validators";

function categoryOf(category: TagCategory | undefined) {
  return category ?? "general";
}

export const lookup = query({
  args: { tags: v.array(v.string()) },
  returns: v.array(v.object({ tag: v.string(), category: tagCategory })),
  handler: async (ctx, args) => {
    const tags: string[] = [];
    for (const raw of args.tags) {
      const tag = normalizeTag(raw);
      if (!tag) continue;
      tags.push(tag);
      if (tags.length >= 40) break;
    }
    const rows = [];
    for (const tag of tags) {
      const stat = await ctx.db
        .query("tagStats")
        .withIndex("by_tag", (q) => q.eq("tag", tag))
        .unique();
      rows.push({ tag, category: categoryOf(stat?.category) });
    }
    return rows;
  },
});

export const setCategory = mutation({
  args: { tag: v.string(), category: tagCategory },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCurator(ctx);
    const tag = normalizeTag(args.tag);
    const stat = tag
      ? await ctx.db
          .query("tagStats")
          .withIndex("by_tag", (q) => q.eq("tag", tag))
          .unique()
      : null;
    if (!stat) throw new ConvexError("That tag is not on the board yet.");
    await ctx.db.patch(stat._id, { category: args.category });
    return null;
  },
});

export const setAlias = mutation({
  args: { alias: v.string(), canonical: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCurator(ctx);
    const alias = normalizeTag(args.alias);
    const canonical = normalizeTag(args.canonical);
    if (!alias) throw new ConvexError("Name the alias.");
    const existing = await ctx.db
      .query("tagAliases")
      .withIndex("by_alias", (q) => q.eq("alias", alias))
      .unique();
    if (!canonical) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    if (alias === canonical) throw new ConvexError("An alias has to differ from the tag.");
    const hop = await ctx.db
      .query("tagAliases")
      .withIndex("by_alias", (q) => q.eq("alias", canonical))
      .unique();
    if (hop) throw new ConvexError("That tag is already an alias.");
    const pointed = await ctx.db
      .query("tagAliases")
      .filter((q) => q.eq(q.field("canonical"), alias))
      .first();
    if (pointed && pointed.alias !== alias) {
      throw new ConvexError("That alias is already a canonical tag.");
    }
    if (existing) await ctx.db.patch(existing._id, { canonical });
    else await ctx.db.insert("tagAliases", { alias, canonical });
    return null;
  },
});
