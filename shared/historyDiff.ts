export type DiffKind = "added" | "removed" | "unchanged";

export interface DiffLine {
  field: string;
  kind: DiffKind;
  value: string;
}

export type DiffState = {
  artist?: unknown;
  caption?: unknown;
  source?: unknown;
  tags?: unknown;
  rating?: unknown;
  removed?: unknown;
};

const FIELD_ORDER = ["artist", "caption", "source", "tags", "rating", "removed"] as const;

// Unchanged lines stay as context. Long text only shows up when it changes.
const CONTEXT = new Set(["artist", "rating", "tags"]);

const FIELD_LABEL: Record<string, string> = {
  removed: "status",
};

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function words(value: string) {
  return value.replaceAll("_", " ");
}

function label(field: string) {
  return FIELD_LABEL[field] ?? field;
}

function displayValue(field: string, value: unknown): string {
  if (field === "removed") return value === true ? "removed" : "on the board";
  if (field === "rating" && typeof value === "string" && value) {
    return value.slice(0, 1).toUpperCase() + value.slice(1);
  }
  if (typeof value === "string") return words(value);
  if (isEmpty(value)) return "";
  return words(JSON.stringify(value) ?? "");
}

function meaningful(field: string, value: unknown) {
  if (field === "removed") return value === true;
  return !isEmpty(value);
}

function diffScalar(lines: DiffLine[], field: string, before: unknown, after: unknown) {
  const beforeText = displayValue(field, before);
  const afterText = displayValue(field, after);
  const name = label(field);
  if (beforeText === afterText) {
    if (CONTEXT.has(field) && meaningful(field, after)) {
      lines.push({ field: name, kind: "unchanged", value: afterText || "—" });
    }
    return;
  }
  if (!isEmpty(before) && beforeText) lines.push({ field: name, kind: "removed", value: beforeText });
  if (!isEmpty(after) && afterText) lines.push({ field: name, kind: "added", value: afterText });
}

function tagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
}

function prettyTags(tags: string[]) {
  const pretty = tags.map(words);
  if (pretty.length <= 8) return pretty.join(", ");
  return `${pretty.slice(0, 5).join(", ")} +${pretty.length - 5} more`;
}

function diffTags(lines: DiffLine[], before: unknown, after: unknown) {
  const beforeTags = tagList(before);
  const afterTags = tagList(after);
  if (beforeTags.length === 0 && afterTags.length === 0) return;
  const afterSet = new Set(afterTags);
  const beforeSet = new Set(beforeTags);
  const removed = beforeTags.filter((tag) => !afterSet.has(tag));
  const added = afterTags.filter((tag) => !beforeSet.has(tag));
  const kept = beforeTags.filter((tag) => afterSet.has(tag));
  if (removed.length === 0 && added.length === 0) {
    lines.push({ field: "tags", kind: "unchanged", value: prettyTags(afterTags) });
    return;
  }
  if (removed.length) lines.push({ field: "tags", kind: "removed", value: prettyTags(removed) });
  if (added.length) lines.push({ field: "tags", kind: "added", value: prettyTags(added) });
  if (kept.length) {
    lines.push({
      field: "tags",
      kind: "unchanged",
      value: kept.length > 8 ? `${kept.length} unchanged` : prettyTags(kept),
    });
  }
}

/** Git-style line diff between two history snapshots. */
export function diffStates(before: DiffState, after: DiffState): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const field of FIELD_ORDER) {
    if (!(field in before) && !(field in after)) continue;
    if (field === "tags") diffTags(lines, before.tags, after.tags);
    else diffScalar(lines, field, before[field], after[field]);
  }
  return lines;
}
