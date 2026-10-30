import { usePaginatedQuery, useQuery } from "convex/react";
import { ArrowUp, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { Picture, PictureRow } from "@/components/BoardPictures";
import { Button } from "@/components/ui/button";
import {
  writeBoard,
  type BoardFilter,
  type BoardView,
  filterActive,
  normalizeTagToken,
  postHash,
  sameTags,
  splitTagInput,
} from "@/lib/board";
import { tagLabel } from "@/lib/images";
import { cn } from "@/lib/utils";

const pageSize = 48;

export function Board({
  filter,
  saved,
  defaults,
  view,
  onView,
  onUpload,
}: {
  filter: BoardFilter;
  saved: boolean;
  defaults: { tags: string[]; exclude: string[] } | null;
  view: BoardView;
  onView: (view: BoardView) => void;
  onUpload: () => void;
}) {
  const [text, setText] = useState(filter.q);
  const [stagedTags, setStagedTags] = useState(filter.tags);
  const [stagedExclude, setStagedExclude] = useState(filter.exclude);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const listArgs = {
    q: filter.q || undefined,
    tags: filter.tags.length > 0 ? filter.tags : undefined,
    exclude: filter.exclude.length > 0 ? filter.exclude : undefined,
    sort: filter.sort,
    saved,
  };
  const { results: items, status, loadMore } = usePaginatedQuery(api.posts.list, listArgs, { initialNumItems: pageSize });
  const suggestQuery = text.trim().replace(/^-/, "");
  const suggestions = useQuery(api.posts.suggest, focused && suggestQuery ? { q: suggestQuery } : "skip") ?? [];
  const offered = suggestions.filter((item) => !stagedTags.includes(item.tag) && !stagedExclude.includes(item.tag));
  const relevant = filter.q !== "" && filter.tags.length === 0;

  useEffect(() => {
    if (status !== "CanLoadMore" || items.length >= pageSize) return;
    loadMore(pageSize);
  }, [status, items.length, loadMore]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || status !== "CanLoadMore" || items.length < pageSize) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore(pageSize);
      },
      { rootMargin: "900px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [status, items.length, loadMore]);

  const viewportTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of items) {
      for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 16)
      .map(([tag, count]) => ({ tag, count }));
  }, [items]);

  const dirty =
    text.trim() !== filter.q || !sameTags(stagedTags, filter.tags) || !sameTags(stagedExclude, filter.exclude);
  const differsFromDefaults =
    defaults !== null &&
    (defaults.tags.length > 0 || defaults.exclude.length > 0) &&
    (!sameTags(stagedTags, defaults.tags) || !sameTags(stagedExclude, defaults.exclude) || text.trim() !== "");

  function commit(next: BoardFilter, scroll = false) {
    writeBoard(saved, next);
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyText() {
    commit({ ...filter, tags: stagedTags, exclude: stagedExclude, q: text.trim(), cleared: false }, true);
  }

  function addTagsFromText(value: string) {
    const parsed = splitTagInput(value);
    if (parsed.include.length === 0 && parsed.exclude.length === 0) {
      applyText();
      return;
    }
    const exclude = [...new Set([...stagedExclude.filter((tag) => !parsed.include.includes(tag)), ...parsed.exclude])];
    const tags = [...new Set([...stagedTags.filter((tag) => !exclude.includes(tag)), ...parsed.include])];
    setText("");
    commit({ ...filter, tags, exclude, q: filter.q, cleared: false });
  }

  function addInclude(tag: string) {
    const normalized = normalizeTagToken(tag);
    if (!normalized) return;
    setText("");
    commit({
      ...filter,
      tags: stagedTags.includes(normalized) ? stagedTags : [...stagedTags, normalized],
      exclude: stagedExclude.filter((item) => item !== normalized),
      cleared: false,
    });
  }

  function addExclude(tag: string) {
    const normalized = normalizeTagToken(tag);
    if (!normalized) return;
    setText("");
    commit({
      ...filter,
      tags: stagedTags.filter((item) => item !== normalized),
      exclude: stagedExclude.includes(normalized) ? stagedExclude : [...stagedExclude, normalized],
      cleared: false,
    });
  }

  const loading = status === "LoadingFirstPage" || (items.length === 0 && status !== "Exhausted");
  const empty = status === "Exhausted" && items.length === 0;

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-30 -mx-[var(--page-x)] bg-background px-[var(--page-x)]">
        <div className="flex flex-wrap items-center gap-2 py-3.5">
          <div className="relative w-full max-w-md max-[900px]:max-w-none max-[900px]:basis-full">
            <input
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setHighlight(0);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && offered.length > 0) {
                  event.preventDefault();
                  setHighlight((index) => (index + 1) % offered.length);
                } else if (event.key === "ArrowUp" && offered.length > 0) {
                  event.preventDefault();
                  setHighlight((index) => (index - 1 + offered.length) % offered.length);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (focused && offered[highlight]) addInclude(offered[highlight].tag);
                  else addTagsFromText(text);
                } else if (event.key === "Escape") {
                  setFocused(false);
                }
              }}
              placeholder={stagedTags.length > 0 || stagedExclude.length > 0 ? "Add a tag… (-tag excludes)" : "Search tags… (-tag excludes)"}
              aria-label="Search the board"
              className="w-full rounded-[0.5rem] border border-border-strong bg-surface px-[0.7rem] py-2 text-[0.9rem] outline-none placeholder:text-muted-foreground"
            />
            {focused && offered.length > 0 && (
              <ul className="absolute top-[calc(100%+0.3rem)] right-0 left-0 z-20 m-0 list-none rounded-[0.5rem] border border-border bg-surface p-1">
                {offered.map((item, index) => (
                  <li key={item.tag} className="flex items-stretch gap-0.5">
                    <button
                      type="button"
                      aria-label={`Exclude ${tagLabel(item.tag)}`}
                      className="grid w-8 shrink-0 cursor-pointer place-items-center rounded-sm text-danger hover:bg-surface-soft"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        addExclude(item.tag);
                      }}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                        index === highlight && "bg-surface-soft",
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        addInclude(item.tag);
                      }}
                    >
                      <span className="truncate">{tagLabel(item.tag)}</span>
                      <span className="text-muted-foreground tabular-nums">{item.count}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Include ${tagLabel(item.tag)}`}
                      className="grid w-8 shrink-0 cursor-pointer place-items-center rounded-sm text-accent hover:bg-surface-soft"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        addInclude(item.tag);
                      }}
                    >
                      +
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={applyText}
              className={cn(
                "cursor-pointer rounded-[0.45rem] border px-[0.8rem] py-[0.45rem] text-[0.85rem] font-semibold",
                dirty
                  ? "border-accent bg-accent text-accent-foreground hover:brightness-105"
                  : "border-accent bg-surface text-accent hover:bg-selection",
              )}
            >
              Filter
            </button>
            {(filterActive(filter) || text.trim() !== "" || stagedTags.length > 0 || stagedExclude.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  setStagedTags([]);
                  setStagedExclude([]);
                  commit({ tags: [], exclude: [], q: "", sort: filter.sort, cleared: true }, true);
                }}
                className="cursor-pointer rounded-[0.45rem] border border-danger px-[0.8rem] py-[0.45rem] text-[0.85rem] font-semibold text-danger hover:bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))]"
              >
                Clear
              </button>
            )}
            {differsFromDefaults && (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  commit(
                    { tags: defaults?.tags ?? [], exclude: defaults?.exclude ?? [], q: "", sort: filter.sort, cleared: false },
                    true,
                  );
                }}
                className="cursor-pointer rounded-[0.45rem] border border-accent bg-selection px-[0.8rem] py-[0.45rem] text-[0.85rem] font-semibold hover:bg-[color-mix(in_srgb,var(--accent)_28%,var(--surface))]"
              >
                My defaults
              </button>
            )}
          </div>
          <Segment label="Sort">
            {relevant ? (
              <span className="bg-surface px-2 py-1.5 text-[0.8rem] text-muted-foreground">Relevant</span>
            ) : (
              <>
                <SegmentButton active={filter.sort === "newest"} onClick={() => commit({ ...filter, sort: "newest" })}>
                  Newest
                </SegmentButton>
                <SegmentButton active={filter.sort === "oldest"} onClick={() => commit({ ...filter, sort: "oldest" })}>
                  Oldest
                </SegmentButton>
              </>
            )}
          </Segment>
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
            <Button onClick={onUpload}>
              <Upload />
              Upload
            </Button>
          </div>
        </div>
        {(stagedTags.length > 0 || stagedExclude.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pb-2">
            {stagedTags.map((tag) => (
              <FilterChip
                key={tag}
                label={tagLabel(tag)}
                pending={!filter.tags.includes(tag)}
                remove={() => {
                  const tags = stagedTags.filter((item) => item !== tag);
                  commit({
                    ...filter,
                    tags,
                    exclude: stagedExclude,
                    cleared: tags.length === 0 && stagedExclude.length === 0 && filter.q === "",
                  });
                }}
              />
            ))}
            {stagedExclude.map((tag) => (
              <FilterChip
                key={tag}
                label={tagLabel(tag)}
                excluded
                pending={!filter.exclude.includes(tag)}
                remove={() => {
                  const exclude = stagedExclude.filter((item) => item !== tag);
                  commit({
                    ...filter,
                    tags: stagedTags,
                    exclude,
                    cleared: stagedTags.length === 0 && exclude.length === 0 && filter.q === "",
                  });
                }}
              />
            ))}
          </div>
        )}
        <div className="-mx-[var(--page-x)] flex gap-2 overflow-x-auto px-[var(--page-x)] pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {viewportTags.length === 0 && !loading && (
            <span className="py-2 text-sm text-muted-foreground">No tags in this view</span>
          )}
          {viewportTags.map((item) => (
            <span key={item.tag} className="inline-flex shrink-0 overflow-hidden rounded-full border border-border-strong bg-surface">
              <button
                type="button"
                aria-label={`Exclude ${tagLabel(item.tag)}`}
                className="w-7 cursor-pointer border-r border-border text-danger hover:bg-surface-soft"
                onClick={() => {
                  setStagedTags((current) => current.filter((tag) => tag !== item.tag));
                  setStagedExclude((current) => (current.includes(item.tag) ? current : [...current, item.tag]));
                }}
              >
                −
              </button>
              <button
                type="button"
                className="cursor-pointer px-2 py-1.5 text-[0.82rem] hover:bg-surface-soft"
                onClick={() => {
                  setStagedExclude((current) => current.filter((tag) => tag !== item.tag));
                  setStagedTags((current) => (current.includes(item.tag) ? current : [...current, item.tag]));
                }}
              >
                {tagLabel(item.tag)} <span className="text-[0.74rem] text-muted-foreground tabular-nums">· {item.count}</span>
              </button>
              <button
                type="button"
                aria-label={`Include ${tagLabel(item.tag)}`}
                className="w-7 cursor-pointer border-l border-border text-accent hover:bg-surface-soft"
                onClick={() => {
                  setStagedExclude((current) => current.filter((tag) => tag !== item.tag));
                  setStagedTags((current) => (current.includes(item.tag) ? current : [...current, item.tag]));
                }}
              >
                +
              </button>
            </span>
          ))}
        </div>
      </div>

      {loading && <p className="py-16 text-center text-sm text-muted-foreground">Loading the board…</p>}
      {empty && (
        <div className="grid justify-items-center gap-3 px-4 py-24 text-center text-muted-foreground">
          <Sparkles className="size-7 text-accent" />
          <p className="m-0 max-w-sm text-sm">
            {saved
              ? "No saved pictures yet."
              : filterActive(filter)
                ? "No pictures match this search."
                : "No pictures yet."}
          </p>
        </div>
      )}

      {items.length > 0 && view.mode === "grid" && (
        <div className="grid grid-cols-2 gap-2.5 pt-4 min-[701px]:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] min-[701px]:gap-4 min-[1601px]:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
          {items.map((post) => (
            <Picture key={post._id} post={post} href={postHash(post._id, filter, saved)} />
          ))}
        </div>
      )}
      {items.length > 0 && view.mode === "rows" && (
        <div className="grid gap-3 pt-4">
          {items.map((post) => (
            <PictureRow key={post._id} post={post} href={postHash(post._id, filter, saved)} onTag={addInclude} />
          ))}
        </div>
      )}
      <div ref={sentinel} className="h-8" />
      {status === "LoadingMore" && items.length > 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Loading more…</p>
      )}
      {showTop && (
        <button
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-5 bottom-5 z-40 grid size-11 cursor-pointer place-items-center rounded-full border border-border-strong bg-surface text-foreground"
        >
          <ArrowUp className="size-4" />
        </button>
      )}
    </div>
  );
}

function FilterChip({
  label,
  excluded,
  pending,
  remove,
}: {
  label: string;
  excluded?: boolean;
  pending?: boolean;
  remove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.8rem]",
        excluded ? "border-danger text-danger line-through" : "border-border-strong bg-surface-soft",
        pending && "border-dashed opacity-75",
      )}
    >
      {label}
      <button type="button" aria-label={`Remove ${label}`} onClick={remove} className="cursor-pointer text-muted-foreground no-underline">
        ×
      </button>
    </span>
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
