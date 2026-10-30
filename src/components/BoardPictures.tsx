import { useMutation } from "convex/react";
import { Heart } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { errorText } from "@/lib/errors";
import { formatBytes, imageUrl, tagLabel } from "@/lib/images";
import { cn } from "@/lib/utils";

export type ListedPost = {
  _id: Id<"posts">;
  storageKey: string;
  thumbKey: string | null;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  caption: string;
  artist: string;
  tags: string[];
  createdAt: number;
  favorite: boolean;
  rating: "safe" | "questionable" | "explicit";
};

function thumbSrc(post: ListedPost) {
  return imageUrl(post.thumbKey ?? post.storageKey);
}

export function Picture({ post, href }: { post: ListedPost; href: string }) {
  return (
    <a href={href} className="relative block overflow-hidden rounded-xl border border-border bg-surface-soft">
      <img
        src={thumbSrc(post)}
        alt={post.caption || post.artist || "Picture"}
        className="aspect-[4/3] w-full object-cover"
        loading="lazy"
      />
      <SaveButton post={post} />
      {post.rating !== "safe" && <RatingBadge rating={post.rating} />}
    </a>
  );
}

export function PictureRow({ post, href, onTag }: { post: ListedPost; href: string; onTag: (tag: string) => void }) {
  return (
    <article className="flex min-w-0 gap-4 rounded-[0.6rem] border border-border bg-surface p-3 max-[640px]:flex-col">
      <a href={href} className="block w-60 shrink-0 overflow-hidden rounded-md bg-surface-soft max-[640px]:w-full" aria-label="Open post">
        <img src={thumbSrc(post)} alt="" className="h-[10.5rem] w-full object-cover max-[640px]:h-52" loading="lazy" />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="m-0 font-bold break-words">{post.artist || post.caption || "Unknown artist"}</p>
          <SaveButton post={post} inline />
        </div>
        <p className="m-0 text-sm text-muted-foreground">
          <span className={post.rating === "safe" ? "font-bold" : "font-bold text-danger"}>{post.rating.toUpperCase()}</span>
          {" · "}
          {post.width}×{post.height} · {formatBytes(post.byteSize)}
        </p>
        {post.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 16).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTag(tag)}
                className="cursor-pointer rounded-full border border-border-strong bg-surface-soft px-2 py-0.5 text-[0.78rem] hover:bg-selection"
              >
                {tagLabel(tag)}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function SaveButton({ post, inline }: { post: ListedPost; inline?: boolean }) {
  const toggle = useMutation(api.posts.toggleFavorite);
  const session = authClient.useSession();
  const [pending, setPending] = useState<boolean | null>(null);
  const [tracked, setTracked] = useState(post.favorite);
  const [error, setError] = useState("");
  if (tracked !== post.favorite) {
    setTracked(post.favorite);
    setPending(null);
  }
  const saved = pending ?? post.favorite;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save"}
      title={error || "Saved pictures stay on your account"}
      className={cn(
        "cursor-pointer rounded-md border border-border-strong bg-surface px-2 py-1 text-[0.8rem]",
        !inline && "absolute top-2 right-2",
        saved && "border-accent text-accent",
        error && "border-danger text-danger",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!session.data?.user) {
          window.location.hash = "#/auth";
          return;
        }
        setError("");
        setPending(!saved);
        void toggle({ postId: post._id }).catch((caught) => {
          setPending(null);
          const text = errorText(caught, "Could not save that picture.");
          if (text === "Sign in to do that.") {
            window.location.hash = "#/auth";
            return;
          }
          setError(text);
        });
      }}
    >
      <Heart className={cn("mr-1 inline size-3.5", saved && "fill-current")} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}

function RatingBadge({ rating }: { rating: ListedPost["rating"] }) {
  return (
    <span className="absolute bottom-2 left-2 rounded-sm bg-danger px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-[#1c0d0d] uppercase">
      {rating === "explicit" ? "Explicit" : "Sensitive"}
    </span>
  );
}
