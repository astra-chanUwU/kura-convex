import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Component, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Picture, PictureRow, type ListedPost } from "@/components/BoardPictures";
import { ThemedSelect } from "@/components/ThemedSelect";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { EMPTY_FILTER, writeBoard, type BoardView } from "@/lib/board";
import { errorText } from "@/lib/errors";
import { cn } from "@/lib/utils";

const pageSize = 48;

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private — only me" },
  { value: "public", label: "Public — anyone with the link" },
];

const missingList = "That list is private or could not be found.";

type Visibility = "private" | "public";

type ListSummary = {
  _id: Id<"lists">;
  title: string;
  description: string;
  visibility: Visibility;
  itemCount: number;
  updatedAt: number;
  ownerId: string;
  ownerName: string;
  mine: boolean;
};

function pictureCount(count: number) {
  return `${count} ${count === 1 ? "picture" : "pictures"}`;
}

function sameIds(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

function reorderIds(ids: Id<"posts">[], from: number, insertAt: number) {
  if (from < 0 || insertAt < 0 || insertAt > ids.length) return null;
  if (insertAt === from || insertAt === from + 1) return null;
  const next = ids.slice();
  const moved = next[from];
  if (!moved) return null;
  next.splice(from, 1);
  next.splice(insertAt > from ? insertAt - 1 : insertAt, 0, moved);
  return next;
}

function MissingList() {
  return <p className="m-0 text-sm text-muted-foreground">{missingList}</p>;
}

export function ListView({
  id,
  view,
  onView,
}: {
  id: string;
  view: BoardView;
  onView: (view: BoardView) => void;
}) {
  return (
    <ListBoundary key={id}>
      <ListBody id={id} view={view} onView={onView} />
    </ListBoundary>
  );
}

function ListBody({
  id,
  view,
  onView,
}: {
  id: string;
  view: BoardView;
  onView: (view: BoardView) => void;
}) {
  const listId = id as Id<"lists">;
  const list = useQuery(api.lists.get, { listId });
  const page = usePaginatedQuery(api.lists.items, { listId }, { initialNumItems: pageSize });
  if (list === undefined) return <p className="m-0 text-sm text-muted-foreground">Loading…</p>;
  if (list === null) return <MissingList />;
  return <ListDetail list={list} results={page.results} status={page.status} loadMore={page.loadMore} view={view} onView={onView} />;
}

function ListDetail({
  list,
  results,
  status,
  loadMore,
  view,
  onView,
}: {
  list: ListSummary;
  results: ListedPost[];
  status: "LoadingFirstPage" | "LoadingMore" | "CanLoadMore" | "Exhausted";
  loadMore: (numItems: number) => void;
  view: BoardView;
  onView: (view: BoardView) => void;
}) {
  const reorder = useMutation(api.lists.reorder);
  const move = useMutation(api.lists.move);
  const takeOff = useMutation(api.lists.takeOff);
  const sentinel = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const flip = useRef<{ rects: Map<string, DOMRect>; skip: string } | null>(null);
  const draggingRef = useRef<Id<"posts"> | null>(null);
  const attempt = useRef(0);
  const copyTimer = useRef(0);
  const serverKey = results.map((post) => post._id).join("\n");
  const [serverMark, setServerMark] = useState(serverKey);
  const [localOrder, setLocalOrder] = useState<Id<"posts">[] | null>(null);
  const [draggingId, setDraggingId] = useState<Id<"posts"> | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [reorderError, setReorderError] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  if (serverMark !== serverKey) {
    setServerMark(serverKey);
    if (localOrder !== null) setLocalOrder(null);
  }

  const ids = localOrder ?? results.map((post) => post._id);
  const byId = new Map(results.map((post) => [post._id, post]));
  const visible = ids.flatMap((postId) => {
    const post = byId.get(postId);
    return post ? [post] : [];
  });
  const visibleKey = visible.map((post) => post._id).join("\n");
  const rows = view.mode === "rows";
  const reorderable = list.mine && visible.length > 1;

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (status !== "CanLoadMore" || results.length >= pageSize) return;
    loadMore(pageSize);
  }, [status, results.length, loadMore]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || status !== "CanLoadMore" || results.length < pageSize) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore(pageSize);
      },
      { rootMargin: "900px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [status, results.length, loadMore]);

  useLayoutEffect(() => {
    const pending = flip.current;
    flip.current = null;
    if (!pending || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    nodes.current.forEach((element, itemId) => {
      if (itemId === pending.skip) return;
      const previous = pending.rects.get(itemId);
      if (!previous) return;
      const next = element.getBoundingClientRect();
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (dx === 0 && dy === 0) return;
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
        { duration: 190, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      );
    });
  }, [visibleKey]);

  function beginFlip(skip: string) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flip.current = null;
      return;
    }
    const rects = new Map<string, DOMRect>();
    nodes.current.forEach((element, itemId) => {
      rects.set(itemId, element.getBoundingClientRect());
    });
    flip.current = { rects, skip };
  }

  function saveOrder(nextIds: Id<"posts">[], movedId: Id<"posts">) {
    const current = localOrder ?? results.map((post) => post._id);
    if (sameIds(current, nextIds)) return;
    const place = nextIds.indexOf(movedId);
    if (place < 0) return;
    const token = ++attempt.current;
    beginFlip(movedId);
    setLocalOrder(nextIds);
    setReorderError("");
    const listId = list._id;
    const everyItemLoaded = status === "Exhausted" && results.length === list.itemCount;
    const pending = everyItemLoaded
      ? reorder({ listId, postIds: nextIds })
      : move({ listId, postId: movedId, afterId: place > 0 ? (nextIds[place - 1] ?? null) : null });
    void pending.catch(() => {
      if (attempt.current !== token) return;
      setLocalOrder(null);
      setReorderError("Could not reorder.");
    });
  }

  function commit(insertIndex: number) {
    const movedId = draggingRef.current;
    draggingRef.current = null;
    setDraggingId(null);
    setInsertAt(null);
    if (!movedId) return;
    const current = localOrder ?? results.map((post) => post._id);
    const next = reorderIds(current, current.indexOf(movedId), insertIndex);
    if (!next) return;
    saveOrder(next, movedId);
  }

  function step(index: number, delta: -1 | 1) {
    const current = (localOrder ?? results.map((post) => post._id)).slice();
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= current.length) return;
    const moved = current[index];
    if (!moved) return;
    current.splice(index, 1);
    current.splice(nextIndex, 0, moved);
    saveOrder(current, moved);
  }

  function endDrag() {
    draggingRef.current = null;
    setDraggingId(null);
    setInsertAt(null);
  }

  function copyLink() {
    setCopyError("");
    if (!navigator.clipboard) {
      setCopyError("Could not copy the link.");
      return;
    }
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopyError("Could not copy the link."));
  }

  function removePick(postId: Id<"posts">) {
    setRemoveError("");
    void takeOff({ listId: list._id, postId }).catch((caught) => {
      setRemoveError(errorText(caught, "Could not remove that picture."));
    });
  }

  const exhausted = status === "Exhausted";
  const empty = exhausted && results.length === 0 && list.itemCount === 0;
  const someHidden = exhausted && results.length < list.itemCount && list.itemCount > 0 && results.length > 0;
  const hiddenOnly = exhausted && results.length === 0 && list.itemCount > 0;

  return (
    <div className="grid gap-4">
      <header className="grid gap-2">
        <h1 className="m-0 text-2xl font-semibold break-words">{list.title}</h1>
        <p className="m-0 text-sm text-muted-foreground">
          {list.visibility === "public" ? "Public list" : "Private list"}
          {" · "}
          {pictureCount(list.itemCount)}
          {" · by "}
          {list.ownerId ? (
            <a
              href={`#/u/${encodeURIComponent(list.ownerId)}`}
              className="text-foreground no-underline hover:text-accent"
            >
              {list.ownerName}
            </a>
          ) : (
            list.ownerName
          )}
        </p>
        {list.description.trim() !== "" && (
          <p className="m-0 max-w-prose text-sm whitespace-pre-wrap">{list.description}</p>
        )}
        {list.visibility === "public" && (
          <Button type="button" onClick={copyLink}>
            {copied ? "Link copied" : "Copy share link"}
          </Button>
        )}
        {copyError && (
          <p className="m-0 text-sm text-danger" role="alert">
            {copyError}
          </p>
        )}
      </header>
      {list.mine && <ListEditor list={list} />}
      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {reorderable && (
            <p className="m-0 text-sm text-muted-foreground">Drag a picture to reorder it, or use its arrows.</p>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 max-[700px]:ml-0">
            <div className="max-[700px]:hidden">
              <Segment label="View mode">
                <SegmentButton active={view.mode === "grid"} onClick={() => onView({ ...view, mode: "grid" })}>
                  Grid
                </SegmentButton>
                <SegmentButton active={view.mode === "rows"} onClick={() => onView({ ...view, mode: "rows" })}>
                  Rows
                </SegmentButton>
              </Segment>
            </div>
            <div className="max-[700px]:hidden">
              <Segment label="Page width">
                <SegmentButton active={!view.wide} onClick={() => onView({ ...view, wide: false })}>
                  Narrow
                </SegmentButton>
                <SegmentButton active={view.wide} onClick={() => onView({ ...view, wide: true })}>
                  Wide
                </SegmentButton>
              </Segment>
            </div>
          </div>
        </div>
      )}
      {reorderError && (
        <p className="m-0 text-sm text-danger" role="alert">
          {reorderError}
        </p>
      )}
      {removeError && (
        <p className="m-0 text-sm text-danger" role="alert">
          {removeError}
        </p>
      )}
      {empty && (
        <p className="m-0 py-16 text-center text-sm text-muted-foreground">
          Nothing here yet. Use “+ List” on any picture to add it.
        </p>
      )}
      {hiddenOnly && <p className="m-0 text-sm text-muted-foreground">Some pictures in this list are hidden.</p>}
      {visible.length > 0 && (
        <div
          className={
            rows
              ? "grid gap-3 pt-4"
              : "grid grid-cols-2 gap-2.5 pt-4 min-[701px]:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] min-[701px]:gap-4 min-[1601px]:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]"
          }
          onDragOver={(event) => {
            if (!reorderable) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
            if (event.target === event.currentTarget) setInsertAt(visible.length);
          }}
          onDrop={(event) => {
            if (!reorderable) return;
            event.preventDefault();
            if (event.target !== event.currentTarget) return;
            commit(visible.length);
          }}
        >
          {visible.map((post, index) => (
            <PickTile
              key={post._id}
              post={post}
              index={index}
              rows={rows}
              listId={list._id}
              mine={list.mine}
              reorderable={reorderable}
              dragging={draggingId === post._id}
              atEnd={index === visible.length - 1}
              showBefore={insertAt === index}
              showAfter={insertAt === visible.length && index === visible.length - 1}
              onInsert={setInsertAt}
              onCommit={commit}
              onStep={(delta) => step(index, delta)}
              onRemove={() => removePick(post._id)}
              onDragId={(postId) => {
                draggingRef.current = postId;
                setDraggingId(postId);
              }}
              onDragEnd={endDrag}
              remember={(node) => {
                if (node) nodes.current.set(post._id, node);
                else nodes.current.delete(post._id);
              }}
            />
          ))}
        </div>
      )}
      <div ref={sentinel} className="h-8" />
      {status === "LoadingMore" && results.length > 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Loading more…</p>
      )}
      {someHidden && <p className="m-0 text-sm text-muted-foreground">Some pictures in this list are hidden.</p>}
    </div>
  );
}

