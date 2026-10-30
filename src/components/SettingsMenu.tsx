import { useMutation, useQuery } from "convex/react";
import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { errorText } from "@/lib/errors";

export function SettingsMenu({ onPreferences }: { onPreferences: () => void }) {
  const prefs = useQuery(api.preferences.get);
  const save = useMutation(api.preferences.save);
  const [open, setOpen] = useState(false);
  const [askAge, setAskAge] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

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

  async function patch(partial: Partial<NonNullable<typeof prefs>>) {
    if (!prefs?.signedIn) {
      window.location.hash = "#/auth";
      return;
    }
    setError("");
    try {
      await save({
      displayName: prefs.displayName,
      bio: prefs.bio,
      location: prefs.location,
      website: prefs.website,
      theme: prefs.theme,
      font: prefs.font,
      showSensitive: prefs.showSensitive,
      includeTags: prefs.includeTags,
      excludeTags: prefs.excludeTags,
      ...partial,
    });
    } catch (caught) {
      setError(errorText(caught, "Could not save that setting."));
    }
  }

  return (
    <div ref={rootRef} className="flex items-center gap-2">
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
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-[0.5rem] border border-border-strong bg-surface p-3 text-foreground">
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
                if (prefs?.signedIn) onPreferences();
                else window.location.hash = "#/auth";
              }}
            >
              Preferences
            </button>
          </div>
        )}
      </div>
      {error && <p className="m-0 text-xs text-danger">{error}</p>}
      <Dialog
        open={askAge}
        onClose={() => setAskAge(false)}
        title="Are you over 18?"
        description="Sensitive pictures stay hidden until you confirm you are over 18."
        className="max-w-sm"
      >
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
      </Dialog>
    </div>
  );
}
