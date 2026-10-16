import { marketForCountry } from "@/lib/property-market";
import { PAGE_ONE_BULLET_COUNT } from "@/lib/copy/pageOneMarketingCopy";
import { appraisalGuideCopy } from "@/lib/copy/appraisalGuideCopy";
import {
  blurbVariantsParagraphsToStored,
  enforceBlurbVariantsParagraphs,
} from "@/lib/copy/blurbVariants";
import type { BlurbVariantsStored } from "@/lib/copy/blurbVariantConstants";
import {
  deriveComparableEvidence,
  LEASE_APPRAISAL_COMPARABLE_DISCLAIMER,
} from "@/lib/lease-appraisal/comparableEvidenceCopy";
import { resolveLeaseAppraisalDisclaimer } from "@/lib/lease-appraisal/leaseAppraisalDisclaimer";
import type { Agency, Listing, LtrRentalCompCard, LtrSuburbMarketJson, ParsedListing } from "@/lib/types";

export type LeaseAppraisalCopy = {
  heading: string;
  blurb: string;
  blurb_variants?: BlurbVariantsStored;
  key_metrics_line: string;
  appeal_points: string[];
  supporting_factors: string[];
  buyer_checks: string[];
  methodology_note: string;
  disclaimer: string;
  /** Page 2 — narrative under comparable listings (two paragraphs, blank-line separated). */
  comparable_evidence: string;
  /** Page 2 — fine print under comparable narrative. */
  comparable_disclaimer: string;
  cta: string;
};

