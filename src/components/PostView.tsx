import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Heart, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { formatBytes, imageUrl, tagLabel } from "@/lib/images";
import { cn } from "@/lib/utils";

export function PostView({ id, back }: { id: string; back: string }) {
  const post = useQuery(api.posts.get, { id });
  const toggle = useMutation(api.posts.toggleFavorite);
  const remove = useMutation(api.posts.remove);

  if (post === undefined) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!post) return <p className="p-8">That picture is not on the board.</p>;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)]">
      <div className="grid min-w-0 gap-4">
        <a href={back} className="inline-flex w-fit items-center gap-2 text-[0.9rem] no-underline hover:text-accent">
          <ArrowLeft className="size-4" />
          Board
        </a>
        <div className="relative">
          <img
            src={imageUrl(post.storageKey)}
            alt={post.caption || "Picture"}
            className="max-h-[75vh] w-full rounded-xl bg-surface-soft object-contain"
          />
          {post.rating !== "safe" && (
            <span className="absolute bottom-3 left-3 rounded-sm bg-danger px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-[#1c0d0d] uppercase">
              {post.rating === "explicit" ? "Explicit" : "Sensitive"}
            </span>
          )}
        </div>
      </div>
      <aside className="grid content-start gap-3 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
        <h1 className="m-0 text-[1.35rem] font-semibold break-words">{post.caption || "Untitled"}</h1>
        <p className="m-0 text-sm text-muted-foreground">
          {post.width}×{post.height} · {formatBytes(post.byteSize)}
          {post.safebooruId ? " · Safebooru" : ""}
        </p>
        {post.artist && <Detail label="Artist">{post.artist}</Detail>}
        {post.source && (
          <Detail label="Source">
            <a href={post.source} className="text-accent break-all" target="_blank" rel="noreferrer">
              {post.source}
            </a>
          </Detail>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={post.favorite ? "accent" : "outline"}
            onClick={() => {
              void toggle({ postId: post._id }).catch(() => {
                window.location.hash = "#/auth";
              });
            }}
          >
            <Heart className={cn("size-4", post.favorite && "fill-current")} />
            {post.favorite ? "Saved" : "Save"}
          </Button>
          {post.mine && (
            <Button
              variant="outline"
              onClick={() => {
                if (!window.confirm("Remove this picture from the board?")) return;
                void remove({ postId: post._id }).then(() => {
                  window.location.hash = back;
                });
              }}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          )}
        </div>
        {post.tags.length > 0 && (
          <Detail label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <a
                  key={tag}
                  href={`#/?tags=${encodeURIComponent(tag)}`}
                  className="inline-flex rounded-full border border-border-strong bg-surface-soft px-2 py-0.5 text-[0.8rem] text-foreground no-underline hover:border-accent"
                >
                  {tagLabel(tag)}
                </a>
              ))}
            </div>
          </Detail>
        )}
      </aside>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 text-sm">
      <span className="w-14 shrink-0 pt-0.5 text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
