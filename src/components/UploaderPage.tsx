import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UploaderHeader({ userId }: { userId: string }) {
  const profile = useQuery(api.preferences.profile, { userId });
  if (profile === undefined) return <p className="mb-4 text-sm text-muted-foreground">Loading account…</p>;
  if (profile === null) return <p className="mb-4 text-sm text-muted-foreground">That account is not on the board.</p>;
  const website = profile.website.trim();
  const linked = website.startsWith("http://") || website.startsWith("https://");
  return (
    <header className="mb-4 grid gap-1.5">
      <h1 className="m-0 text-2xl font-semibold break-words">{profile.displayName}</h1>
      {profile.bio.trim() !== "" && <p className="m-0 max-w-prose text-sm whitespace-pre-wrap">{profile.bio}</p>}
      {profile.location.trim() !== "" && <p className="m-0 text-sm text-muted-foreground">{profile.location}</p>}
      {website !== "" &&
        (linked ? (
          <a href={website} target="_blank" rel="noreferrer" className="w-fit max-w-full text-sm break-all text-accent">
            {website}
          </a>
        ) : (
          <p className="m-0 text-sm break-all text-muted-foreground">{website}</p>
        ))}
    </header>
  );
}
