import { useMutation, useQuery } from "convex/react";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export function SettingsMenu({ onPreferences }: { onPreferences: () => void }) {
  const prefs = useQuery(api.preferences.get);
  const save = useMutation(api.preferences.save);
  const [open, setOpen] = useState(false);
  const [askAge, setAskAge] = useState(false);
  const session = authClient.useSession();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
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
    <div className="absolute top-3 right-3 z-20">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="bg-surface text-muted-foreground"
      >
        <Settings />
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Theme</span>
            <ThemeSwitch value={theme} onChange={(next) => void patch({ theme: next })} />
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm">
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
            className="mt-3 w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
            onClick={() => {
              setOpen(false);
              if (session.data?.user) onPreferences();
              else window.location.hash = "#/auth";
            }}
          >
            Profile preferences
          </button>
        </div>
      )}
      {askAge && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6" role="dialog">
            <h2 className="text-lg font-semibold">Are you over 18?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sensitive pictures stay hidden until you confirm. Safebooru seeds are rated general.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAskAge(false)}>
                Keep hidden
              </Button>
              <Button
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
