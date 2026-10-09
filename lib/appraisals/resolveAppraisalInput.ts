import { z } from "zod";
import { getListingImagePool } from "@/lib/listings/collateralImages";
import type { Listing, ParsedListing } from "@/lib/types";

export type AppraisalKind = "lease" | "sales";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function number(value: unknown) {
  if (value == null || value === "") return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

/** Saved editable fields are authoritative, including deliberately cleared values. */
function subject(listing: Listing): ParsedListing {
  return {
    ...listing.scraped_listing_json,
    address: text(listing.property_address),
    suburb: text(listing.suburb),
    state: text(listing.state)?.toUpperCase(),
    postcode: text(listing.postcode),
    propertyType: text(listing.property_type),
    purpose: listing.listing_purpose,
    bedrooms: number(listing.bedrooms),
    bathrooms: number(listing.bathrooms),
    carSpaces: number(listing.car_spaces),
    title: text(listing.listing_title),
    description: text(listing.listing_description),
    displayPrice: text(listing.display_price),
    images: getListingImagePool(listing),
    agents: listing.scraped_listing_json?.agents ?? [],
    confidence: listing.scraped_listing_json?.confidence ?? "low",
    warnings: listing.scraped_listing_json?.warnings ?? [],
  };
}

const INPUT_FIELDS = [
  "address", "suburb", "state", "postcode", "propertyType", "purpose", "bedrooms",
  "bathrooms", "carSpaces", "title", "description", "displayPrice", "landAreaSqm", "floorAreaSqm",
] as const;

export function appraisalInputFingerprint(listing: Listing) {
  const parsed = subject(listing);
  return JSON.stringify([listing.listing_url ?? null, ...INPUT_FIELDS.map((key) => parsed[key] ?? null)]);
}

function hasChangedLegacySubject(listing: Listing) {
  const stored = listing.scraped_listing_json;
  const current = subject(listing);
  return INPUT_FIELDS.some((key) => stored?.[key] != null && stored[key] !== current[key]);
}

export function hasStaleAppraisal(listing: Listing, kind: AppraisalKind) {
  const stored = listing.scraped_listing_json;
  const fingerprint = stored?.appraisalInputFingerprints?.[kind];
  if (fingerprint) return fingerprint !== appraisalInputFingerprint(listing);
  // Legacy evidence has no fingerprint. Detect corrections to imported subject fields.
  if (!(kind === "lease" ? stored?.rentalAppraisal : stored?.salesAppraisal)) return false;
  return hasChangedLegacySubject(listing);
}

/** A working view only: never persist this over the original imported subject. */
export function resolveAppraisalInput(listing: Listing): ParsedListing {
  const parsed = subject(listing);
  const staleLease = hasStaleAppraisal(listing, "lease");
  const staleSales = hasStaleAppraisal(listing, "sales");
  if (staleLease) {
    delete parsed.rentalAppraisal;
    delete parsed.rentalComps;
    delete parsed.ltrSuburbMarket;
  }
  if (staleSales) {
    delete parsed.salesAppraisal;
    delete parsed.salesComps;
  }
  const avmFingerprint = parsed.domainAvmInputFingerprint;
  const staleAvm = avmFingerprint
    ? avmFingerprint !== appraisalInputFingerprint(listing)
    : staleLease || staleSales || hasChangedLegacySubject(listing);
  if (staleAvm) delete parsed.domainAvm;
  return parsed;
}

const requiredFields = z.object({
  suburb: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postcode: z.string().trim().min(1),
  bedrooms: z.number().int().positive(),
});

export function appraisalInputError(listing: Listing): string | null {
  const result = requiredFields.safeParse(resolveAppraisalInput(listing));
  if (result.success) return null;
  const labels: Record<string, string> = { suburb: "suburb", state: "state", postcode: "postcode", bedrooms: "a valid bedroom count" };
  const missing = result.error.issues.map((issue) => labels[String(issue.path[0])]);
  return `Add ${missing.join(", ")} in property details before fetching comparables.`;
}

export function assertAppraisalInput(listing: Listing) {
  const error = appraisalInputError(listing);
  if (error) throw new Error(error);
}

/** Replace only this appraisal's results; retain imported fields and the other appraisal. */
export function mergeAppraisalResults(listing: Listing, kind: AppraisalKind, result: ParsedListing): ParsedListing {
  const stored: ParsedListing = listing.scraped_listing_json ?? { images: [], agents: [], confidence: "low", warnings: [] };
  const next: ParsedListing = {
    ...stored,
    warnings: result.warnings,
    domainAvm: result.domainAvm,
    domainAvmInputFingerprint: result.domainAvm ? appraisalInputFingerprint(listing) : undefined,
    appraisalInputFingerprints: { ...stored.appraisalInputFingerprints, [kind]: appraisalInputFingerprint(listing) },
  };
  if (kind === "lease") {
    next.rentalAppraisal = result.rentalAppraisal;
    next.rentalComps = result.rentalComps;
    next.ltrSuburbMarket = result.ltrSuburbMarket;
    next.leaseAppraisalEnrichment = result.leaseAppraisalEnrichment;
  } else {
    next.salesAppraisal = result.salesAppraisal;
    next.salesComps = result.salesComps;
    next.salesAppraisalEnrichment = result.salesAppraisalEnrichment;
  }
  return next;
}
