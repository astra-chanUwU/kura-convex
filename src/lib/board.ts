import { normalizeTag } from "../../shared/tags";

export type BoardSort = "newest" | "oldest";

export type BoardFilter = {
  tags: string[];
  exclude: string[];
  q: string;
  sort: BoardSort;
  cleared: boolean;
};

export type BoardView = {
  mode: "grid" | "rows";
  wide: boolean;
};

export const EMPTY_FILTER: BoardFilter = {
  tags: [],
  exclude: [],
  q: "",
  sort: "newest",
  cleared: false,
};

const VIEW_KEY = "kura-board-view";

export function normalizeTagToken(raw: string) {
  return normalizeTag(raw);
}

export function splitTagInput(text: string) {
  const include: string[] = [];
  const exclude: string[] = [];
  const seenIn = new Set<string>();
  const seenEx = new Set<string>();
  for (const raw of text.split(/[\s,]+/)) {
    if (!raw) continue;
    const dropping = raw.startsWith("-") && raw.length > 1;
    const tag = normalizeTagToken(dropping ? raw.slice(1) : raw);
    if (!tag) continue;
    if (dropping) {
      if (seenEx.has(tag)) continue;
      seenEx.add(tag);
      exclude.push(tag);
    } else if (!seenIn.has(tag)) {
      seenIn.add(tag);
      include.push(tag);
    }
  }
  return { include: include.filter((tag) => !seenEx.has(tag)), exclude };
}

export function sameTags(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((tag) => other.has(tag));
}

export function parseFilter(params: URLSearchParams): BoardFilter {
  const tags = [...new Set((params.get("tags") ?? "").split(",").map(normalizeTagToken).filter(Boolean))];
  const exclude = [...new Set((params.get("exclude") ?? "").split(",").map(normalizeTagToken).filter(Boolean))].filter(
    (tag) => !tags.includes(tag),
  );
  return {
    tags,
    exclude,
    q: (params.get("q") ?? "").trim(),
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
    cleared: params.get("cleared") === "1",
  };
}

export function filterActive(filter: BoardFilter) {
  return filter.tags.length > 0 || filter.exclude.length > 0 || filter.q !== "";
}

function searchParams(filter: BoardFilter, saved = false) {
  const params = new URLSearchParams();
  if (filter.tags.length > 0) params.set("tags", filter.tags.join(","));
  if (filter.exclude.length > 0) params.set("exclude", filter.exclude.join(","));
  if (filter.q) params.set("q", filter.q);
  if (filter.sort === "oldest") params.set("sort", "oldest");
  if (saved) params.set("saved", "1");
  if (filter.cleared && !filterActive(filter)) params.set("cleared", "1");
  return params;
}

export function boardHash(saved: boolean, filter: BoardFilter) {
  const params = searchParams(filter);
  const path = saved ? "/saved" : "/";
  const query = params.toString();
  return `#${path}${query ? `?${query}` : ""}`;
}

export function postHash(id: string, filter: BoardFilter, saved: boolean) {
  const params = searchParams(filter, saved);
  const query = params.toString();
  return `#/posts/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
}

export function writeBoard(saved: boolean, filter: BoardFilter, replace = false) {
  const hash = boardHash(saved, filter);
  if (!replace) {
    window.location.hash = hash;
    return;
  }
  const next = `${window.location.pathname}${window.location.search}${hash}`;
  window.history.replaceState(null, "", next);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function readBoardView(): BoardView {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}") as Partial<BoardView>;
    return { mode: saved.mode === "rows" ? "rows" : "grid", wide: saved.wide === true };
  } catch {
    return { mode: "grid", wide: false };
  }
}

export function writeBoardView(view: BoardView) {
  localStorage.setItem(VIEW_KEY, JSON.stringify(view));
}
