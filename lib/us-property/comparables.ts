import { z } from "zod";
import { MAX_STORED_COMPARABLES } from "@/lib/comparables/discoveryPolicy";
import { soldCompCutoff } from "@/lib/sales/saleCompFreshness";
import type { ParsedListing } from "@/lib/types";
import { fetchUsPropertyData } from "./client";
import { matchesUsAddress, normaliseUsStreet } from "./normalise";
import type { UsComparableMatch, UsComparableSearch } from "./comparableTypes";

const DAY = 86400000;
const TARGET = 25;
const MINIMUM = 20;
const PAGE_SIZE = 41;
const PAGES_PER_AREA = 3;
const RADII_MILES = [1, 3, 5];
const SEARCH_BUDGET_MS = 60000;
const pointSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
const compSchema = z.object({
  zpid: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform(String),
  currency: z.literal("USD"), country: z.enum(["US", "USA"]),
  streetAddress: z.string().trim().min(1), city: z.string(), state: z.string(), zipcode: z.string(),
  homeStatus: z.string(), homeType: z.string(), price: z.number().positive(),
  bedrooms: z.number().int().nonnegative(), bathrooms: z.number().nonnegative().nullish(),
  dateSold: z.number().positive().nullish(), livingArea: z.number().nonnegative().nullish(),
  latitude: z.number().min(-90).max(90).nullish(), longitude: z.number().min(-180).max(180).nullish(),
  detailUrl: z.string().url(), imgSrc: z.string().nullish(),
  isUndisclosedAddress: z.boolean().optional(), shouldShowZestimateAsPrice: z.boolean().optional(),
  isRoomForRent: z.boolean().optional(), spaceType: z.string().optional(), statusText: z.string().optional(),
});
export const usHomeType = (type?: string) => /town/i.test(type ?? "") ? "TOWNHOUSE"
  : /apartment|unit|condo/i.test(type ?? "") ? "CONDO"
    : /house|single/i.test(type ?? "") ? "SINGLE_FAMILY" : null;

export function hasMatchingUsProfile(subject: ParsedListing) {
  const address = subject.usProperty?.address;
  return !!address && matchesUsAddress(subject, { address: address.streetAddress, state: address.state, postcode: address.zipcode });
}

function subjectPoint(subject: ParsedListing) {
  const parsed = pointSchema.safeParse(hasMatchingUsProfile(subject) ? subject.usProperty?.raw : null);
  return parsed.success ? parsed.data : undefined;
}

function distanceMiles(a: z.infer<typeof pointSchema>, b: z.infer<typeof pointSchema>) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export type UsComparable = z.infer<typeof compSchema> & { match: UsComparableMatch; raw: Record<string, unknown> };

