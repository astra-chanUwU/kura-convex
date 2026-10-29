import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function Preferences() {
  const prefs = useQuery(api.preferences.get);
  const save = useMutation(api.preferences.save);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!prefs) return;
    setDisplayName(prefs.displayName);
    setBio(prefs.bio);
    setInclude(prefs.includeTags.join(" "));
    setExclude(prefs.excludeTags.join(" "));
    setLocation(prefs.location);
    setWebsite(prefs.website);
  }, [prefs]);

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
      <form
        className="grid max-w-[26rem] gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            displayName,
            bio,
            location,
            website,
            theme: prefs.theme,
            showSensitive: prefs.showSensitive,
            includeTags: include.split(/\s+/).filter(Boolean),
            excludeTags: exclude.split(/\s+/).filter(Boolean),
          }).then(() => setNotice("Saved."));
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
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Theme</span>
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
        {notice && <p className="m-0 text-sm text-accent-soft">{notice}</p>}
      </form>
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
