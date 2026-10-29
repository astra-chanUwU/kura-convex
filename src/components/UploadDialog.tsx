import { useAction } from "convex/react";
import { ImagePlus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const prepare = useAction(api.storage.prepareUpload);
  const publish = useAction(api.storage.publish);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState<"safe" | "questionable" | "explicit">("safe");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a picture first.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const size = await measure(file);
      const prepared = await prepare({ contentType: file.type, byteSize: file.size });
      const uploaded = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error("The picture did not land in storage.");
      const id = await publish({
        storageKey: prepared.storageKey,
        contentType: file.type,
        byteSize: file.size,
        width: size.width,
        height: size.height,
        originalName: file.name,
        artist,
        source,
        caption,
        rating,
        tags: tags.split(/[\s,]+/).filter(Boolean),
      });
      onClose();
      window.location.hash = `#/posts/${id}`;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <form
        onSubmit={(event) => void submit(event)}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold">Add a picture</h2>
            <p className="mt-1 mb-0 text-sm text-muted-foreground">JPEG, PNG, WebP, or GIF, under 20 MB.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-surface-soft hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-soft px-4 py-8 text-center text-sm text-muted-foreground hover:border-accent">
          <ImagePlus className="mb-2 size-5" />
          {file ? file.name : "Drop a picture here, or browse"}
          <input
            type="file"
            accept={TYPES.join(",")}
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="mt-4 grid gap-1.5">
          <Label htmlFor="caption">Caption</Label>
          <Textarea id="caption" value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-16" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="artist">Artist</Label>
            <Input id="artist" value={artist} onChange={(event) => setArtist(event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="source">Source URL</Label>
            <Input id="source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://" />
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="yuri cute cyberpunk" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["safe", "questionable", "explicit"] as const).map((value) => (
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
        {error && <p className="mt-3 mb-0 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={pending}>
            {pending ? "Uploading…" : "Post"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function measure(file: File) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}
