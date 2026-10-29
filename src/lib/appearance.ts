export type ThemeId =
  | "kura"
  | "safebooru"
  | "rule34"
  | "umineko"
  | "bernkastel"
  | "lambdadelta"
  | "beatrice"
  | "erika"
  | "battler"
  | "virgilia"
  | "catppuccin"
  | "danbooru";

export type FontId = "system" | "serif" | "rounded" | "mono" | "hack";

export const THEMES: ThemeId[] = [
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
];

export const FONTS: FontId[] = ["system", "serif", "rounded", "mono", "hack"];

export const THEME_LABELS: Record<ThemeId, string> = {
  kura: "Kura Dark",
  safebooru: "Safebooru",
  rule34: "Rule34",
  umineko: "Umineko",
  bernkastel: "Bernkastel",
  lambdadelta: "Lambdadelta",
  beatrice: "Beatrice",
  erika: "Erika",
  battler: "Battler",
  virgilia: "Virgilia",
  catppuccin: "Catppuccin",
  danbooru: "Danbooru",
};

export const THEME_SWATCHES: Record<ThemeId, string> = {
  kura: "#b49afa",
  safebooru: "#0b6bcb",
  rule34: "#8bc34a",
  umineko: "#c9a227",
  bernkastel: "#4a90d9",
  lambdadelta: "#ff69b4",
  beatrice: "#d4a84b",
  erika: "#00b4d8",
  battler: "#c41e3a",
  virgilia: "#8b1a2d",
  catppuccin: "#cba6f7",
  danbooru: "#0075f8",
};

export const FONT_LABELS: Record<FontId, string> = {
  system: "Atkinson Hyperlegible",
  serif: "Source Serif 4",
  rounded: "Nunito",
  mono: "JetBrains Mono",
  hack: "Hack",
};

export const DEFAULT_THEME: ThemeId = "kura";
export const DEFAULT_FONT: FontId = "system";

export function normalizeTheme(value: unknown): ThemeId {
  if (value === "light") return "danbooru";
  if (value === "dark" || value === "system") return "kura";
  return THEMES.includes(value as ThemeId) ? (value as ThemeId) : DEFAULT_THEME;
}

export function normalizeFont(value: unknown): FontId {
  return FONTS.includes(value as FontId) ? (value as FontId) : DEFAULT_FONT;
}
