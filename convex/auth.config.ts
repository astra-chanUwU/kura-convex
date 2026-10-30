import type { AuthConfig } from "convex/server";

// The HTTP site proxy listens on 3211 inside the Convex container, and that
// is also the published host port. JWKS is read from the container's own
// listener so token checks do not depend on the host mapping.
const issuer =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.CONVEX_SITE_URL || "http://127.0.0.1:3211";

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
