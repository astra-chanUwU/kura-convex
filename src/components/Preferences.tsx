import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { AppearanceControls } from "@/components/AppearanceControls";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AccountSecurity } from "@/components/AccountSecurity";
import { errorText } from "@/lib/errors";
import { FONT_LABELS, THEME_LABELS, type FontId, type ThemeId } from "@/lib/appearance";
import { roleLabel } from "../../shared/roles";

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
          className="inline-flex w-fit items-center rounded-[0.4rem] border border-border-strong bg-surface-soft px-[0.9rem] py-[0.55rem] text-[0.9rem] text-foreground no-underline hover:bg-selection"
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
        {`${prefs.displayName.trim()}, ${roleLabel(prefs.role).toLowerCase()}`}
      </p>
      <p className="m-0 text-sm text-muted-foreground">
        Saved on your account. Default tags fill an empty board, and My defaults on the board jumps back to them.
      </p>
      <PreferencesForm prefs={prefs} theme={theme} font={font} />
      <AppearanceSample theme={theme} font={font} onAppearance={onAppearance} />
      <AccountSecurity />
    </section>
  );
}

function AppearanceSample({
  theme,
  font,
  onAppearance,
}: {
  theme: ThemeId;
  font: FontId;
  onAppearance: (next: Partial<{ theme: ThemeId; font: FontId }>) => void;
}) {
  return (
    <div className="grid max-w-[26rem] gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="m-0 text-base font-semibold">Appearance</h2>
      <p className="m-0 text-[0.85rem] text-muted-foreground">
        Theme and font apply right away and stay with this account.
      </p>
      <AppearanceControls layout="stacked" theme={theme} font={font} onChange={onAppearance} />
      <div
        data-theme={theme}
        data-font={font}
        className="rounded-[0.6rem] border border-border bg-background px-[0.9rem] py-3 text-foreground"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <strong>Aa</strong> — The quick brown fox.{" "}
        <span className="text-muted-foreground">
          {THEME_LABELS[theme]} · {FONT_LABELS[font]}
        </span>
      </div>
    </div>
  );
}

function PreferencesForm({
  prefs,
  theme,
  font,
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
