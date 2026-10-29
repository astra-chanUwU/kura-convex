import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = readEnv("SITE_URL", "http://127.0.0.1:5175");

function readEnv(name: string, fallback: string) {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ];
  return value || fallback;
}

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: "Kura",
    baseURL: readEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211"),
    secret: readEnv("BETTER_AUTH_SECRET", ""),
    trustedOrigins: [siteUrl, "http://127.0.0.1:5175", "http://localhost:5175"],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      id: identity.subject,
      name: identity.name ?? null,
      email: identity.email ?? null,
    };
  },
});
