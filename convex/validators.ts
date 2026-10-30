import { v } from "convex/values";
import { fontIds, storedThemeIds, themeIds } from "../shared/appearance";

export { normalizeFont, normalizeTheme } from "../shared/appearance";
export { normalizeTag, normalizeTags } from "../shared/tags";

export const rating = v.union(v.literal("safe"), v.literal("questionable"), v.literal("explicit"));

function unionOf<const T extends readonly [string, string, ...string[]]>(ids: T) {
  const [first, second, ...rest] = ids;
  return v.union(
    v.literal(first),
    v.literal(second),
    ...(rest.map((id) => v.literal(id)) as [(typeof v.literal<T[number]>) extends never ? never : ReturnType<typeof v.literal>]),
  );
}

export const theme = unionOf(themeIds);
export const font = unionOf(fontIds);
export const storedTheme = unionOf(storedThemeIds);

export const postCard = v.object({
  _id: v.id("posts"),
  storageKey: v.string(),
  thumbKey: v.union(v.string(), v.null()),
  contentType: v.string(),
  byteSize: v.number(),
  width: v.number(),
  height: v.number(),
  artist: v.string(),
  source: v.string(),
  caption: v.string(),
  rating,
  createdAt: v.number(),
  tags: v.array(v.string()),
  safebooruId: v.union(v.number(), v.null()),
  favorite: v.boolean(),
});

export const postDetail = v.object({
  _id: v.id("posts"),
  storageKey: v.string(),
  thumbKey: v.union(v.string(), v.null()),
  contentType: v.string(),
  byteSize: v.number(),
  width: v.number(),
  height: v.number(),
  originalName: v.string(),
  artist: v.string(),
  source: v.string(),
  caption: v.string(),
  rating,
  createdAt: v.number(),
  tags: v.array(v.string()),
  safebooruId: v.union(v.number(), v.null()),
  favorite: v.boolean(),
  mine: v.boolean(),
});

export const tagCount = v.object({
  tag: v.string(),
  count: v.number(),
});

export const preferenceResult = v.object({
  displayName: v.string(),
  bio: v.string(),
  location: v.string(),
  website: v.string(),
  theme,
  font,
  showSensitive: v.boolean(),
  includeTags: v.array(v.string()),
  excludeTags: v.array(v.string()),
  signedIn: v.boolean(),
});

export function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}
