import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { AppearanceControls } from "@/components/AppearanceControls";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { errorText } from "@/lib/errors";
import type { FontId, ThemeId } from "@/lib/appearance";

export function Preferences({
  theme,
  font,
  onAppearance,
}: {
  theme: ThemeId;
  font: FontId;
  onAppearance: (next: Partial<{ theme: ThemeId; font: FontId }>) => void;
}) {
  const prefs = useQuery(api.preferences.get);

  if (!prefs) return <p className="text-sm text-muted-foreground">Loading preferences…</p>;
  if (!prefs.signedIn) {
    return (
      <section className="grid max-w-md gap-3">
        <h1 className="m-0 text-2xl font-semibold">Preferences</h1>
        <p className="m-0 text-sm text-muted-foreground">Sign in to edit the filters this board reads.</p>
        <a
          href="#/auth"
          className="inline-flex h-9 w-fit items-center rounded-md border border-border-strong bg-surface-soft px-3.5 text-sm text-foreground no-underline hover:bg-selection"
        >
          Sign in
        </a>
      </section>
    );
  }

  return (
    <section className="grid max-w-[44rem] gap-4">
      <h1 className="m-0 text-2xl font-semibold">Preferences</h1>
      <p className="m-0 text-sm text-muted-foreground">
        Saved on your account. Default tags fill an empty board, and My defaults on the board jumps back to them.
      </p>
      <PreferencesForm prefs={prefs} theme={theme} font={font} onAppearance={onAppearance} />
      <button
        type="button"
        className="w-fit cursor-pointer border-0 bg-transparent p-0 text-sm text-danger"
        onClick={() => {
          void authClient.signOut().then(() => {
            window.location.hash = "#/";
          });
        }}
      >
        Sign out
      </button>
    </section>
  );
}

function PreferencesForm({
  prefs,
  theme,
  font,
  onAppearance,
}: {
  prefs: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    showSensitive: boolean;
    includeTags: string[];
    excludeTags: string[];
  };
  theme: ThemeId;
  font: FontId;
  onAppearance: (next: Partial<{ theme: ThemeId; font: FontId }>) => void;
}) {
  const save = useMutation(api.preferences.save);
  const [displayName, setDisplayName] = useState(prefs.displayName);
  const [bio, setBio] = useState(prefs.bio);
  const [include, setInclude] = useState(prefs.includeTags.join(" "));
  const [exclude, setExclude] = useState(prefs.excludeTags.join(" "));
  const [location, setLocation] = useState(prefs.location);
  const [website, setWebsite] = useState(prefs.website);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  return (
    <form
      className="grid max-w-[26rem] gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setFailed(false);
        void save({
          displayName,
          bio,
          location,
          website,
          theme,
          font,
          showSensitive: prefs.showSensitive,
          includeTags: include.split(/\s+/).filter(Boolean),
          excludeTags: exclude.split(/\s+/).filter(Boolean),
        })
          .then(() => setNotice("Saved."))
          .catch((caught) => {
            setFailed(true);
            setNotice(errorText(caught, "Could not save preferences."));
          });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="display-name">Display name</Label>
        <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} />
      </div>
      <AppearanceControls theme={theme} font={font} onChange={onAppearance} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(event) => setLocation(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://"
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="include">Default tags</Label>
        <Input
          id="include"
          value={include}
          onChange={(event) => setInclude(event.target.value)}
          placeholder="yuri cyberpunk"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="exclude">Default exclusions</Label>
        <Input id="exclude" value={exclude} onChange={(event) => setExclude(event.target.value)} />
      </div>
      <Button type="submit" className="w-fit">
        Save preferences
      </Button>
      {notice && <p className={failed ? "m-0 text-sm text-danger" : "m-0 text-sm text-accent-soft"}>{notice}</p>}
    </form>
  );
}
