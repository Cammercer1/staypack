import {
  imageDedupeKey,
  normalizeListingImageMetaKey,
} from "@/lib/listings/dedupeImageUrls";

export type ListingImageRole = "photo" | "floor_plan";

export type ListingImageMeta = {
  role: ListingImageRole;
  label?: string;
};

export type ListingImageMetaMap = Record<string, ListingImageMeta>;

const FLOOR_PLAN_URL = /floor[-_]?plan|floorplan|site[-_]?plan|siteplan/i;

/** URL path/name only — Domain photo CDN sizes are usually landscape (3:2, 16:9), not plans. */
export function isFloorPlanUrlHeuristic(url: string) {
  return FLOOR_PLAN_URL.test(url);
}

/** Drop aspect-ratio mis-guesses; keep explicit labels and URL-tagged plans. */
export function reconcileListingImageMetaMap(
  map: ListingImageMetaMap,
  poolUrls: string[],
): ListingImageMetaMap {
  const reconciled = { ...map };

  for (const url of poolUrls) {
    const key = getMetaKeyForUrl(url);
    const entry = reconciled[key];
    if (!entry || entry.role !== "floor_plan" || entry.label) {
      continue;
    }

    if (!isFloorPlanUrlHeuristic(url)) {
      reconciled[key] = { role: "photo" };
    }
  }

  return reconciled;
}

export function guessListingImageMeta(url: string): ListingImageMeta {
  return {
    role: isFloorPlanUrlHeuristic(url) ? "floor_plan" : "photo",
  };
}

export function normalizeListingImageMetaMap(
  raw: ListingImageMetaMap | null | undefined,
): ListingImageMetaMap {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized: ListingImageMetaMap = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const role = value.role === "floor_plan" ? "floor_plan" : "photo";
    const label =
      typeof value.label === "string" && value.label.trim()
        ? value.label.trim()
        : undefined;

    normalized[key] = label ? { role, label } : { role };
  }

  return normalized;
}

export function getMetaKeyForUrl(url: string) {
  return imageDedupeKey(url.trim());
}

export function getListingImageMeta(
  map: ListingImageMetaMap | null | undefined,
  url: string,
): ListingImageMeta | undefined {
  if (!url.trim() || !map) {
    return undefined;
  }

  const key = getMetaKeyForUrl(url);
  if (map[key]) {
    return map[key];
  }

  for (const [storedKey, value] of Object.entries(map)) {
    if (normalizeListingImageMetaKey(storedKey) === key) {
      return value;
    }
  }

  return undefined;
}

/** Collapse dimension-variant keys so meta survives CDN resize URLs. */
export function normalizeListingImageMetaMapKeys(
  map: ListingImageMetaMap,
): ListingImageMetaMap {
  const normalized: ListingImageMetaMap = {};

  for (const [storedKey, value] of Object.entries(map)) {
    const key = normalizeListingImageMetaKey(storedKey);
    const existing = normalized[key];
    if (!existing) {
      normalized[key] = value;
      continue;
    }

    if (existing.role === "photo" && value.role === "floor_plan") {
      normalized[key] = value;
    }
  }

  return normalized;
}

export function resolveListingImageRole(
  map: ListingImageMetaMap | null | undefined,
  url: string,
): ListingImageRole {
  return getListingImageMeta(map, url)?.role ?? guessListingImageMeta(url).role;
}

/** Merge auto-guesses for pool URLs without overwriting existing entries. */
export function mergeGuessedListingImageMeta(
  existing: ListingImageMetaMap | null | undefined,
  urls: string[],
): ListingImageMetaMap {
  const merged = normalizeListingImageMetaMap(existing);

  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) {
      continue;
    }

    if (getListingImageMeta(merged, trimmed)) {
      continue;
    }

    const key = getMetaKeyForUrl(trimmed);
    merged[key] = guessListingImageMeta(trimmed);
  }

  // Do not reconcile here — it used to demote manual floor_plan tags without URL keywords.
  return normalizeListingImageMetaMapKeys(merged);
}

export function setListingImageMetaEntry(
  map: ListingImageMetaMap,
  url: string,
  entry: ListingImageMeta,
): ListingImageMetaMap {
  const key = getMetaKeyForUrl(url);
  const label =
    typeof entry.label === "string" && entry.label.trim()
      ? entry.label.trim()
      : undefined;

  return {
    ...map,
    [key]: {
      role: entry.role === "floor_plan" ? "floor_plan" : "photo",
      ...(label ? { label } : {}),
    },
  };
}

export function pruneListingImageMetaToPool(
  map: ListingImageMetaMap,
  poolUrls: string[],
): ListingImageMetaMap {
  const allowed = new Set(poolUrls.map((url) => getMetaKeyForUrl(url)));
  const normalized = normalizeListingImageMetaMapKeys(map);
  const pruned: ListingImageMetaMap = {};

  for (const [key, value] of Object.entries(normalized)) {
    if (allowed.has(key)) {
      pruned[key] = value;
    }
  }

  return pruned;
}
