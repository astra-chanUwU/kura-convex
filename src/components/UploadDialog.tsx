import { useAction } from "convex/react";
import { ImagePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type UploadPayload = {
  storageKey: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  originalName: string;
  artist: string;
  source: string;
  caption: string;
  rating: "safe" | "questionable" | "explicit";
  tags: string[];
  sha256: string;
};

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const prepare = useAction(api.storage.prepareUpload);
  const publish = useAction(api.storage.publish);
  const discardUpload = useAction(api.storage.discardUpload);
  const keepAsChild = useAction(api.storage.keepAsChild);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState<"safe" | "questionable" | "explicit">("safe");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [choice, setChoice] = useState<{ duplicateOf: Id<"posts">; payload: UploadPayload } | null>(null);
  const spareKey = useRef<string | null>(null);
  const busy = useRef(false);
  const done = useRef(false);
  const closed = useRef(false);

  function finish(hash: string) {
    done.current = true;
    spareKey.current = null;
    onClose();
    window.location.hash = hash;
  }

  function requestClose() {
    if (done.current) return;
    const storageKey = spareKey.current;
    if (!storageKey) {
      closed.current = true;
      onClose();
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    void discardUpload({ storageKey })
      .then(() => {
        done.current = true;
        spareKey.current = null;
        onClose();
      })
      .catch((caught) => {
        busy.current = false;
        setPending(false);
        setError(errorText(caught, "Could not discard that upload."));
      });
  }

  async function openExisting() {
    if (!choice || done.current || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await discardUpload({ storageKey: choice.payload.storageKey });
      finish(`#/posts/${choice.duplicateOf}`);
    } catch (caught) {
      busy.current = false;
      setPending(false);
      setError(errorText(caught, "Could not open that picture."));
    }
  }

  async function postAsChild() {
    if (!choice || done.current || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const id = await keepAsChild({ ...choice.payload, parentId: choice.duplicateOf });
      finish(`#/posts/${id}`);
    } catch (caught) {
      busy.current = false;
      setPending(false);
      setError(errorText(caught, "Could not post that picture as a child."));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || busy.current) {
      if (!file) setError("Choose a picture first.");
      return;
    }
    setError("");
    setPending(true);
    busy.current = true;
    try {
      const sha256 = await fileSha256(file);
      const size = await measure(file);
      const prepared = await prepare({ contentType: file.type, byteSize: file.size });
      const uploaded = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error("The picture did not land in storage.");
      const payload: UploadPayload = {
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
        sha256,
      };
      const published = await publish(payload);
      if (closed.current) {
        busy.current = false;
        if (published.duplicateOf != null) void discardUpload({ storageKey: payload.storageKey }).catch(() => undefined);
        else window.location.hash = `#/posts/${published.postId}`;
        return;
      }
      if (published.duplicateOf == null) {
        finish(`#/posts/${published.postId}`);
        return;
      }
      spareKey.current = payload.storageKey;
      setChoice({ duplicateOf: published.duplicateOf, payload });
      busy.current = false;
      setPending(false);
    } catch (caught) {
      busy.current = false;
      if (closed.current) return;
      setError(errorText(caught, "Upload failed."));
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={requestClose}
      title="Add a picture"
      description={choice ? undefined : "JPEG, PNG, WebP, or GIF, under 20 MB. A smaller copy is added for the board."}
      className="max-w-lg"
    >
      {choice ? (
        <div className="mt-4 grid gap-4">
          <p className="m-0 text-sm">This picture is already on the board.</p>
          {error && <p className="m-0 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={() => void openExisting()}>
              Open it
            </Button>
            <Button variant="accent" disabled={pending} onClick={() => void postAsChild()}>
              Post as a child
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-border-strong bg-surface-soft px-4 py-8 text-center text-sm text-foreground hover:border-accent">
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
            <Button variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? "Uploading…" : "Post"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

async function fileSha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
