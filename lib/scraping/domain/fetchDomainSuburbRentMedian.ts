import {
  fetchBrightDataHtml,
  hasBrightDataUnlockerConfig,
} from "@/lib/brightdata/client";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { propertyTypeFamily } from "@/lib/rental/computeRentBand";

export type DomainSuburbRentMedian = {
  weeklyRent: number;
  bedrooms: number;
  propertySegment: "house" | "unit" | "other";
  source: "domain_suburb_profile";
  suburbUrl: string;
};

function slugifySuburb(suburb: string, state: string, postcode: string) {
  const suburbSlug = suburb
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${suburbSlug}-${state.trim().toLowerCase()}-${postcode.trim()}`;
}

export function buildDomainSuburbProfileUrl(
  suburb: string,
  state: string,
  postcode: string,
) {
  return `https://www.domain.com.au/suburb-profile/${slugifySuburb(suburb, state, postcode)}`;
}

function parseNextData(html: string): unknown | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

function normalizeSegment(value: unknown): "house" | "unit" | "other" {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("unit") || text.includes("apartment")) {
    return "unit";
  }
  if (text.includes("house") || text.includes("villa") || text.includes("town")) {
    return "house";
  }
  return "other";
}

function coerceWeeklyRent(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 500 ? Math.round(value) : Math.round(value);
  }

  if (typeof value === "string") {
    const digits = value.replace(/[^0-9]/g, "");
    const parsed = Number(digits);
    if (Number.isFinite(parsed) && parsed >= 200 && parsed <= 20_000) {
      return parsed;
    }
  }

  return null;
}

function coerceBedrooms(value: unknown): number | null {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) {
    return Math.round(parsed);
  }
  return null;
}

function rowLooksLikeRentContext(keyPath: string, row: Record<string, unknown>) {
  const path = keyPath.toLowerCase();
  const blob = JSON.stringify(row).toLowerCase();
  if (path.includes("sale") && !path.includes("rent")) {
    return false;
  }
  if (blob.includes("sold") && !blob.includes("rent")) {
    return false;
  }
  return (
    path.includes("rent") ||
    blob.includes("rent") ||
    blob.includes("weekly") ||
    blob.includes("leased")
  );
}

function extractRowsFromObject(
  row: Record<string, unknown>,
  keyPath: string,
  rows: DomainSuburbRentMedian[],
  suburbUrl: string,
) {
  if (!rowLooksLikeRentContext(keyPath, row)) {
    return;
  }

  const bedrooms =
    coerceBedrooms(row.bedrooms) ??
    coerceBedrooms(row.bedroom) ??
    coerceBedrooms(row.bed) ??
    coerceBedrooms(row.bedCount);

  const rent =
    coerceWeeklyRent(row.medianRent) ??
    coerceWeeklyRent(row.medianWeeklyRent) ??
    coerceWeeklyRent(row.medianPrice) ??
    coerceWeeklyRent(row.median) ??
    coerceWeeklyRent(row.price);

  if (bedrooms == null || rent == null) {
    return;
  }

  const segment = normalizeSegment(
    row.propertyType ?? row.type ?? row.category ?? row.propertyCategory,
  );

  rows.push({
    weeklyRent: rent,
    bedrooms,
    propertySegment: segment,
    source: "domain_suburb_profile",
    suburbUrl,
  });
}

function walkForRentRows(
  value: unknown,
  keyPath: string,
  rows: DomainSuburbRentMedian[],
  suburbUrl: string,
  depth = 0,
) {
  if (!value || depth > 12) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        extractRowsFromObject(
          item as Record<string, unknown>,
          keyPath,
          rows,
          suburbUrl,
        );
      }
      walkForRentRows(item, keyPath, rows, suburbUrl, depth + 1);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = keyPath ? `${keyPath}.${key}` : key;
    if (child && typeof child === "object") {
      if (!Array.isArray(child)) {
        extractRowsFromObject(
          child as Record<string, unknown>,
          path,
          rows,
          suburbUrl,
        );
      }
      walkForRentRows(child, path, rows, suburbUrl, depth + 1);
    }
  }
}

export function parseDomainSuburbRentMedians(
  html: string,
  suburbUrl: string,
): DomainSuburbRentMedian[] {
  const nextData = parseNextData(html);
  if (!nextData || typeof nextData !== "object") {
    return [];
  }

  const pageProps =
    (nextData as { props?: { pageProps?: unknown } }).props?.pageProps ?? nextData;

  const rows: DomainSuburbRentMedian[] = [];
  walkForRentRows(pageProps, "pageProps", rows, suburbUrl);

  const deduped = new Map<string, DomainSuburbRentMedian>();
  for (const row of rows) {
    const key = `${row.propertySegment}:${row.bedrooms}`;
    const existing = deduped.get(key);
    if (!existing || row.weeklyRent > 0) {
      deduped.set(key, row);
    }
  }

  return [...deduped.values()];
}

export async function fetchDomainSuburbRentMedian(input: {
  suburb: string;
  state: string;
  postcode: string;
  bedrooms: number;
  propertyType?: string;
}): Promise<DomainSuburbRentMedian | null> {
  const suburbUrl = buildDomainSuburbProfileUrl(
    input.suburb,
    input.state,
    input.postcode,
  );

  let html: string | null = null;

  if (hasBrightDataUnlockerConfig()) {
    try {
      html = await fetchBrightDataHtml(suburbUrl);
    } catch {
      html = null;
    }
  }

  if (!html) {
    try {
      html = await fetchStaticHtml(suburbUrl, 12_000);
    } catch {
      html = null;
    }
  }

  if (!html) {
    return null;
  }

  const rows = parseDomainSuburbRentMedians(html, suburbUrl);
  const subjectFamily = propertyTypeFamily(input.propertyType);
  const segment =
    subjectFamily === "unit"
      ? "unit"
      : subjectFamily === "house"
        ? "house"
        : null;

  const matching = rows.filter((row) => {
    if (row.bedrooms !== input.bedrooms) {
      return false;
    }
    if (!segment || row.propertySegment === "other") {
      return true;
    }
    return row.propertySegment === segment;
  });

  const pool =
    matching.length > 0
      ? matching
      : rows.filter((row) => row.bedrooms === input.bedrooms);

  return pool[0] ?? null;
}
