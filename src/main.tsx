import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { authClient } from "./lib/auth-client.ts";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing.");

const url = import.meta.env.VITE_CONVEX_URL ?? "";
const convex = url ? new ConvexReactClient(url) : null;

createRoot(root).render(
  <StrictMode>
    {convex ? (
      <ConvexBetterAuthProvider client={convex} authClient={authClient as unknown as AuthClient}>
        <App url={url} />
      </ConvexBetterAuthProvider>
    ) : (
      <App url="" />
    )}
  </StrictMode>,
);
