/** REA CDN templates use `{width}x{height}` (often URL-encoded) — must be resolved before load. */
export function normalizeReaImageUrl(url: string) {
  return url
    .replace(/\{width\}/gi, "1920")
    .replace(/\{height\}/gi, "1080")
    .replace(/%7Bwidth%7D/gi, "1920")
    .replace(/%7Bheight%7D/gi, "1080");
}

export function normalizeReaImageUrls(urls: string[]) {
  return urls.map(normalizeReaImageUrl);
}
