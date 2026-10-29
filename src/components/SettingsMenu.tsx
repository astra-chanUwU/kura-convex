import { useMutation, useQuery } from "convex/react";
import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";

export function SettingsMenu({ onPreferences }: { onPreferences: () => void }) {
  const prefs = useQuery(api.preferences.get);
  const save = useMutation(api.preferences.save);
  const [open, setOpen] = useState(false);
  const [askAge, setAskAge] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const session = authClient.useSession();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("hashchange", close);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("hashchange", close);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const theme = prefs?.theme ?? "dark";

  async function patch(partial: Partial<NonNullable<typeof prefs>>) {
    if (!prefs?.signedIn) {
      window.location.hash = "#/auth";
      return;
    }
    await save({
      displayName: prefs.displayName,
      bio: prefs.bio,
      location: prefs.location,
      website: prefs.website,
      theme: prefs.theme,
      showSensitive: prefs.showSensitive,
      includeTags: prefs.includeTags,
      excludeTags: prefs.excludeTags,
      ...partial,
    });
  }

  return (
    <div ref={rootRef} className="flex items-center gap-2">
      <ThemeSwitch value={theme} onChange={(next) => void patch({ theme: next })} />
      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          aria-label="Settings"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Settings />
        </Button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-surface p-3 text-foreground">
            <label className="flex items-center justify-between gap-3 text-sm">
              Sensitive
              <Switch
                checked={prefs?.showSensitive ?? false}
                onCheckedChange={(checked) => {
                  if (checked) setAskAge(true);
                  else void patch({ showSensitive: false });
                }}
                aria-label="Show sensitive pictures"
              />
            </label>
            <button
              type="button"
              className="mt-2 w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-soft"
              onClick={() => {
                setOpen(false);
                if (session.data?.user) onPreferences();
                else window.location.hash = "#/auth";
              }}
            >
              Preferences
            </button>
          </div>
        )}
      </div>
      {askAge && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5" role="dialog">
            <h2 className="m-0 text-lg font-semibold">Are you over 18?</h2>
            <p className="mt-2 mb-0 text-sm text-muted-foreground">
              Sensitive pictures stay hidden until you confirm. Safebooru seeds are rated general.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAskAge(false)}>
                Keep hidden
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  setAskAge(false);
                  void patch({ showSensitive: true });
                }}
              >
                Yes, show them
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
