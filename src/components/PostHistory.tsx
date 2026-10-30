import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HistoryList } from "@/components/HistoryList";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { canModerate } from "../../shared/roles";

const ratings = ["safe", "questionable", "explicit"] as const;

export function PostHistory({ postId }: { postId: string }) {
  const id = postId as Id<"posts">;
  const prefs = useQuery(api.preferences.get);
  const signedIn = prefs?.signedIn === true;
  const entries = useQuery(api.history.forPost, signedIn ? { postId: id } : "skip");
  const rollback = useMutation(api.history.rollback);
  const [notice, setNotice] = useState("");
  if (!signedIn || entries === undefined || entries.length === 0) return null;
  const staff = canModerate(prefs.role);
  return (
    <section className="mt-8 grid max-w-[48rem] gap-3" aria-labelledby="post-history-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="post-history-title" className="m-0 text-lg font-semibold">
          History
        </h2>
        {staff && (
          <a href="#/history" className="text-sm text-accent no-underline">
            All changes
          </a>
        )}
      </div>
      {notice && <p className="m-0 text-sm text-success">{notice}</p>}
      <HistoryList
        entries={entries}
        allowRollback={staff}
        onRollback={async (changeId) => {
          await rollback({ changeId });
          setNotice("Rolled back. That rollback is now in the history.");
        }}
      />
    </section>
  );
}

export function PostEditor({
  post,
  onClose,
  onSaved,
}: {
  post: {
    _id: Id<"posts">;
    artist: string;
    caption: string;
    source: string;
    tags: string[];
    rating: (typeof ratings)[number];
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation(api.posts.update);
  const [artist, setArtist] = useState(post.artist);
  const [caption, setCaption] = useState(post.caption);
  const [source, setSource] = useState(post.source);
  const [tags, setTags] = useState(post.tags.join(" "));
  const [rating, setRating] = useState(post.rating);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setError("");
    setPending(true);
    try {
      const changed = await save({
        postId: post._id,
        artist,
        caption,
        source,
        rating,
        tags: tags.split(/[\s,]+/).filter(Boolean),
      });
      if (changed) onSaved();
      onClose();
    } catch (caught) {
      setError(errorText(caught, "Could not save that edit."));
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="edit-caption">Caption</Label>
        <Textarea id="edit-caption" value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-16" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-artist">Artist</Label>
        <Input id="edit-artist" value={artist} onChange={(event) => setArtist(event.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-source">Source URL</Label>
        <Input id="edit-source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="edit-tags">Tags</Label>
        <Input id="edit-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="yuri cute cyberpunk" />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rating">
        {ratings.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-sm capitalize",
              rating === value
                ? "border-accent bg-selection text-foreground"
                : "border-border-strong bg-surface text-muted-foreground",
            )}
          >
            {value}
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-muted-foreground">Saving writes one history entry, so it can be rolled back.</p>
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
