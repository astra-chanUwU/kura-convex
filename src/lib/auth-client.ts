import { passkeyClient } from "@better-auth/passkey/client";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [usernameClient(), passkeyClient(), convexClient(), crossDomainClient()],
});

export function passkeysSupported() {
  return typeof PublicKeyCredential !== "undefined";
}

export async function authPost<T>(path: string, body?: Record<string, unknown>) {
  const result = await authClient.$fetch(path, { method: "POST", body: body ?? {} });
  if (result.error) throw new Error(result.error.message || "Could not do that.");
  return result.data as T;
}

export async function authGet<T>(path: string) {
  const result = await authClient.$fetch(path);
  if (result.error) throw new Error(result.error.message || "Could not do that.");
  return result.data as T;
}
