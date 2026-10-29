import type { AuthConfig } from "convex/server";

// The HTTP site proxy listens on 3211 inside the Convex container. The JWT
// issuer is the published site URL (3411 on this machine), which the
// container cannot open. Fetching JWKS from that public URL makes Convex
// reject every token, so the header can show a Better Auth session while
// queries still run as anonymous. The keys are the same service on 3211.
const issuer =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.CONVEX_SITE_URL || "http://127.0.0.1:3411";

export default {
  providers: [
    {
      type: "customJwt",
      issuer,
      applicationID: "convex",
      algorithm: "RS256",
      jwks: "http://127.0.0.1:3211/api/auth/convex/jwks",
    },
  ],
} satisfies AuthConfig;
