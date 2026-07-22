import {
  hasApifyReaConfig,
  scrapeApifyReaListingUrls,
} from "@/lib/apify/client";
import type { ApifyReaListingRecord } from "@/lib/apify/types";
import type { SaleComp } from "@/lib/sales/types";
import { saleCompListingId } from "@/lib/sales-appraisal/saleCompIds";
import {
  resolveReaFloorAreaSqm,
  resolveReaLandAreaSqm,
  resolveReaSoldDate,
} from "@/lib/scraping/rea/parseReaPropertyFacts";

type ReaDetailRecord = ApifyReaListingRecord;

function parseCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function recordPropertyType(record: ReaDetailRecord) {
  const raw = record as Record<string, unknown>;
  const value = raw.propertyType ?? raw.property_type ?? raw.house_type;
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function recordCarSpaces(record: ReaDetailRecord) {
  const raw = record as Record<string, unknown>;
  return parseCount(raw.carSpaces ?? raw.parking);
}

function normalizeAddress(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function listingNumber(value?: string) {
  if (!value) return undefined;
  const match = value.match(/(?:-|\/)(\d{6,})(?:\?.*)?$/);
  return match?.[1];
}

function recordUrl(record: ReaDetailRecord) {
  return record.url;
}

function recordListingNumber(record: ReaDetailRecord) {
  if ("listingId" in record && record.listingId) {
    return String(record.listingId);
  }
  return listingNumber(recordUrl(record));
}

function recordAddress(record: ReaDetailRecord) {
  const raw = record as Record<string, unknown>;
  const street =
    typeof raw.address === "string"
      ? raw.address
      : typeof raw.street_address === "string"
        ? raw.street_address
        : undefined;
  const suburb = typeof raw.suburb === "string" ? raw.suburb : undefined;
  return normalizeAddress(
    [street, suburb].filter(Boolean).join(", "),
  );
}

function recordsForComp(records: ReaDetailRecord[], comp: SaleComp) {
  const compNumber = listingNumber(comp.listingUrl);
  const address = normalizeAddress(comp.address);
  return records.filter((record) => {
    if (compNumber && recordListingNumber(record) === compNumber) return true;
    return Boolean(address && recordAddress(record) === address);
  });
}

export function mergeSaleCompDetailRecord(
  comp: SaleComp,
  record: ReaDetailRecord | undefined,
): SaleComp {
  if (!record) return comp;

  return {
    ...comp,
    soldDate:
      comp.saleStatus === "sold"
        ? resolveReaSoldDate(record) ?? comp.soldDate
        : undefined,
    landAreaSqm: resolveReaLandAreaSqm(record) ?? comp.landAreaSqm,
    floorAreaSqm: resolveReaFloorAreaSqm(record) ?? comp.floorAreaSqm,
    carSpaces: recordCarSpaces(record) ?? comp.carSpaces,
    propertyType: recordPropertyType(record) ?? comp.propertyType,
  };
}

async function fetchDetailRecords(urls: string[]): Promise<ReaDetailRecord[]> {
  if (!hasApifyReaConfig()) return [];
  return scrapeApifyReaListingUrls(urls);
}

/** Bounded detail-page pass for the featured sales comparables only. */
export async function enrichSelectedSaleCompDetails(
  comps: SaleComp[],
  selectedCompListingIds: string[],
): Promise<SaleComp[]> {
  const selectedIds = new Set(selectedCompListingIds);
  const selected = comps.filter((comp, index) =>
    selectedIds.has(saleCompListingId(comp, index)),
  );
  const urls = [
    ...new Set(
      selected
        .map((comp) => comp.listingUrl?.trim())
        .filter((url): url is string => Boolean(url)),
    ),
  ];

  if (urls.length === 0) return comps;

  const records = await fetchDetailRecords(urls);
  if (records.length === 0) return comps;

  return comps.map((comp, index) => {
    if (!selectedIds.has(saleCompListingId(comp, index))) return comp;
    const matchingRecords = recordsForComp(records, comp);
    return matchingRecords.reduce(mergeSaleCompDetailRecord, comp);
  });
}
