import { v } from "convex/values";

export const rating = v.union(
  v.literal("safe"),
  v.literal("questionable"),
  v.literal("explicit"),
);

export const theme = v.union(v.literal("light"), v.literal("dark"), v.literal("system"));

export function normalizeTags(tags: string[], max = 20) {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_:-]/g, "")
      .slice(0, 48);
    if (!tag || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

export function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}
