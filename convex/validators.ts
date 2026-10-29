import { v } from "convex/values";

export const rating = v.union(
  v.literal("safe"),
  v.literal("questionable"),
  v.literal("explicit"),
);

export const theme = v.union(
  v.literal("kura"),
  v.literal("safebooru"),
  v.literal("rule34"),
  v.literal("umineko"),
  v.literal("bernkastel"),
  v.literal("lambdadelta"),
  v.literal("beatrice"),
  v.literal("erika"),
  v.literal("battler"),
  v.literal("virgilia"),
  v.literal("catppuccin"),
  v.literal("danbooru"),
);

export const font = v.union(
  v.literal("system"),
  v.literal("serif"),
  v.literal("rounded"),
  v.literal("mono"),
  v.literal("hack"),
);

export const storedTheme = v.union(
  v.literal("kura"),
  v.literal("safebooru"),
  v.literal("rule34"),
  v.literal("umineko"),
  v.literal("bernkastel"),
  v.literal("lambdadelta"),
  v.literal("beatrice"),
  v.literal("erika"),
  v.literal("battler"),
  v.literal("virgilia"),
  v.literal("catppuccin"),
  v.literal("danbooru"),
  v.literal("light"),
  v.literal("dark"),
  v.literal("system"),
);

const themeIds = [
  "kura",
  "safebooru",
  "rule34",
  "umineko",
  "bernkastel",
  "lambdadelta",
  "beatrice",
  "erika",
  "battler",
  "virgilia",
  "catppuccin",
  "danbooru",
] as const;

const fontIds = ["system", "serif", "rounded", "mono", "hack"] as const;

export type ThemeId = (typeof themeIds)[number];
export type FontId = (typeof fontIds)[number];

export function normalizeTheme(value: string | undefined): ThemeId {
  if (value === "light") return "danbooru";
  if (value === "dark" || value === "system" || value === undefined) return "kura";
  return themeIds.includes(value as ThemeId) ? (value as ThemeId) : "kura";
}

export function normalizeFont(value: string | undefined): FontId {
  return fontIds.includes(value as FontId) ? (value as FontId) : "system";
}

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
