export function normalizeTag(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_:-]/g, "")
    .replace(/^[_:-]+|[_:-]+$/g, "")
    .slice(0, 48);
}

export function normalizeTags(tags: string[], max = 20) {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag || out.includes(tag)) continue;
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}
