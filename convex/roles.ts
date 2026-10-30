import { v } from "convex/values";
import type { AccountRole } from "../shared/roles";
import { seedAccountRoles } from "../shared/roles";
import { components } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { accountRole } from "./validators";

export async function writeRole(ctx: MutationCtx, userId: string, role: AccountRole, name?: string) {
  const existing = await ctx.db
    .query("preferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) {
    if (existing.role !== role) await ctx.db.patch(existing._id, { role });
    return;
  }
  const displayName = (name ?? "").trim().slice(0, 60) || "You";
  await ctx.db.insert("preferences", {
    userId,
    displayName,
    bio: "",
    location: "",
    website: "",
    theme: "kura",
    font: "system",
    showSensitive: false,
    includeTags: [],
    excludeTags: [],
    role,
  });
}

export const ensureUsername = internalMutation({
  args: { email: v.string(), username: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: args.email }],
    });
    if (!user || typeof user !== "object" || !("_id" in user)) return null;
    if ("username" in user && typeof user.username === "string" && user.username) return null;
    const taken = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "username", operator: "eq", value: args.username }],
    });
    if (taken) return null;
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", operator: "eq", value: String(user._id) }],
        update: { username: args.username, displayUsername: args.username },
      },
    });
    return null;
  },
});

export const viewerRole = internalQuery({
  args: {},
  returns: v.union(accountRole, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const row = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
    return row?.role ?? "member";
  },
});

// Safe to run again. Skips emails that do not have an account yet.
export const backfill = internalMutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    missing: v.array(v.string()),
  }),
  handler: async (ctx) => {
    let updated = 0;
    const missing: string[] = [];
    for (const [email, role] of Object.entries(seedAccountRoles)) {
      const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", operator: "eq", value: email }],
      });
      const userId = user && typeof user === "object" && "_id" in user ? String(user._id) : "";
      if (!userId) {
        missing.push(email);
        continue;
      }
      const name = user && typeof user === "object" && "name" in user && typeof user.name === "string" ? user.name : "";
      await writeRole(ctx, userId, role, name);
      updated += 1;
    }
    return { updated, missing };
  },
});
