import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatBytes, imageUrl, tagLabel } from "@/lib/images";

export function PostView({ id }: { id: string }) {
  const post = useQuery(api.posts.get, { id });
  if (post === undefined) return <p className="p-8 text-muted-foreground">Loading…</p>;
  if (!post) return <p className="p-8">That picture is not on the board.</p>;
  return (
    <div className="grid gap-6 px-4 pt-14 pb-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <img
        src={imageUrl(post.storageKey)}
        alt={post.caption || "Picture"}
        className="max-h-[80vh] w-full rounded-xl object-contain"
      />
      <aside>
        <a href="#/" className="text-sm text-muted-foreground">
          Back to the board
        </a>
        <h1 className="mt-3 text-2xl font-semibold">{post.caption || "Untitled"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {post.width}×{post.height} · {formatBytes(post.byteSize)}
          {post.safebooruId ? " · Safebooru" : ""}
        </p>
        {post.source && (
          <a href={post.source} className="mt-3 block text-sm text-[#e48ab8]" target="_blank" rel="noreferrer">
            Source
          </a>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <a key={tag} href={`#/?q=${encodeURIComponent(tag)}`} className="rounded-full border border-foreground/15 px-3 py-1 text-sm text-muted-foreground">
              {tagLabel(tag)}
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}
