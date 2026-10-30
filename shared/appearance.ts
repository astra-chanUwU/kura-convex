export const themeIds = [
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

export const fontIds = ["system", "serif", "rounded", "mono", "hack"] as const;

export const storedThemeIds = [...themeIds, "light", "dark", "system"] as const;

export type ThemeId = (typeof themeIds)[number];
export type FontId = (typeof fontIds)[number];

export function normalizeTheme(value: unknown): ThemeId {
  if (value === "light") return "danbooru";
  if (typeof value !== "string" || value === "dark" || value === "system") return "kura";
  return (themeIds as readonly string[]).includes(value) ? (value as ThemeId) : "kura";
}

export function normalizeFont(value: unknown): FontId {
  if (typeof value !== "string") return "system";
  return (fontIds as readonly string[]).includes(value) ? (value as FontId) : "system";
}
