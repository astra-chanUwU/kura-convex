export function imageUrl(storageKey: string) {
  const base = import.meta.env.VITE_S3_PUBLIC_URL ?? "http://127.0.0.1:9000/kura-images";
  return `${base.replace(/\/$/, "")}/${storageKey}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const TAG_LABELS: Record<string, string> = {
  "1girl": "anime girl",
  yuri: "yuri",
  cute: "cute",
  cyberpunk: "cyberpunk",
};

export function tagLabel(tag: string) {
  return TAG_LABELS[tag] ?? tag.replaceAll("_", " ");
}
