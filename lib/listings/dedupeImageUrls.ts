/** Strip resize tokens so the same asset shares one meta/dedupe key. */
export function normalizeImagePathForDedupe(pathname: string) {
  return pathname
    .replace(/-w\d+-h\d+(?=\.[a-z0-9]{2,5}$)/gi, "")
    .replace(/\/(thumb|small|medium|large|original)\//gi, "/");
}

/** Normalize a stored meta key (hostname+path) to the current dedupe format. */
export function normalizeListingImageMetaKey(storedKey: string) {
  const trimmed = storedKey.trim().toLowerCase();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.includes("://")) {
    return imageDedupeKey(trimmed);
  }

  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    return trimmed;
  }

  const host = trimmed.slice(0, slash);
  const path = normalizeImagePathForDedupe(trimmed.slice(slash));
  return `${host}${path}`;
}

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
    return `${parsed.hostname}${normalizeImagePathForDedupe(parsed.pathname)}`.toLowerCase();
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
