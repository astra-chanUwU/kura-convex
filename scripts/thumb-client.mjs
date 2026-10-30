const service = "http://127.0.0.1:5006";

export async function requestThumbnail(storageKey, env) {
  const { ok, failed } = await requestThumbnails([storageKey], env);
  const made = ok[0];
  if (!made) throw new Error(failed[0]?.message || "The thumbnail could not be made.");
  return made;
}

export async function requestThumbnails(storageKeys, env) {
  if (!env.KURA_THUMB_SECRET) throw new Error("KURA_THUMB_SECRET is missing from .env.local.");
  const response = await fetch(`${service}/v1/thumbnails/batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.KURA_THUMB_SECRET}`,
    },
    body: JSON.stringify({ storageKeys }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Thumbnail service returned ${response.status}`);
  const expected = (key) => key.replace(/\.[^.]+$/, ".thumb.webp");
  const ok = (body.ok ?? []).filter((item) => item.thumbKey === expected(item.storageKey));
  const mismatched = (body.ok ?? [])
    .filter((item) => item.thumbKey !== expected(item.storageKey))
    .map((item) => ({ storageKey: item.storageKey, message: "The thumbnail key did not match the picture." }));
  return { ok, failed: [...(body.failed ?? []), ...mismatched] };
}