/** Only same-type, same-bedroom homes qualify; widening never mixes price evidence. */
export function normaliseUsComparables(raw: unknown, subject: ParsedListing, kind: "lease" | "sales", now = Date.now(), radiusMiles = 5): UsComparable[] {
  const point = subjectPoint(subject);
  const seenIds = new Set<string>();
  const seenAddresses = new Set<string>();
  return (Array.isArray(raw) ? raw : []).flatMap((row): UsComparable[] => {
    const result = compSchema.safeParse(row);
    if (!result.success) return [];
    const c = result.data;
    const street = normaliseUsStreet(c.streetAddress);
    const identity = `${street}|${c.state}|${c.zipcode.slice(0, 5)}`;
    if (seenIds.has(c.zpid) || seenAddresses.has(identity) || c.zpid === subject.usProperty?.zpid ||
      c.state !== subject.state || c.bedrooms !== subject.bedrooms || !usHomeType(subject.propertyType) ||
      c.homeType !== usHomeType(subject.propertyType) || street === normaliseUsStreet(subject.address ?? "") ||
      c.homeStatus !== (kind === "lease" ? "FOR_RENT" : "RECENTLY_SOLD") ||
      c.isUndisclosedAddress || c.shouldShowZestimateAsPrice ||
      !/^https:\/\/(www\.)?zillow\.com\//.test(c.detailUrl)) return [];
    if (kind === "lease" && (c.isRoomForRent || c.spaceType === "ROOM" || /room for rent/i.test(c.statusText ?? ""))) return [];
    const dateSold = c.dateSold == null ? undefined : c.dateSold < 1e11 ? c.dateSold * 1000 : c.dateSold;
    const ageDays = dateSold == null ? undefined : (now - dateSold) / DAY;
    if (kind === "sales" && (ageDays == null || ageDays < 0 || dateSold! < soldCompCutoff(new Date(now)).getTime())) return [];
    const compPoint = pointSchema.safeParse(c);
    const distance = point && compPoint.success ? distanceMiles(point, compPoint.data) : undefined;
    // A ZIP match is the conservative fallback when the subject has no verified coordinates.
    if (point ? distance == null || distance > radiusMiles : !subject.postcode || c.zipcode.slice(0, 5) !== subject.postcode.slice(0, 5)) return [];
    const bathDifference = subject.bathrooms != null && c.bathrooms != null ? Math.abs(subject.bathrooms - c.bathrooms) : undefined;
    const floorAreaSqm = c.livingArea ? c.livingArea * 0.09290304 : undefined;
    const areaRatio = subject.floorAreaSqm && floorAreaSqm ? floorAreaSqm / subject.floorAreaSqm : undefined;
    if ((bathDifference != null && bathDifference > 1) || (areaRatio != null && (areaRatio < 0.5 || areaRatio > 1.75))) return [];
    const notes = [
      ...(distance == null ? ["Distance unavailable; same ZIP code"] : distance > 1 ? ["Expanded search area"] : []),
      ...(c.bathrooms == null ? ["Bathroom count unavailable"] : bathDifference ? [`${c.bathrooms} bathrooms; subject has ${subject.bathrooms}`] : []),
      ...(!floorAreaSqm ? ["Floor area unavailable"] : areaRatio != null && Math.abs(areaRatio - 1) > 0.3 ? ["Floor area differs by more than 30%"] : []),
      ...(kind === "sales" && ageDays! > 183 ? ["Sold more than six months ago"] : []),
    ];
    const score = Math.max(0, Math.round((100 - (distance == null ? 20 : distance * 4) -
      (bathDifference == null ? 10 : bathDifference * 10) - (areaRatio == null ? 15 : Math.abs(areaRatio - 1) * 40) -
      (kind === "sales" ? ageDays! / 365 * 10 : 0)) * 10) / 10);
    seenIds.add(c.zpid);
    seenAddresses.add(identity);
    return [{ ...c, dateSold, match: { score, distanceMiles: distance == null ? undefined : Math.round(distance * 100) / 100, notes }, raw: row as Record<string, unknown> }];
  }).sort((a, b) => b.match.score - a.match.score ||
    (a.match.distanceMiles ?? Infinity) - (b.match.distanceMiles ?? Infinity) ||
    (b.dateSold ?? 0) - (a.dateSold ?? 0) || a.zpid.localeCompare(b.zpid));
}

export async function discoverUsComparables(subject: ParsedListing, kind: "lease" | "sales") {
  const now = Date.now();
  const deadline = now + SEARCH_BUDGET_MS;
  const point = subjectPoint(subject);
  const type = usHomeType(subject.propertyType);
  const rows = new Map<string, unknown>();
  let comps: UsComparable[] = [];
  const search: UsComparableSearch = {
    kind, observedAt: new Date(now).toISOString(), targetCount: TARGET, minimumCount: MINIMUM,
    returnedCount: 0, reviewedCount: 0, requestCount: 0, targetMet: false,
    stopReason: "coverage_limit", rawComparables: [],
  };
  if ((!point && !subject.postcode) || subject.bedrooms == null || !type || !subject.state) {
    search.stopReason = "missing_subject";
    return { comps, search };
  }
  const params: Record<string, string> = {
    home_status: kind === "lease" ? "FOR_RENT" : "RECENTLY_SOLD",
    home_type: type === "SINGLE_FAMILY" ? "HOUSES" : type === "TOWNHOUSE" ? "TOWNHOMES" : kind === "lease" ? "APARTMENTS_CONDOS_COOPS" : "CONDOS_COOPS",
    // This API rejects equal min/max bounds. Enforce the exact count locally.
    min_bedrooms: String(Math.max(0, subject.bedrooms - 1)), max_bedrooms: String(subject.bedrooms + 1),
    sort: "NEWEST", ...(kind === "lease" ? { space_type: "ENTIRE_PLACE" } : {}),
  };
  searchAreas: for (const radius of point ? RADII_MILES : [undefined]) {
    const areaIds = new Set<string>();
    search.radiusMiles = radius;
    for (let page = 1; page <= PAGES_PER_AREA; page++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { search.stopReason = "time_limit"; break searchAreas; }
      let raw: unknown;
      try {
        search.requestCount++;
        raw = await fetchUsPropertyData(point ? "search-coordinates" : "search", {
          ...params, ...(point ? { lat: String(point.latitude), long: String(point.longitude), diameter: String(radius! * 2) }
            : { location: subject.postcode!.slice(0, 5) }), page: String(page),
        }, { timeoutMs: Math.min(25000, remaining) });
        if (!Array.isArray(raw)) throw new Error("Invalid comparable response");
      } catch {
        search.stopReason = Date.now() >= deadline ? "time_limit" : "request_failed";
        break searchAreas; // Retain earlier pages and stop retrying on quota/provider failure.
      }
      let newInArea = 0;
      for (const row of raw as unknown[]) {
        const id = row && typeof row === "object" && "zpid" in row ? String(row.zpid) : null;
        if (!id) continue;
        if (!areaIds.has(id)) { areaIds.add(id); newInArea++; }
        if (!rows.has(id)) rows.set(id, row);
      }
      comps = normaliseUsComparables([...rows.values()], subject, kind, now, radius);
      if (comps.length >= TARGET) { search.stopReason = "target_met"; break searchAreas; }
      if ((raw as unknown[]).length < PAGE_SIZE || newInArea === 0) break;
    }
    if (comps.length >= MINIMUM) { search.stopReason = "target_met"; break; }
  }
  comps = comps.slice(0, MAX_STORED_COMPARABLES);
  search.returnedCount = comps.length;
  search.reviewedCount = rows.size;
  search.targetMet = comps.length >= MINIMUM;
  search.rawComparables = comps.map((comp) => comp.raw);
  return { comps, search };
}
