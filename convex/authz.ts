import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx | ActionCtx;

export async function optionalUserId(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export async function requireUserId(ctx: AuthCtx) {
  const userId = await optionalUserId(ctx);
  if (!userId) throw new ConvexError("Sign in to do that.");
  return userId;
}
