import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function pictureCount(count: number) {
  return `${count} ${count === 1 ? "picture" : "pictures"}`;
}

export function PublicLists({ userId }: { userId: string }) {
  const lists = useQuery(api.lists.publicFor, { userId });
  if (lists === undefined) return null;
  return (
    <section className="mb-6 grid gap-3">
      <h2 className="m-0 text-base font-semibold">Public lists</h2>
      {lists.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No public lists yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lists.map((list) => (
            <a
              key={list._id}
              href={`#/lists/${encodeURIComponent(list._id)}`}
              className="group grid min-w-0 gap-1 rounded-xl border border-border bg-surface p-3 no-underline"
            >
              <span className="font-semibold break-words text-foreground group-hover:text-accent">{list.title}</span>
              {list.description.trim() !== "" && (
                <span className="line-clamp-2 text-sm text-muted-foreground">{list.description}</span>
              )}
              <span className="text-sm text-muted-foreground">{pictureCount(list.itemCount)}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

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
