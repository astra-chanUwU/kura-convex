import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId } from "./authz";
import { clip, font, normalizeFont, normalizeTags, normalizeTheme, theme } from "./validators";

const defaults = {
  displayName: "You",
  bio: "",
  location: "",
  website: "",
  theme: "kura" as const,
  font: "system" as const,
  showSensitive: false,
  includeTags: [] as string[],
  excludeTags: [] as string[],
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return { ...defaults, signedIn: false as const };
    const row = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const identity = await ctx.auth.getUserIdentity();
    const displayName = row?.displayName || identity?.name || defaults.displayName;
    if (!row) {
      return { ...defaults, displayName, signedIn: true as const };
    }
    return {
      displayName,
      bio: row.bio,
      location: row.location,
      website: row.website,
      theme: normalizeTheme(row.theme),
      font: normalizeFont(row.font),
      showSensitive: row.showSensitive,
      includeTags: row.includeTags,
      excludeTags: row.excludeTags,
      signedIn: true as const,
    };
  },
});

export const save = mutation({
  args: {
    displayName: v.string(),
    bio: v.string(),
    location: v.string(),
    website: v.string(),
    theme,
    font,
    showSensitive: v.boolean(),
    includeTags: v.array(v.string()),
    excludeTags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const website = clip(args.website, 200);
    if (website && !/^https?:\/\//i.test(website)) {
      throw new ConvexError("Website needs to start with http:// or https://.");
    }
    const next = {
      userId,
      displayName: clip(args.displayName, 60) || "You",
      bio: clip(args.bio, 500),
      location: clip(args.location, 80),
      website,
      theme: normalizeTheme(args.theme),
      font: normalizeFont(args.font),
      showSensitive: args.showSensitive,
      includeTags: normalizeTags(args.includeTags),
      excludeTags: normalizeTags(args.excludeTags),
    };
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, next);
    else await ctx.db.insert("preferences", next);
    return { ...next, signedIn: true as const };
  },
});
