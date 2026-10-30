import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { authClient } from "./lib/auth-client.ts";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "hack-font/build/web/hack.css";
import "./index.css";

if (window.location.hostname === "127.0.0.1") {
  const next = new URL(window.location.href);
  next.hostname = "localhost";
  window.location.replace(next.href);
}

const root = window.location.hostname === "127.0.0.1" ? null : document.getElementById("root");
if (window.location.hostname !== "127.0.0.1" && !root) throw new Error("Root element #root is missing.");

const url = import.meta.env.VITE_CONVEX_URL ?? "";
const convex = url ? new ConvexReactClient(url) : null;

if (root) createRoot(root).render(
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
