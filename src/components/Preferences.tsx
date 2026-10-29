import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export function Preferences() {
  const prefs = useQuery(api.preferences.get);
  const save = useMutation(api.preferences.save);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!prefs) return;
    setDisplayName(prefs.displayName);
    setBio(prefs.bio);
    setInclude(prefs.includeTags.join(" "));
    setExclude(prefs.excludeTags.join(" "));
  }, [prefs]);

  if (!prefs) return <p className="p-8 text-muted-foreground">Loading preferences…</p>;
  if (!prefs.signedIn) {
    return (
      <div className="grid min-h-full place-items-center">
        <a href="#/auth" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Sign in to edit preferences
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-16 pb-10">
      <h1 className="text-3xl font-semibold">Profile preferences</h1>
      <p className="mt-2 text-sm text-muted-foreground">Saved on your account. The board reads these filters live.</p>
      <form
        className="mt-6 rounded-2xl border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            displayName,
            bio,
            location: prefs.location,
            website: prefs.website,
            theme: prefs.theme,
            showSensitive: prefs.showSensitive,
            includeTags: include.split(/\s+/).filter(Boolean),
            excludeTags: exclude.split(/\s+/).filter(Boolean),
          }).then(() => setNotice("Saved."));
        }}
      >
        <Label htmlFor="display-name">Display name</Label>
        <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1" />
        <Label htmlFor="bio" className="mt-4 block">
          Bio
        </Label>
        <Textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} className="mt-1" />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm">Theme</span>
          <ThemeSwitch
            value={prefs.theme}
            onChange={(theme) => {
              void save({
                displayName,
                bio,
                location: prefs.location,
                website: prefs.website,
                theme,
                showSensitive: prefs.showSensitive,
                includeTags: prefs.includeTags,
                excludeTags: prefs.excludeTags,
              });
            }}
          />
        </div>
        <Label htmlFor="include" className="mt-4 block">
          Require tags
        </Label>
        <Input id="include" value={include} onChange={(event) => setInclude(event.target.value)} placeholder="yuri cyberpunk" className="mt-1" />
        <Label htmlFor="exclude" className="mt-4 block">
          Exclude tags
        </Label>
        <Input id="exclude" value={exclude} onChange={(event) => setExclude(event.target.value)} className="mt-1" />
        <Button type="submit" className="mt-5">
          Save preferences
        </Button>
        {notice && <p className="mt-3 text-sm text-muted-foreground">{notice}</p>}
      </form>
    </div>
  );
}
