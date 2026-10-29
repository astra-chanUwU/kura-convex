import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { AuthCard } from "@/components/AuthCard";
import { Board, TagSearch } from "@/components/Board";
import { PostView } from "@/components/PostView";
import { Preferences } from "@/components/Preferences";
import { SettingsMenu } from "@/components/SettingsMenu";
import { authClient } from "@/lib/auth-client";

type Route =
  | { name: "board"; q: string }
  | { name: "post"; id: string; q: string }
  | { name: "preferences"; q: string }
  | { name: "auth"; q: string };

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  const q = new URLSearchParams(search).get("q") ?? "";
  if (path.startsWith("/posts/")) return { name: "post", id: decodeURIComponent(path.slice("/posts/".length)), q };
  if (path.startsWith("/preferences")) return { name: "preferences", q };
  if (path.startsWith("/auth")) return { name: "auth", q };
  return { name: "board", q };
}

export default function App({ url }: { url: string }) {
  if (!url) return <p className="p-8">Start pnpm dev so the app can reach Convex.</p>;
  return <Kura />;
}

function Kura() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const prefs = useQuery(api.preferences.get);
  const session = authClient.useSession();

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const theme = prefs?.theme ?? "dark";
    const root = document.documentElement;
    const apply = (value: "light" | "dark") => {
      root.dataset.theme = value;
    };
    if (theme === "light" || theme === "dark") {
      apply(theme);
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => apply(media.matches ? "dark" : "light");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [prefs?.theme]);

  const q = route.q;
  const setQuery = (next: string) => {
    const params = next ? `?q=${encodeURIComponent(next)}` : "";
    window.location.hash = `#/${params}`;
  };
  const name = session.data?.user.name || prefs?.displayName || "Login";

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="flex w-[248px] shrink-0 flex-col px-3 py-3">
        <div className="px-1 text-[1.35rem] font-semibold tracking-tight">Kura</div>
        <a href="#/" className="mt-4 flex h-9 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm">
          Board
        </a>
        <TagSearch query={q} onQuery={setQuery} />
        <button
          type="button"
          onClick={() => {
            window.location.hash = session.data?.user ? "#/preferences" : "#/auth";
          }}
          className="mt-auto flex items-center gap-3 rounded-lg px-2 py-3 text-left text-muted-foreground hover:bg-foreground/5"
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary text-sm text-primary-foreground">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">{session.data?.user ? name : "Login"}</span>
            <span className="block text-xs">{session.data?.user ? "Preferences" : "Sign in"}</span>
          </span>
        </button>
        {session.data?.user && (
          <button
            type="button"
            className="mb-2 px-2 text-left text-xs text-muted-foreground"
            onClick={() => void authClient.signOut()}
          >
            Sign out
          </button>
        )}
      </aside>
      <section className="relative m-2 ml-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <SettingsMenu onPreferences={() => (window.location.hash = "#/preferences")} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {route.name === "board" && <Board query={q} />}
          {route.name === "post" && <PostView id={route.id} />}
          {route.name === "preferences" && <Preferences />}
          {route.name === "auth" && <AuthCard />}
        </div>
      </section>
    </div>
  );
}
