import { ConvexError, v } from "convex/values";
import type { AccountRole } from "../shared/roles";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { optionalUserId, requireUserId, roleFor } from "./authz";
import {
  accountRole,
  clip,
  font,
  normalizeFont,
  normalizeTags,
  normalizeTheme,
  preferenceResult,
  theme,
} from "./validators";

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

function storedRole(role: AccountRole | undefined): AccountRole {
  return role ?? "member";
}

export const get = query({
  args: {},
  returns: preferenceResult,
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return { ...defaults, role: null, signedIn: false as const };
    const row = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const identity = await ctx.auth.getUserIdentity();
    const displayName = row?.displayName || identity?.name || defaults.displayName;
    if (!row) {
      return { ...defaults, displayName, role: "member" as const, signedIn: true as const };
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
      role: storedRole(row.role),
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
  returns: preferenceResult,
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
    else await ctx.db.insert("preferences", { ...next, role: "member" });
    return {
      displayName: next.displayName,
      bio: next.bio,
      location: next.location,
      website: next.website,
      theme: next.theme,
      font: next.font,
      showSensitive: next.showSensitive,
      includeTags: next.includeTags,
      excludeTags: next.excludeTags,
      role: storedRole(existing?.role),
      signedIn: true as const,
    };
  },
});

async function requireOwner(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUserId(ctx);
  if ((await roleFor(ctx, userId)) !== "owner") throw new ConvexError("Only the owner can do that.");
  return userId;
}

const accountRow = v.object({
  userId: v.string(),
  displayName: v.string(),
  role: accountRole,
});

export const listAccounts = query({
  args: {},
  returns: v.array(accountRow),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const rows = await ctx.db.query("preferences").take(200);
    return rows
      .map((row) => ({
        userId: row.userId,
        displayName: row.displayName,
        role: storedRole(row.role),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const setRole = mutation({
  args: { userId: v.string(), role: accountRole },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if ((existing?.role ?? "member") === "owner" && args.role !== "owner") {
      const owners = await ctx.db
        .query("preferences")
        .filter((q) => q.eq(q.field("role"), "owner"))
        .collect();
      if (owners.length <= 1) throw new ConvexError("The board still needs an owner.");
    }
    if (!existing) {
      await ctx.db.insert("preferences", { ...defaults, userId: args.userId, role: args.role });
      return null;
    }
    if (existing.role !== args.role) await ctx.db.patch(existing._id, { role: args.role });
    return null;
  },
});

const publicProfile = v.object({
  displayName: v.string(),
  bio: v.string(),
  location: v.string(),
  website: v.string(),
  role: accountRole,
});

export const profile = query({
  args: { userId: v.string() },
  returns: v.union(publicProfile, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!row) return null;
    return {
      displayName: row.displayName,
      bio: row.bio,
      location: row.location,
      website: row.website,
      role: storedRole(row.role),
    };
  },
});
