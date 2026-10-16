import { rentalCompListingId } from "@/lib/lease-appraisal/rentalCompIds";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import {
  buildRentalCompSelectionPool,
} from "@/lib/rental/rankRentalCompsForSubject";
import type { ParsedListing } from "@/lib/types";
import { marketForCountry } from "@/lib/property-market";
import { orderUsComparablePool } from "@/lib/us-property/comparablePresentation";
import { mergeRentalComps, rentalCompDedupeKey } from "@/lib/rental/mergeRentalComps";

/** Page 2 comparable grid (2×3). */
export const MAX_LEASE_APPRAISAL_FEATURED_COMPS = 6;

export function hasLeaseAppraisalSelectedComps(
  parsed: ParsedListing | null | undefined,
): boolean {
  const ids = parsed?.rentalAppraisal?.selectedCompListingIds;
  return Boolean(ids && ids.length > 0);
}

export function buildRentalCompIdLookup(parsed: ParsedListing) {
  const fullPool = parsed.rentalComps ?? [];
  const ordered = orderLeaseAppraisalCompPool(parsed);
  const map = new Map<string, (typeof fullPool)[number]>();
  const canonical = new Map(ordered.map(comp => [rentalCompDedupeKey(comp), comp]));

  const register = (comp: (typeof fullPool)[number], index: number) => {
    const retained = canonical.get(rentalCompDedupeKey(comp)) ?? comp;
    map.set(rentalCompListingId(comp, index), retained);
    const url = comp.listingUrl?.trim();
    if (url) {
      map.set(url, retained);
    }
  };

  fullPool.forEach((comp, index) => register(comp, index));
  ordered.forEach((comp, index) => register(comp, index));

  return map;
}

export function defaultSelectedCompListingIds(
  parsed: ParsedListing,
): string[] {
  const ordered = orderLeaseAppraisalCompPool(parsed);
  return ordered
    .slice(0, MAX_LEASE_APPRAISAL_FEATURED_COMPS)
    .map((comp, index) => rentalCompListingId(comp, index));
}

export function orderLeaseAppraisalCompPool(parsed: ParsedListing) {
  const pool = mergeRentalComps([], parsed.rentalComps ?? []);
  if (marketForCountry(parsed.country).country === "US" && pool.some((comp) => comp.usMatch)) return orderUsComparablePool(pool);
  const subjectPropertyType = resolveRentSubjectPropertyType(parsed);
  return buildRentalCompSelectionPool(pool, {
    suburb: parsed.suburb,
    bedrooms: parsed.bedrooms ?? undefined,
    bathrooms: parsed.bathrooms ?? undefined,
    carSpaces: parsed.carSpaces ?? undefined,
    targetWeeklyRent:
      parsed.domainAvm?.rentalEstimate?.confidence === "high" ||
      parsed.domainAvm?.rentalEstimate?.confidence === "medium"
        ? parsed.domainAvm.rentalEstimate.weeklyRent
        : undefined,
    subjectPropertyType,
  });
}

export function fillLeaseAppraisalCompSelection(
  parsed: ParsedListing,
  preferredIds: string[] = [],
): string[] {
  return canonicalRentalCompSelection(parsed, [
    ...new Set([
      ...preferredIds,
      ...defaultSelectedCompListingIds(parsed),
    ]),
  ]).slice(0, MAX_LEASE_APPRAISAL_FEATURED_COMPS);
}

/** Resolve saved IDs from relistings to the retained property without losing selection. */
export function canonicalRentalCompSelection(parsed: ParsedListing, ids: string[]) {
  const pool = orderLeaseAppraisalCompPool(parsed);
  const byId = buildRentalCompIdLookup(parsed);
  return [...new Set(ids.map(id => {
    const comp = byId.get(id);
    return comp ? rentalCompListingId(comp, pool.indexOf(comp)) : id;
  }))];
}

export function resolveSelectedRentalComps(parsed: ParsedListing) {
  const pool = orderLeaseAppraisalCompPool(parsed);
  const selectedIds = parsed.rentalAppraisal?.selectedCompListingIds;

  if (!selectedIds?.length) {
    return pool.slice(0, MAX_LEASE_APPRAISAL_FEATURED_COMPS);
  }

  const byId = buildRentalCompIdLookup(parsed);
  const seen = new Set<(typeof pool)[number]>();
  const ordered = selectedIds
    .map((id) => byId.get(id))
    .filter((comp): comp is NonNullable<typeof comp> => {
      if (!comp || seen.has(comp)) {
        return false;
      }
      seen.add(comp);
      return true;
    })
    .slice(0, MAX_LEASE_APPRAISAL_FEATURED_COMPS);

  return ordered.length > 0
    ? ordered
    : pool.slice(0, MAX_LEASE_APPRAISAL_FEATURED_COMPS);
}

export function applyLeaseAppraisalRentOverrides(
  parsed: ParsedListing,
  overrides: {
    weeklyMin?: number | null;
    weeklyMax?: number | null;
    weeklyMidpoint?: number | null;
  },
): ParsedListing {
  const appraisal = parsed.rentalAppraisal ?? {};
  return {
    ...parsed,
    rentalAppraisal: {
      ...appraisal,
      weeklyMin: overrides.weeklyMin ?? appraisal.weeklyMin,
      weeklyMax: overrides.weeklyMax ?? appraisal.weeklyMax,
      weeklyMidpoint: overrides.weeklyMidpoint ?? appraisal.weeklyMidpoint,
    },
  };
}

export function applyLeaseAppraisalCompSelection(
  parsed: ParsedListing,
  selectedCompListingIds: string[],
): ParsedListing {
  const unique = canonicalRentalCompSelection(parsed, [
    ...new Set(
      selectedCompListingIds
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ]).slice(0, MAX_LEASE_APPRAISAL_FEATURED_COMPS);

  return {
    ...parsed,
    rentalAppraisal: {
      ...parsed.rentalAppraisal,
      selectedCompListingIds: unique,
      compCount:
        orderLeaseAppraisalCompPool(parsed).length ||
        parsed.rentalAppraisal?.compCount,
      featuredCompCount: unique.length,
    },
  };
}
