import { ConvexError } from "convex/values";

export function errorText(caught: unknown, fallback: string) {
  if (caught instanceof ConvexError && typeof caught.data === "string") return caught.data;
  if (caught instanceof Error && caught.message && !caught.message.startsWith("[CONVEX")) return caught.message;
  return fallback;
}
