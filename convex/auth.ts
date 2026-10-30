import { passkey } from "@better-auth/passkey";
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { getSessionFromCtx } from "better-auth/api";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { username } from "better-auth/plugins";
import { anyApi } from "convex/server";
import { roleForEmail } from "../shared/roles";
import { normalizeUsername } from "../shared/username";
import { kuraAccount, openPasskeySession, preparePasskeyUser } from "./account";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { v } from "convex/values";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { writeRole } from "./roles";

const siteUrl = readEnv("SITE_URL", "http://127.0.0.1:5175");

function readEnv(name: string, fallback: string) {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ];
  return value || fallback;
}

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: { schema: authSchema },
  authFunctions: {
    onCreate: anyApi.auth.onCreate,
    onUpdate: anyApi.auth.onUpdate,
    onDelete: anyApi.auth.onDelete,
  },
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        await writeRole(ctx, String(doc._id), roleForEmail(doc.email), doc.name);
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    appName: "Kura",
    baseURL: readEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211"),
    secret: readEnv("BETTER_AUTH_SECRET", ""),
    trustedOrigins: [siteUrl, "http://127.0.0.1:5175", "http://localhost:5175"],
    database: authComponent.adapter(ctx),
    user: {
      additionalFields: {
        recoveryKeyHash: { type: "string", required: false, input: false },
        recoveryKeyCreatedAt: { type: "number", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 15,
      maxPasswordLength: 128,
    },
    // kuraAccount runs before the username plugin so an abandoned passkey
    // sign-up can be replaced. The Convex plugin sets the JWT cookie in an
    // after hook and has to run before crossDomain copies Set-Cookie.
    plugins: [
      kuraAccount(),
      username({
        minUsernameLength: 3,
        maxUsernameLength: 24,
        usernameNormalization: (value) => value.trim().toLowerCase(),
        validationOrder: { username: "post-normalization" },
        usernameValidator: (value) => normalizeUsername(value) !== null,
      }),
      passkey({
        rpID: passkeyRpId(siteUrl),
        rpName: "Kura",
        origin: pageOrigins(siteUrl),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "preferred",
        },
        registration: {
          requireSession: false,
          resolveUser: async ({ ctx, context }) => preparePasskeyUser(ctx.context.adapter, context),
          afterVerification: async ({ ctx, user }) => {
            if (await getSessionFromCtx(ctx)) return;
            await openPasskeySession(ctx as never, user.id);
          },
        },
      }),
      convex({ authConfig }),
      crossDomain({ siteUrl }),
    ],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

function pageOrigins(url: string) {
  const origins = new Set(["http://localhost:5175", "http://127.0.0.1:5175", url]);
  return [...origins];
}

function passkeyRpId(url: string) {
  try {
    const host = new URL(url).hostname;
    if (host && host !== "127.0.0.1" && host !== "0.0.0.0") return host;
  } catch {
    // The default site URL is the local Vite app.
  }
  return "localhost";
}

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      name: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
      username: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    return {
      id: user._id,
      name: user.name || null,
      email: user.email || null,
      username: user.username ?? null,
    };
  },
});
