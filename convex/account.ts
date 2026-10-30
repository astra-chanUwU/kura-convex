import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import { passwordProblem } from "../shared/password";
import { generateRecoveryKey, recoveryKeyHash, sameSecret } from "../shared/recovery";
import { accountEmail, normalizeUsername } from "../shared/username";

const usernameMessage = "Usernames use 3–24 lowercase letters, numbers or underscores.";
const lastMethodMessage = "You always keep at least one way to sign in.";
const recoverMessage = "That username or recovery key is not right.";

type Adapter = {
  findOne: (args: { model: string; where: { field: string; value: string }[] }) => Promise<Record<string, unknown> | null>;
  findMany: (args: {
    model: string;
    where: { field: string; value: string }[];
    limit?: number;
  }) => Promise<Record<string, unknown>[]>;
  create: (args: { model: string; data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  update: (args: {
    model: string;
    where: { field: string; value: string }[];
    update: Record<string, unknown>;
  }) => Promise<unknown>;
  delete: (args: { model: string; where: { field: string; value: string }[] }) => Promise<unknown>;
  deleteMany: (args: { model: string; where: { field: string; value: string }[] }) => Promise<unknown>;
};

type AuthCtx = {
  body?: { username?: unknown; password?: unknown; name?: unknown; email?: unknown };
  context: {
    adapter: Adapter;
    password: { hash: (password: string) => Promise<string> };
    internalAdapter: {
      createSession: (userId: string) => Promise<{ token: string } | null>;
      findUserById: (userId: string) => Promise<Record<string, unknown> | null>;
    };
  };
  json: (body: unknown) => unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function recordId(row: Record<string, unknown> | null) {
  const id = row?.id ?? row?._id;
  return typeof id === "string" ? id : "";
}

async function passkeysFor(adapter: Adapter, userId: string) {
  const rows = await adapter.findMany({ model: "passkey", where: [{ field: "userId", value: userId }], limit: 20 });
  return Array.isArray(rows) ? rows : [];
}

async function credentialFor(adapter: Adapter, userId: string) {
  return adapter.findOne({
    model: "account",
    where: [
      { field: "userId", value: userId },
      { field: "providerId", value: "credential" },
    ],
  });
}

async function hasPassword(adapter: Adapter, userId: string) {
  const account = await credentialFor(adapter, userId);
  return typeof account?.password === "string" && account.password.length > 0;
}

async function emptyAccount(adapter: Adapter, userId: string) {
  if (await hasPassword(adapter, userId)) return false;
  return (await passkeysFor(adapter, userId)).length === 0;
}

async function deleteAccount(adapter: Adapter, userId: string) {
  await adapter.deleteMany({ model: "passkey", where: [{ field: "userId", value: userId }] });
  await adapter.deleteMany({ model: "session", where: [{ field: "userId", value: userId }] });
  await adapter.deleteMany({ model: "account", where: [{ field: "userId", value: userId }] });
  await adapter.delete({ model: "user", where: [{ field: "id", value: userId }] });
}

async function userByUsername(adapter: Adapter, username: string) {
  return adapter.findOne({ model: "user", where: [{ field: "username", value: username }] });
}

function displayName(username: string, raw: unknown) {
  const name = text(raw).trim().slice(0, 60);
  return name || username;
}

export async function preparePasskeyUser(adapter: Adapter, context: string | null | undefined) {
  let parsed: { username?: unknown; displayName?: unknown } = {};
  try {
    parsed = JSON.parse(context || "") as { username?: unknown; displayName?: unknown };
  } catch {
    parsed = {};
  }
  const username = normalizeUsername(text(parsed.username));
  if (!username) throw new APIError("BAD_REQUEST", { message: usernameMessage });
  const name = displayName(username, parsed.displayName);
  const existing = await userByUsername(adapter, username);
  const existingId = recordId(existing);
  if (existingId) {
    if (!(await emptyAccount(adapter, existingId))) {
      throw new APIError("BAD_REQUEST", { message: "That username is taken." });
    }
    return { id: existingId, name, displayName: username };
  }
  const created = await adapter.create({
    model: "user",
    data: {
      name,
      email: accountEmail(username),
      emailVerified: false,
      username,
      displayUsername: name,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const id = recordId(created);
  if (!id) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not create that account." });
  return { id, name, displayName: username };
}

export async function openPasskeySession(ctx: AuthCtx, userId: string) {
  const session = await ctx.context.internalAdapter.createSession(userId);
  const user = await ctx.context.internalAdapter.findUserById(userId);
  if (!session || !user) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not start a session." });
  await setSessionCookie(ctx as never, { session: session as never, user: user as never });
}

async function savePassword(ctx: AuthCtx, userId: string, password: string) {
  const hash = await ctx.context.password.hash(password);
  const account = await credentialFor(ctx.context.adapter, userId);
  if (recordId(account)) {
    await ctx.context.adapter.update({
      model: "account",
      where: [{ field: "id", value: recordId(account) }],
      update: { password: hash, updatedAt: new Date() },
    });
    return;
  }
  await ctx.context.adapter.create({
    model: "account",
    data: {
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

async function issueRecoveryKey(ctx: AuthCtx, userId: string) {
  const key = generateRecoveryKey();
  await ctx.context.adapter.update({
    model: "user",
    where: [{ field: "id", value: userId }],
    update: { recoveryKeyHash: await recoveryKeyHash(key), recoveryKeyCreatedAt: Date.now() },
  });
  return key;
}

function stamp(value: unknown) {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return null;
}

export const kuraAccount = () => {
  return {
    id: "kura-account",
    endpoints: {
      security: createAuthEndpoint(
        "/kura/security",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          const auth = ctx as unknown as AuthCtx;
          const userId = ctx.context.session.user.id;
          const user = await auth.context.adapter.findOne({ model: "user", where: [{ field: "id", value: userId }] });
          const passkeys = await passkeysFor(auth.context.adapter, userId);
          return ctx.json({
            username: text(user?.username) || null,
            hasPassword: await hasPassword(auth.context.adapter, userId),
            hasRecoveryKey: text(user?.recoveryKeyHash).length > 0,
            recoveryKeyCreatedAt: stamp(user?.recoveryKeyCreatedAt),
            passkeys: passkeys.map((row) => ({
              id: recordId(row),
              name: text(row.name) || "Passkey",
              createdAt: stamp(row.createdAt),
            })),
          });
        },
      ),
      issueRecoveryKey: createAuthEndpoint(
        "/kura/recovery-key",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const auth = ctx as unknown as AuthCtx;
          return ctx.json({ recoveryKey: await issueRecoveryKey(auth, ctx.context.session.user.id) });
        },
      ),
      setPassword: createAuthEndpoint(
        "/kura/password",
        { method: "POST", body: z.object({ password: z.string() }), use: [sessionMiddleware] },
        async (ctx) => {
          const auth = ctx as unknown as AuthCtx;
          const user = await auth.context.adapter.findOne({
            model: "user",
            where: [{ field: "id", value: ctx.context.session.user.id }],
          });
          const problem = passwordProblem(text(user?.username), ctx.body.password);
          if (problem) throw new APIError("BAD_REQUEST", { message: problem });
          await savePassword(auth, ctx.context.session.user.id, ctx.body.password);
          return ctx.json({ ok: true });
        },
      ),
      removePassword: createAuthEndpoint(
        "/kura/password/remove",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const auth = ctx as unknown as AuthCtx;
          const userId = ctx.context.session.user.id;
          if ((await passkeysFor(auth.context.adapter, userId)).length === 0) {
            throw new APIError("BAD_REQUEST", { message: lastMethodMessage });
          }
          const account = await credentialFor(auth.context.adapter, userId);
          const accountId = recordId(account);
          if (accountId) {
            await auth.context.adapter.delete({ model: "account", where: [{ field: "id", value: accountId }] });
          }
          return ctx.json({ ok: true });
        },
      ),
      recover: createAuthEndpoint(
        "/kura/recover",
        {
          method: "POST",
          body: z.object({ username: z.string(), recoveryKey: z.string(), newPassword: z.string() }),
        },
        async (ctx) => {
          const auth = ctx as unknown as AuthCtx;
          const username = normalizeUsername(ctx.body.username);
          const given = await recoveryKeyHash(ctx.body.recoveryKey);
          const dummy = await recoveryKeyHash("kura-unknown-user");
          const user = username ? await userByUsername(auth.context.adapter, username) : null;
          const stored = text(user?.recoveryKeyHash) || dummy;
          if (!username || !user || !sameSecret(given, stored) || stored === dummy) {
            throw new APIError("BAD_REQUEST", { message: recoverMessage });
          }
          const problem = passwordProblem(username, ctx.body.newPassword);
          if (problem) throw new APIError("BAD_REQUEST", { message: problem });
          const userId = recordId(user);
          await savePassword(auth, userId, ctx.body.newPassword);
          await auth.context.adapter.deleteMany({ model: "passkey", where: [{ field: "userId", value: userId }] });
          await auth.context.adapter.deleteMany({ model: "session", where: [{ field: "userId", value: userId }] });
          const recoveryKey = await issueRecoveryKey(auth, userId);
          await openPasskeySession(auth, userId);
          return ctx.json({ recoveryKey });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const auth = ctx as unknown as AuthCtx;
            const rawUsername = text(auth.body?.username);
            if (!rawUsername) return;
            const username = normalizeUsername(rawUsername);
            if (!username) throw new APIError("BAD_REQUEST", { message: usernameMessage });
            if (auth.body) auth.body.username = username;
            const password = text(auth.body?.password);
            const problem = passwordProblem(username, password);
            if (problem) throw new APIError("BAD_REQUEST", { message: problem });
            const name = displayName(username, auth.body?.name);
            if (auth.body) {
              auth.body.name = name;
              if (!text(auth.body.email)) auth.body.email = accountEmail(username);
            }
            const existing = await userByUsername(auth.context.adapter, username);
            const existingId = recordId(existing);
            if (existingId && (await emptyAccount(auth.context.adapter, existingId))) {
              await deleteAccount(auth.context.adapter, existingId);
            }
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/passkey/delete-passkey",
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (!session?.user?.id) return;
            const auth = ctx as unknown as AuthCtx;
            const passkeys = await passkeysFor(auth.context.adapter, session.user.id);
            if (passkeys.length <= 1 && !(await hasPassword(auth.context.adapter, session.user.id))) {
              throw new APIError("BAD_REQUEST", { message: lastMethodMessage });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
