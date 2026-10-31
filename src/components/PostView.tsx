import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Heart, Pencil, Trash2 } from "lucide-react";
import { Component, type ReactNode, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { PostEditor } from "@/components/PostHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "../../convex/_generated/api";
import { postHash, type BoardFilter } from "@/lib/board";
import { errorText } from "@/lib/errors";
import { formatBytes, imageUrl, tagLabel } from "@/lib/images";
import { cn } from "@/lib/utils";
import { canCurate } from "../../shared/roles";
import { normalizeTag, tagCategories, type TagCategory } from "../../shared/tags";

function asCategory(value: string): TagCategory {
  for (const category of tagCategories) {
    if (category === value) return category;
  }
  return "general";
}

function categoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function PostView({
  id,
  back,
  filter,
  saved,
  authorId,
}: {
  id: string;
  back: string;
  filter: BoardFilter;
  saved: boolean;
  authorId?: string;
}) {
  return (
    <PostErrorBoundary key={id} fallback={<p className="p-8">That picture is not on the board.</p>}>
      <PostBody id={id as Id<"posts">} back={back} filter={filter} saved={saved} authorId={authorId} />
    </PostErrorBoundary>
  );
}

function PostBody({
  id,
  back,
  filter,
  saved,
  authorId,
}: {
  id: Id<"posts">;
  back: string;
  filter: BoardFilter;
  saved: boolean;
  authorId?: string;
}) {
  const post = useQuery(api.posts.get, { id });
  const prefs = useQuery(api.preferences.get);
  const relations = useQuery(api.posts.relations, { id });
  const tagLookup = useQuery(api.tags.lookup, post && post.tags.length > 0 ? { tags: post.tags } : "skip");
  const toggle = useMutation(api.posts.toggleFavorite);
  const remove = useMutation(api.posts.remove);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [fitWindow, setFitWindow] = useState(false);

  if (post === undefined) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!post) return <p className="p-8">That picture is not on the board.</p>;
  const artistTag = normalizeTag(post.artist);
  const categories = new Map((tagLookup ?? []).map((row) => [row.tag, row.category]));
  const curator = canCurate(prefs?.role);

  return (
    <>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)]">
      <div className="grid min-w-0 gap-4">
        <a href={back} className="inline-flex w-fit items-center gap-2 text-[0.9rem] no-underline hover:text-accent">
          <ArrowLeft className="size-4" />
          {authorId ? "Back" : "Board"}
        </a>
        <PostErrorBoundary key={id} fallback={null}>
          <PostNeighbors id={id} filter={filter} saved={saved} authorId={authorId} />
        </PostErrorBoundary>
        {post.removed && (
          <p className="m-0 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            This picture is off the board. Roll back the removal in the history below to bring it back.
          </p>
        )}
        <div className="relative">
          <button
            type="button"
            aria-pressed={fitWindow}
            aria-label={fitWindow ? "Show the picture in the page" : "Fit the picture to the window"}
            onClick={() => setFitWindow((current) => !current)}
            className={cn("block w-full border-0 bg-transparent p-0", fitWindow ? "cursor-zoom-out" : "cursor-zoom-in")}
          >
            <img
              src={imageUrl(post.storageKey)}
              alt={post.caption || "Picture"}
              className={cn(
                "w-full rounded-xl bg-surface-soft object-contain",
                fitWindow ? "h-dvh" : "max-h-[75vh]",
              )}
            />
          </button>
          {post.rating !== "safe" && (
            <span className="pointer-events-none absolute bottom-3 left-3 rounded-sm bg-danger px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-[#1c0d0d] uppercase">
              {post.rating === "explicit" ? "Explicit" : "Sensitive"}
            </span>
          )}
        </div>
      </div>
      <aside className="grid content-start gap-3 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
        <h1 className="m-0 text-[1.35rem] font-semibold break-words">{post.caption || "Untitled"}</h1>
        {post.authorName && (
          <p className="m-0 text-sm text-muted-foreground">
            Posted by{" "}
            <a href={`#/u/${encodeURIComponent(post.authorId)}`} className="text-foreground no-underline hover:text-accent">
              {post.authorName}
            </a>
          </p>
        )}
        <p className="m-0 text-sm text-muted-foreground">
          {post.width}×{post.height} · {formatBytes(post.byteSize)} · {post.favoriteCount} saves
        </p>
        {!editing && post.artist && (
          <Detail label="Artist">
            {artistTag ? (
              <a href={`#/?tags=${encodeURIComponent(artistTag)}`} className="text-accent break-words">
                {post.artist}
              </a>
            ) : (
              post.artist
            )}
          </Detail>
        )}
        {!editing && post.source && (
          <Detail label="Source">
            <a href={post.source} className="text-accent break-all" target="_blank" rel="noreferrer">
              {post.source}
            </a>
          </Detail>
        )}
        {!editing && post.sourceBoard && post.sourceId != null && (
          <Detail label="Board">
            {post.sourceBoard} {post.sourceId}
          </Detail>
        )}
        {relations?.parent && (
          <Detail label="Parent">
            <a href={`#/posts/${relations.parent._id}`} className="text-accent break-words">
              {relations.parent.caption || "Untitled"}
            </a>
          </Detail>
        )}
        {relations && relations.children.length > 0 && (
          <Detail label="Children">
            <div className="grid gap-1">
              {relations.children.map((child) => (
                <a key={child._id} href={`#/posts/${child._id}`} className="text-accent break-words">
                  {child.caption || "Untitled"}
                </a>
              ))}
            </div>
          </Detail>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={post.favorite ? "accent" : "outline"}
            onClick={() => {
              setError("");
              void toggle({ postId: post._id }).catch((caught) => {
                const text = errorText(caught, "Could not save that picture.");
                if (text === "Sign in to do that.") {
                  window.location.hash = "#/auth";
                  return;
                }
                setError(text);
              });
            }}
          >
            <Heart className={cn("size-4", post.favorite && "fill-current")} />
            {post.favorite ? "Saved" : "Save"}
          </Button>
          {post.canEdit && !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          {post.mine && post.canRemove && (
            <Button
              variant="outline"
              onClick={() => {
                if (!window.confirm("Remove this picture from the board? A moderator can roll it back from history.")) return;
                setError("");
                void remove({ postId: post._id })
                  .then(() => {
                    window.location.hash = back;
                  })
                  .catch((caught) => setError(errorText(caught, "Could not remove that picture.")));
              }}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          )}
        </div>
        {savedNote && !editing && <p className="m-0 text-sm text-success">{savedNote}</p>}
        {error && <p className="m-0 text-sm text-danger">{error}</p>}
        {editing ? (
          <PostEditor
            post={post}
            onClose={() => setEditing(false)}
            onSaved={() => setSavedNote("Saved to the history below.")}
          />
        ) : (
          post.tags.length > 0 && (
            <Detail label="Tags">
              <div className="flex flex-wrap items-start gap-2">
                {post.tags.map((tag) => (
                  <PostTag key={tag} tag={tag} category={categories.get(tag) ?? "general"} curator={curator} />
                ))}
              </div>
            </Detail>
          )
        )}
      </aside>
    </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 text-sm">
      <span className="w-20 shrink-0 pt-0.5 text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function PostTag({ tag, category, curator }: { tag: string; category: string; curator: boolean }) {
  const setCategory = useMutation(api.tags.setCategory);
  const setAlias = useMutation(api.tags.setAlias);
  const [alias, setAliasText] = useState("");
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<TagCategory | null>(null);
  const current = asCategory(category);
  if (chosen !== null && chosen === current) setChosen(null);
  const value = chosen ?? current;
  const shown = category !== "general" ? category : "";

  function saveAlias() {
    setError("");
    void setAlias({ alias: tag, canonical: alias }).catch((caught) => {
      setError(errorText(caught, "Could not set that alias."));
    });
  }

  return (
    <div className="grid gap-1">
      <a
        href={`#/?tags=${encodeURIComponent(tag)}`}
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-strong bg-surface-soft px-2 py-0.5 text-[0.8rem] text-foreground no-underline hover:border-accent"
      >
        {tagLabel(tag)}
        {shown !== "" && <span className="text-muted-foreground capitalize">{shown}</span>}
      </a>
      {curator && (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label={`Category for ${tagLabel(tag)}`}
            value={value}
            onChange={(event) => {
              const next = asCategory(event.target.value);
              if (next === value) return;
              setChosen(next);
              setError("");
              void setCategory({ tag, category: next }).catch((caught) => {
                setChosen(null);
                setError(errorText(caught, "Could not set that category."));
              });
            }}
            className="cursor-pointer rounded-[0.4rem] border border-border-strong bg-surface px-2 py-[0.4rem] text-[0.85rem] text-foreground"
          >
            {tagCategories.map((option) => (
              <option key={option} value={option}>
                {categoryLabel(option)}
              </option>
            ))}
          </select>
          <Input
            value={alias}
            onChange={(event) => setAliasText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveAlias();
              }
            }}
            placeholder="Alias of"
            aria-label={`Alias of ${tagLabel(tag)}`}
            className="w-36 py-[0.4rem] text-[0.8rem]"
          />
          <Button variant="outline" className="px-2 py-1 text-[0.8rem]" onClick={saveAlias}>
            Set
          </Button>
        </div>
      )}
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
    </div>
  );
}

function PostNeighbors({
  id,
  filter,
  saved,
  authorId,
}: {
  id: Id<"posts">;
  filter: BoardFilter;
  saved: boolean;
  authorId?: string;
}) {
  const neighbors = useQuery(api.posts.neighbors, {
    id,
    ...(filter.q ? { q: filter.q } : {}),
    ...(filter.tags.length > 0 ? { tags: filter.tags } : {}),
    ...(filter.exclude.length > 0 ? { exclude: filter.exclude } : {}),
    sort: filter.sort,
    saved,
    ...(filter.rating === "any" ? {} : { rating: filter.rating }),
    ...(authorId ? { authorId } : {}),
  });
  if (!neighbors?.prev && !neighbors?.next) return null;
  return (
    <div className="flex items-center justify-between gap-4 text-[0.9rem]">
      {neighbors.prev ? (
        <a href={postHash(neighbors.prev, filter, saved, authorId)} className="no-underline hover:text-accent">
          Previous
        </a>
      ) : (
        <span />
      )}
      {neighbors.next ? (
        <a href={postHash(neighbors.next, filter, saved, authorId)} className="no-underline hover:text-accent">
          Next
        </a>
      ) : null}
    </div>
  );
}

class PostErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
