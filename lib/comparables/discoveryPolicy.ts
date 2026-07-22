export type ComparablePoolTargets = {
  total: number;
  sameSuburb: number;
};

export type ComparableDiscoverySummary = {
  poolCount: number;
  sameSuburbCount: number;
  targetCount: number;
  targetSameSuburbCount: number;
  attemptCount: number;
  subjectExcludedCount: number;
  targetMet: boolean;
};

type ComparableIdentity = {
  address?: string | null;
  suburb?: string | null;
  listingUrl?: string | null;
};

export const RENT_COMPARABLE_POOL_TARGETS: ComparablePoolTargets = {
  total: 15,
  sameSuburb: 8,
};

export const SOLD_COMPARABLE_POOL_TARGETS: ComparablePoolTargets = {
  total: 15,
  sameSuburb: 8,
};

export const FOR_SALE_COMPARABLE_POOL_TARGETS: ComparablePoolTargets = {
  total: 10,
  sameSuburb: 5,
};

/** Keep enough evidence for review without bloating saved listing JSON or LLM prompts. */
export const MAX_STORED_COMPARABLES = 30;

/** Tight match, then progressively drop car, bath and location constraints. */
export const MAX_SALE_DISCOVERY_ATTEMPTS_PER_CHANNEL = 5;

function normalizeSuburb(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function canonicalListingUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return `${hostname}${parsed.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return trimmed.split(/[?#]/, 1)[0]!.replace(/\/$/, "").toLowerCase();
  }
}

function normalizedStreetAddress(value?: string | null, suburb?: string | null) {
  let normalized = value?.normalize("NFKD").toLowerCase() ?? "";
  const normalizedSuburb = suburb
    ?.normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";

  normalized = normalized
    .replace(/\b(?:unit|apartment|apt)\s+([a-z0-9]+)\b/g, "$1")
    .replace(/\b(?:street|st)\b/g, "st")
    .replace(/\b(?:road|rd)\b/g, "rd")
    .replace(/\b(?:avenue|ave)\b/g, "ave")
    .replace(/\b(?:parade|pde)\b/g, "pde")
    .replace(/\b(?:drive|dr)\b/g, "dr")
    .replace(/\b(?:lane|ln)\b/g, "ln")
    .replace(/\b(?:place|pl)\b/g, "pl")
    .replace(/\b(?:court|ct)\b/g, "ct")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalizedSuburb) {
    const locationStart = normalized.lastIndexOf(` ${normalizedSuburb}`);
    if (locationStart > 0) {
      normalized = normalized.slice(0, locationStart);
    }
  }

  return normalized.replace(/[^a-z0-9]/g, "");
}

export function isSubjectComparable(
  comparable: ComparableIdentity,
  subject: ComparableIdentity,
) {
  const comparableUrl = canonicalListingUrl(comparable.listingUrl);
  const subjectUrl = canonicalListingUrl(subject.listingUrl);
  if (comparableUrl && subjectUrl && comparableUrl === subjectUrl) {
    return true;
  }

  const comparableSuburb = normalizeSuburb(comparable.suburb);
  const subjectSuburb = normalizeSuburb(subject.suburb);
  if (comparableSuburb && subjectSuburb && comparableSuburb !== subjectSuburb) {
    return false;
  }

  const comparableAddress = normalizedStreetAddress(
    comparable.address,
    comparable.suburb,
  );
  const subjectAddress = normalizedStreetAddress(subject.address, subject.suburb);

  return Boolean(
    comparableAddress &&
      subjectAddress &&
      comparableAddress === subjectAddress,
  );
}

export function excludeSubjectComparables<T extends ComparableIdentity>(
  comparables: T[],
  subject: ComparableIdentity,
): { comparables: T[]; excludedCount: number } {
  const filtered = comparables.filter(
    (comparable) => !isSubjectComparable(comparable, subject),
  );
  return {
    comparables: filtered,
    excludedCount: comparables.length - filtered.length,
  };
}

export function summarizeComparablePool<T extends { suburb?: string | null }>({
  comparables,
  subjectSuburb,
  targets,
  attemptCount,
  subjectExcludedCount,
}: {
  comparables: T[];
  subjectSuburb?: string | null;
  targets: ComparablePoolTargets;
  attemptCount: number;
  subjectExcludedCount: number;
}): ComparableDiscoverySummary {
  const normalizedSubjectSuburb = normalizeSuburb(subjectSuburb);
  const sameSuburbCount = normalizedSubjectSuburb
    ? comparables.filter(
        (comparable) =>
          normalizeSuburb(comparable.suburb) === normalizedSubjectSuburb,
      ).length
    : comparables.length;
  const targetMet =
    comparables.length >= targets.total &&
    sameSuburbCount >= targets.sameSuburb;

  return {
    poolCount: comparables.length,
    sameSuburbCount,
    targetCount: targets.total,
    targetSameSuburbCount: targets.sameSuburb,
    attemptCount,
    subjectExcludedCount,
    targetMet,
  };
}

export function capComparablePool<T>(comparables: T[]) {
  return comparables.slice(0, MAX_STORED_COMPARABLES);
}