function stripHtml(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentences(text: string, maxSentences = 2, maxChars = 340) {
  const cleaned = stripHtml(text);
  if (!cleaned) {
    return "";
  }

  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const joined = parts.slice(0, maxSentences).join(" ").trim();

  if (joined.length <= maxChars) {
    return joined;
  }

  return `${joined.slice(0, maxChars - 1).trim()}…`;
}

function deriveHeading(listing: Listing, parsed: ParsedListing) {
  const title = parsed.title?.trim() || listing.listing_title?.trim();
  const address = listing.property_address?.trim() || parsed.address?.trim();

  if (title && address && title.toLowerCase() !== address.toLowerCase()) {
    const cleaned = title.replace(/\s*[-|–]\s*realestate\.com\.au.*$/i, "").trim();
    return cleaned.length > 110 ? `${cleaned.slice(0, 107)}…` : cleaned;
  }

  const fromDescription = firstSentences(parsed.description ?? "", 1, 100);
  if (fromDescription && fromDescription.length > 28) {
    return fromDescription;
  }

  const beds = listing.bedrooms ?? parsed.bedrooms;
  const type = listing.property_type ?? parsed.propertyType ?? "property";
  const suburb = listing.suburb ?? parsed.suburb ?? "the area";

  if (beds) {
    return `${beds}-bedroom ${type.toLowerCase()} · ${suburb}`;
  }

  return address || "Investment property overview";
}

function formatPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function suburbContextLine(market: LtrSuburbMarketJson | null | undefined) {
  if (!market) {
    return "";
  }

  const parts: string[] = [];
  const segment = market.property_segment === "unit" ? "units" : "houses";
  const yieldPct = formatPct(market.gross_yield_pct);
  const vacancy = formatPct(market.vacancy_rate_pct);
  const renters = formatPct(market.renter_pct);

  if (yieldPct && vacancy) {
    parts.push(
      `Suburb fundamentals for ${segment}: ~${yieldPct} gross yield and ${vacancy} vacancy`,
    );
  } else if (yieldPct) {
    parts.push(`Suburb gross yield for ${segment} is about ${yieldPct}`);
  }

  if (renters) {
    parts.push(`${renters} of residents rent locally`);
  }

  return parts.length ? `${parts.join("; ")}.` : "";
}

export type DeriveLeaseAppraisalCopyInput = {
  agency: Agency;
  listing: Listing;
  parsed: ParsedListing;
  compCount: number;
  rentRangeLabel: string;
  weeklyMin?: number | null;
  weeklyMax?: number | null;
  weeklyMid?: number | null;
  suburbMarket?: LtrSuburbMarketJson | null;
  featuredComps?: LtrRentalCompCard[];
};

export function deriveLeaseAppraisalCopy({
  agency,
  listing,
  parsed,
  compCount,
  weeklyMin = null,
  weeklyMax = null,
  suburbMarket = null,
  featuredComps = [],
}: DeriveLeaseAppraisalCopyInput): LeaseAppraisalCopy {
  const us = marketForCountry(listing.country).country === "US";
  const descriptionLead = firstSentences(
    parsed.description ?? listing.listing_description ?? "",
    2,
    280,
  );

  const propertyLead =
    descriptionLead ||
    `A ${listing.bedrooms ?? parsed.bedrooms ?? ""}-bedroom ${(listing.property_type ?? parsed.propertyType ?? "property").toLowerCase()} in ${listing.suburb ?? parsed.suburb ?? "the local market"}, positioned for long-term rental income.`.replace(
      /\s+/g,
      " ",
    );

  const guide = appraisalGuideCopy("lease", listing, parsed);
  const rentLine = guide.description;
  const suburbLine = suburbContextLine(suburbMarket ?? parsed.ltrSuburbMarket);

  const blurb_variants = blurbVariantsParagraphsToStored(
    enforceBlurbVariantsParagraphs({
      short: [propertyLead],
      medium: [propertyLead, [rentLine, suburbLine].filter(Boolean).join(" ")],
      long: [propertyLead, rentLine, suburbLine || "Review the property’s condition, inclusions and comparable evidence with the agent before setting the rent."],
    }),
  );
  const blurb = blurb_variants.medium || propertyLead;

  const suburb = listing.suburb ?? parsed.suburb ?? "the area";
  const appeal_points = [
    propertyLead || `Well-located ${(listing.property_type ?? parsed.propertyType ?? "property").toLowerCase()} in ${suburb}.`,
    rentLine || "Rent range informed by comparable lease listings nearby.",
    suburbLine || (us ? "Review local demand, condition and inclusions before setting the rent." : "Suburb rental fundamentals support long-term leasing demand."),
    "Confirm inclusions, condition and letting strategy when finalising rent.",
  ].slice(0, PAGE_ONE_BULLET_COUNT);

  const comparable_evidence = us ? `${compCount} matching active rental listings are available for review. Advertised monthly asking rents are in USD and are not evidence of executed leases. The subject guide reflects the available automated estimate or your appraisal override; it is not a guaranteed achievable rent.` : deriveComparableEvidence({
    suburb: listing.suburb ?? parsed.suburb,
    bedrooms: listing.bedrooms ?? parsed.bedrooms,
    bathrooms: listing.bathrooms ?? parsed.bathrooms,
    carSpaces: listing.car_spaces ?? parsed.carSpaces,
    propertyType: listing.property_type ?? parsed.propertyType,
    description: parsed.description ?? listing.listing_description ?? "",
    compCount,
    weeklyMin,
    weeklyMax,
    featuredComps,
  });

  return {
    heading: deriveHeading(listing, parsed),
    blurb,
    blurb_variants,
    key_metrics_line: "",
    appeal_points,
    supporting_factors: [],
    buyer_checks: [
      "Confirm body corporate, furnishing and inclusions when setting achievable rent.",
      "Allow for vacancy, letting fees and condition when underwriting cashflow.",
    ],
    methodology_note: guide.methodology,
    disclaimer: resolveLeaseAppraisalDisclaimer(agency.default_disclaimer),
    comparable_evidence,
    comparable_disclaimer: LEASE_APPRAISAL_COMPARABLE_DISCLAIMER,
    cta: agency.default_cta || "Contact us to discuss leasing strategy for this asset.",
  };
}

export function mergeRentRangeIntoCopy(
  copy: LeaseAppraisalCopy,
  weeklyMin: number | null,
  weeklyMax: number | null,
): LeaseAppraisalCopy {
  if (weeklyMin == null || weeklyMax == null) {
    return copy;
  }

  return copy;
}
