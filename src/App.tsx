import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import { AppearanceControls } from "@/components/AppearanceControls";
import { AuthCard } from "@/components/AuthCard";
import { Board } from "@/components/Board";
import { PostView } from "@/components/PostView";
import { Preferences } from "@/components/Preferences";
import { SettingsMenu } from "@/components/SettingsMenu";
import { UploadDialog } from "@/components/UploadDialog";
import { useAppearance } from "@/hooks/useAppearance";
import type { FontId, ThemeId } from "@/lib/appearance";
import {
  boardHash,
  EMPTY_FILTER,
  filterActive,
  parseFilter,
  readBoardView,
  writeBoard,
  writeBoardView,
  type BoardFilter,
  type BoardView,
} from "@/lib/board";
import { cn } from "@/lib/utils";

type Route =
  | { name: "board"; saved: boolean; filter: BoardFilter }
  | { name: "post"; id: string; saved: boolean; filter: BoardFilter }
  | { name: "preferences" }
  | { name: "auth"; mode: "sign-in" | "sign-up" };

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  const params = new URLSearchParams(search);
  const filter = parseFilter(params);
  const saved = path.startsWith("/saved") || params.get("saved") === "1";
  if (path.startsWith("/posts/")) {
    return { name: "post", id: decodeURIComponent(path.slice("/posts/".length)), saved, filter };
  }
  if (path.startsWith("/preferences")) return { name: "preferences" };
  if (path.startsWith("/auth")) {
    return { name: "auth", mode: params.get("mode") === "sign-up" ? "sign-up" : "sign-in" };
  }
  return { name: "board", saved: path.startsWith("/saved"), filter };
}

function navClass(active: boolean) {
  return cn(
    "flex items-center border-b-2 text-[0.85rem] whitespace-nowrap no-underline",
    active ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

export default function App({ url }: { url: string }) {
  if (!url) return <p className="p-8 text-muted-foreground">Start pnpm dev so the app can reach Convex.</p>;
  return <Kura />;
}

function Kura() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [upload, setUpload] = useState(false);
  const [view, setView] = useState<BoardView>(() => readBoardView());
  const prefs = useQuery(api.preferences.get);
  const account = useQuery(api.auth.getCurrentUser);
  const save = useMutation(api.preferences.save);
  const signedIn = account != null && prefs?.signedIn === true;
  const persistAppearance = useCallback(
    (theme: ThemeId, font: FontId) => {
      if (!prefs?.signedIn) return;
      void save({
        displayName: prefs.displayName,
        bio: prefs.bio,
        location: prefs.location,
        website: prefs.website,
        theme,
        font,
        showSensitive: prefs.showSensitive,
        includeTags: prefs.includeTags,
        excludeTags: prefs.excludeTags,
      }).catch(() => {});
    },
    [prefs, save],
  );
  const { theme, font, change } = useAppearance(prefs?.theme, prefs?.font, signedIn, persistAppearance);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (route.name !== "board" || route.saved || route.filter.cleared || filterActive(route.filter)) return;
    if (!prefs?.signedIn) return;
    if (prefs.includeTags.length === 0 && prefs.excludeTags.length === 0) return;
    writeBoard(false, { ...EMPTY_FILTER, tags: prefs.includeTags, exclude: prefs.excludeTags }, true);
  }, [route, prefs]);

  const name = account?.name || prefs?.displayName || "Account";
  const onBoard = route.name === "board";
  const boardSaved = route.name === "board" ? route.saved : route.name === "post" ? route.saved : false;
  const wideBoard = onBoard && view.wide;

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 flex min-h-[var(--header-h)] items-stretch gap-8 border-b border-border bg-surface px-[var(--page-x)] max-[900px]:gap-4 max-[640px]:gap-3">
        <a
          href="#/"
          aria-label="Kura home"
          className="flex items-center text-[1.05rem] font-bold tracking-[-0.04em] text-foreground no-underline max-[640px]:text-base"
        >
          Kura
        </a>
        <nav aria-label="Main navigation" className="flex min-w-0 items-stretch gap-5 max-[900px]:gap-3.5 max-[640px]:gap-3">
          <a href="#/" className={navClass((route.name === "board" || route.name === "post") && !boardSaved)}>
            Board
          </a>
          <a href="#/saved" className={navClass(boardSaved && (route.name === "board" || route.name === "post"))}>
            Saved
          </a>
          {signedIn ? (
            <a href="#/preferences" className={cn(navClass(route.name === "preferences"), "min-w-0 gap-2")}>
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-surface-soft text-xs font-bold text-accent">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-48 truncate max-[900px]:max-w-32 max-[640px]:max-w-[4.5rem]">{name}</span>
            </a>
          ) : (
            <>
              <a href="#/auth" className={navClass(route.name === "auth" && route.mode === "sign-in")}>
                Sign in
              </a>
              <a
                href="#/auth?mode=sign-up"
                className={cn(navClass(route.name === "auth" && route.mode === "sign-up"), "max-[380px]:hidden")}
              >
                Create account
              </a>
            </>
          )}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AppearanceControls theme={theme} font={font} onChange={change} />
          <SettingsMenu onPreferences={() => (window.location.hash = "#/preferences")} />
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "min-h-[calc(100dvh-var(--header-h))] px-[var(--page-x)] py-8 outline-none max-[900px]:py-5 max-[640px]:py-4",
          wideBoard ? "w-full" : "mx-auto w-full max-w-[82rem]",
        )}
      >
        {route.name === "board" && (
          <Board
            key={`${route.saved}:${route.filter.tags.join(",")}:${route.filter.exclude.join(",")}:${route.filter.q}:${route.filter.sort}`}
            filter={route.filter}
            saved={route.saved}
            defaults={
              prefs?.signedIn ? { tags: prefs.includeTags, exclude: prefs.excludeTags } : null
            }
            view={view}
            onView={(next) => {
              setView(next);
              writeBoardView(next);
            }}
            onUpload={() => {
              if (signedIn) setUpload(true);
              else window.location.hash = "#/auth";
            }}
          />
        )}
        {route.name === "post" && (
          <PostView id={route.id} back={boardHash(route.saved, route.filter)} />
        )}
        {route.name === "preferences" && (
          <Preferences theme={theme} font={font} onAppearance={change} />
        )}
        {route.name === "auth" && <AuthCard mode={route.mode} />}
      </main>
      {upload && <UploadDialog onClose={() => setUpload(false)} />}
    </div>
  );
}
