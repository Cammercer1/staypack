/**
 * Normalize image URLs so visually identical photos from scrapers
 * (different sizes/crops) collapse to one tile in the picker.
 */
export function imageDedupeKey(url: string) {
  const cloudHi = url.match(
    /listings-photos\.cloudhi\.io\/properties\/\d+\/[a-f0-9-]+\.jpg/i,
  );
  if (cloudHi) {
    return cloudHi[0].toLowerCase();
  }

  const stepps = url.match(/propertyimages\.stepps\.net\/[^?]+/i);
  if (stepps) {
    return stepps[0]
      .replace(/\/(o|small|medium|thumb|large)\//gi, "/")
      .toLowerCase();
  }

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function dedupeImageUrls(urls: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;

    const key = imageDedupeKey(trimmed);
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}