function ListEditor({ list }: { list: ListSummary }) {
  const update = useMutation(api.lists.update);
  const remove = useMutation(api.lists.remove);
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description);
  const [visibility, setVisibility] = useState<Visibility>(list.visibility);
  const [seen, setSeen] = useState({
    title: list.title,
    description: list.description,
    visibility: list.visibility,
    updatedAt: list.updatedAt,
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (seen.updatedAt !== list.updatedAt) {
    const edited = title !== seen.title || description !== seen.description || visibility !== seen.visibility;
    if (!edited) {
      setTitle(list.title);
      setDescription(list.description);
      setVisibility(list.visibility);
    }
    setSeen({
      title: edited ? seen.title : list.title,
      description: edited ? seen.description : list.description,
      visibility: edited ? seen.visibility : list.visibility,
      updatedAt: list.updatedAt,
    });
  }

  const dirty = title !== list.title || description !== list.description || visibility !== list.visibility;

  return (
    <form
      className="grid max-w-[32rem] gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        void update({ listId: list._id, title, description, visibility })
          .then((saved) => {
            setTitle(saved.title);
            setDescription(saved.description);
            setVisibility(saved.visibility);
            setSeen({
              title: saved.title,
              description: saved.description,
              visibility: saved.visibility,
              updatedAt: saved.updatedAt,
            });
          })
          .catch((caught) => setError(errorText(caught, "Could not save this list.")))
          .finally(() => setPending(false));
      }}
    >
      <Input
        required
        maxLength={80}
        value={title}
        aria-label="List title"
        onChange={(event) => setTitle(event.target.value)}
      />
      <Textarea
        maxLength={300}
        value={description}
        aria-label="List description"
        className="min-h-20"
        onChange={(event) => setDescription(event.target.value)}
      />
      <ThemedSelect
        label="Visibility"
        full
        value={visibility}
        options={VISIBILITY_OPTIONS}
        onChange={(value) => setVisibility(value === "public" ? "public" : "private")}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!dirty || pending}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || pending}
          onClick={() => {
            setTitle(list.title);
            setDescription(list.description);
            setVisibility(list.visibility);
            setSeen({
              title: list.title,
              description: list.description,
              visibility: list.visibility,
              updatedAt: list.updatedAt,
            });
            setError("");
          }}
        >
          Undo
        </Button>
        <Button type="button" variant="outline" className="border-danger text-danger" onClick={() => setAskDelete(true)}>
          Delete
        </Button>
      </div>
      {error && (
        <p className="m-0 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <Dialog
        open={askDelete}
        onClose={() => {
          if (!deleting) setAskDelete(false);
        }}
        title="Delete this list?"
        description="Delete this list? The pictures stay on the board."
        className="max-w-sm"
      >
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={deleting} onClick={() => setAskDelete(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-danger text-danger"
            disabled={deleting}
            onClick={() => {
              setDeleting(true);
              setError("");
              void remove({ listId: list._id })
                .then(() => {
                  window.location.hash = "#/lists";
                })
                .catch((caught) => {
                  setDeleting(false);
                  setAskDelete(false);
                  setError(errorText(caught, "Could not delete this list."));
                });
            }}
          >
            Delete list
          </Button>
        </div>
      </Dialog>
    </form>
  );
}

function PickTile({
  post,
  index,
  rows,
  listId,
  mine,
  reorderable,
  dragging,
  atEnd,
  showBefore,
  showAfter,
  onInsert,
  onCommit,
  onStep,
  onRemove,
  onDragId,
  onDragEnd,
  remember,
}: {
  post: ListedPost;
  index: number;
  rows: boolean;
  listId: Id<"lists">;
  mine: boolean;
  reorderable: boolean;
  dragging: boolean;
  atEnd: boolean;
  showBefore: boolean;
  showAfter: boolean;
  onInsert: (index: number) => void;
  onCommit: (index: number) => void;
  onStep: (delta: -1 | 1) => void;
  onRemove: () => void;
  onDragId: (postId: Id<"posts">) => void;
  onDragEnd: () => void;
  remember: (node: HTMLDivElement | null) => void;
}) {
  const href = `#/posts/${encodeURIComponent(post._id)}?list=${encodeURIComponent(listId)}`;

  function slot(event: DragEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const before = rows
      ? event.clientY < rect.top + rect.height / 2
      : event.clientX < rect.left + rect.width / 2;
    return before ? index : index + 1;
  }

  return (
    <div
      ref={remember}
      draggable={reorderable}
      className={cn(
        "relative min-w-0 [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none]",
        dragging && "opacity-35",
      )}
      onDragStart={(event) => {
        if (!reorderable) return;
        const target = event.target;
        if (target instanceof Element && target.closest("button")) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.dataTransfer.setData("text/plain", post._id);
        event.dataTransfer.effectAllowed = "move";
        onDragId(post._id);
      }}
      onDragOver={(event) => {
        if (!reorderable) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        onInsert(slot(event));
      }}
      onDrop={(event) => {
        if (!reorderable) return;
        event.preventDefault();
        event.stopPropagation();
        onCommit(slot(event));
      }}
      onDragEnd={onDragEnd}
    >
      {showBefore && <InsertionBar rows={rows} edge="before" />}
      {showAfter && <InsertionBar rows={rows} edge="after" />}
      {rows ? (
        <PictureRow
          post={post}
          href={href}
          onTag={(tag) => writeBoard(false, { ...EMPTY_FILTER, tags: [tag] })}
        />
      ) : (
        <Picture post={post} href={href} />
      )}
      {mine && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          draggable={false}
          aria-label={`Remove pick ${index + 1}`}
          title="Remove from this list"
          className="absolute top-2 left-2 z-10 size-7 border-danger bg-surface text-danger"
          onMouseDown={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
        >
          ×
        </Button>
      )}
      {reorderable && (
        <div className="absolute bottom-2 left-2 z-10 flex gap-1">
          <ArrowButton
            label={rows ? "Move up" : "Move earlier"}
            glyph={rows ? "↑" : "←"}
            disabled={index === 0}
            onClick={() => onStep(-1)}
          />
          <ArrowButton
            label={rows ? "Move down" : "Move later"}
            glyph={rows ? "↓" : "→"}
            disabled={atEnd}
            onClick={() => onStep(1)}
          />
        </div>
      )}
      <span
        aria-label={`Pick number ${index + 1}`}
        className="pointer-events-none absolute right-2 bottom-2 z-10 rounded-full border border-border bg-surface px-2 py-0.5 text-[0.8rem] font-bold text-foreground tabular-nums"
      >
        {index + 1}
      </span>
    </div>
  );
}

function ArrowButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      draggable={false}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="size-7 bg-surface"
      onMouseDown={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {glyph}
    </Button>
  );
}

function InsertionBar({ rows, edge }: { rows: boolean; edge: "before" | "after" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 rounded bg-accent",
        rows
          ? edge === "before"
            ? "top-0 right-0 left-0 h-[3px]"
            : "right-0 bottom-0 left-0 h-[3px]"
          : edge === "before"
            ? "top-0 bottom-0 left-0 w-[3px]"
            : "top-0 right-0 bottom-0 w-[3px]",
      )}
    />
  );
}

function Segment({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-[0.45rem] border border-border-strong">
      {children}
    </div>
  );
}

function SegmentButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer border-r border-border bg-surface px-2 py-1.5 text-[0.8rem] text-muted-foreground last:border-r-0",
        active && "bg-surface-soft text-foreground",
      )}
    >
      {children}
    </button>
  );
}

class ListBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <MissingList /> : this.props.children;
  }
}
