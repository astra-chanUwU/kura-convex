import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { imageUrl, tagLabel } from "@/lib/images";

type Post = {
  _id: string;
  storageKey: string;
  width: number;
  height: number;
  caption: string;
  artist: string;
  tags: string[];
  createdAt: number;
  rating: "safe" | "questionable" | "explicit";
};

export function Board({ query }: { query: string }) {
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<Post[]>([]);
  const page = useQuery(api.posts.list, {
    q: query || undefined,
    before: cursor,
  });

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
  }, [query]);

  useEffect(() => {
    if (!page) return;
    setItems((current) => {
      if (cursor === undefined) return page;
      const seen = new Set(current.map((post) => post._id));
      return [...current, ...page.filter((post) => !seen.has(post._id))];
    });
  }, [page, cursor]);

  if (page === undefined && items.length === 0) {
    return <p className="grid h-full place-items-center text-muted-foreground">Loading the board…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">The board is quiet</h2>
          <p className="mt-3 text-muted-foreground">
            Safebooru seeds land here: yuri, cute, anime girl, cyberpunk.
          </p>
        </div>
      </div>
    );
  }

  const hasMore = (page?.length ?? 0) >= 48;

  return (
    <div className="px-4 pt-14 pb-10">
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 2xl:columns-5">
        {items.map((post) => (
          <a
            key={post._id}
            href={`#/posts/${post._id}`}
            className="mb-3 block break-inside-avoid overflow-hidden rounded-lg bg-black/20"
          >
            <img
              src={imageUrl(post.storageKey)}
              alt={post.caption || post.artist || "Picture"}
              className="w-full"
              loading="lazy"
            />
          </a>
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="rounded-full bg-foreground/10 px-5 py-2 text-sm"
            onClick={() => {
              const last = items.at(-1);
              if (last) setCursor(last.createdAt);
            }}
          >
            More pictures
          </button>
        </div>
      )}
    </div>
  );
}

export function TagSearch({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (value: string) => void;
}) {
  const tags = useQuery(api.posts.tags) ?? [];
  const featured = ["yuri", "cute", "1girl", "cyberpunk"];
  const shown = [...featured, ...tags.map((tag) => tag.tag).filter((tag) => !featured.includes(tag))].slice(
    0,
    16,
  );
  return (
    <div className="mt-4">
      <label className="flex items-center gap-2 border-b border-foreground/15 px-1 text-muted-foreground">
        <Search className="size-4" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value.trim().toLowerCase())}
          placeholder="Search your pictures…"
          className="h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          aria-label="Search your pictures"
        />
      </label>
      <div className="mt-3 flex flex-col">
        {shown.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onQuery(query === tag ? "" : tag)}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${
              query === tag ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"
            }`}
          >
            {tagLabel(tag)}
          </button>
        ))}
      </div>
    </div>
  );
}
