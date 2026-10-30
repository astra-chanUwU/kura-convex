/** Board-sized WebP stored next to the original. The post page still uses the original. */
export function thumbKeyFor(storageKey: string) {
  return storageKey.replace(/\.[^.]+$/, ".thumb.webp");
}
