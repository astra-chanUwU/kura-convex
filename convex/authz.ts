import { ConvexError } from "convex/values";
import type { AccountRole } from "../shared/roles";
import { canCurate, canModerate, canUpload } from "../shared/roles";
import { internal } from "./_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;
type DbCtx = QueryCtx | MutationCtx;

export async function optionalUserId(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export async function requireUserId(ctx: AuthCtx) {
  const userId = await optionalUserId(ctx);
  if (!userId) throw new ConvexError("Sign in to do that.");
  return userId;
}

function hasDb(ctx: AuthCtx): ctx is DbCtx {
  return "db" in ctx;
}

export async function roleFor(ctx: AuthCtx, userId: string): Promise<AccountRole> {
  if (!hasDb(ctx)) {
    const role = await ctx.runQuery(internal.roles.viewerRole, {});
    return role ?? "member";
  }
  const row = await ctx.db
    .query("preferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row?.role ?? "member";
}

export async function requirePoster(ctx: AuthCtx) {
  const userId = await requireUserId(ctx);
  const role = await roleFor(ctx, userId);
  if (!canUpload(role)) throw new ConvexError("Adding a picture needs a contributor account.");
  return userId;
}

export async function requireCurator(ctx: DbCtx) {
  const userId = await requireUserId(ctx);
  const role = await roleFor(ctx, userId);
  if (!canCurate(role)) throw new ConvexError("Curating tags needs a curator account.");
  return userId;
}

export async function requireModerator(ctx: DbCtx, userId: string) {
  const role = await roleFor(ctx, userId);
  if (!canModerate(role)) throw new ConvexError("You can only remove your own pictures.");
}
