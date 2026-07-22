import { PAGE_ONE_BULLET_COUNT } from "@/lib/copy/pageOneMarketingCopy";
import {
  blurbVariantsParagraphsToStored,
  enforceBlurbVariantsParagraphs,
  variantTextToParagraphs,
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

function rentPositionLine(
  weeklyMid: number | null,
  market: LtrSuburbMarketJson | null | undefined,
  compCount: number,
) {
  const median = market?.median_weekly_rent;
  if (weeklyMid != null && median != null && median > 0) {
    const pct = Math.round(((weeklyMid - median) / median) * 100);
    if (Math.abs(pct) >= 8) {
      const dir = pct > 0 ? "above" : "below";
      const segment = market?.property_segment === "unit" ? "unit" : "house";
      return `Compared with similar leases in the area, this sits ${dir} the typical suburb ${segment} rent. See the weekly guide in the panel alongside for the suggested range.`;
    }
  }

  if (compCount > 0) {
    return `The weekly rent guide alongside is drawn from active comparable listings matched to this property’s size and location.`;
  }

  return `Use the weekly rent guide alongside as a starting point for your leasing decision.`;
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
  rentRangeLabel: _rentRangeLabel,
  weeklyMin = null,
  weeklyMax = null,
  weeklyMid = null,
  suburbMarket = null,
  featuredComps = [],
}: DeriveLeaseAppraisalCopyInput): LeaseAppraisalCopy {
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

  const rentLine = rentPositionLine(weeklyMid, suburbMarket, compCount);
  const suburbLine = suburbContextLine(suburbMarket ?? parsed.ltrSuburbMarket);

  const blurbBody = [propertyLead, rentLine, suburbLine].filter(Boolean).join(" ");
  const blurb_variants = blurbVariantsParagraphsToStored(
    enforceBlurbVariantsParagraphs({
      short: variantTextToParagraphs(blurbBody).slice(0, 1).length
        ? variantTextToParagraphs(blurbBody).slice(0, 1)
        : [blurbBody],
      medium: (() => {
        const parts = variantTextToParagraphs(blurbBody);
        if (parts.length >= 2) return parts.slice(0, 2);
        return [parts[0] ?? blurbBody, rentLine || ""];
      })(),
      long: (() => {
        const parts = variantTextToParagraphs(blurbBody);
        if (parts.length >= 3) return parts.slice(0, 3);
        return [propertyLead || blurbBody, rentLine || "", suburbLine || ""];
      })(),
    }),
  );
  const blurb = blurb_variants.medium || blurbBody;

  const suburb = listing.suburb ?? parsed.suburb ?? "the area";
  const appeal_points = [
    propertyLead || `Well-located ${(listing.property_type ?? parsed.propertyType ?? "property").toLowerCase()} in ${suburb}.`,
    rentLine || "Rent range informed by comparable lease listings nearby.",
    suburbLine || "Suburb rental fundamentals support long-term leasing demand.",
    "Confirm inclusions, condition and letting strategy when finalising rent.",
  ].slice(0, PAGE_ONE_BULLET_COUNT);

  const comparable_evidence = deriveComparableEvidence({
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
    methodology_note:
      "Weekly rent range from comparable REA lease listings matched on beds, baths and parking. Suburb metrics from PropRadar. Outliers trimmed; median and interquartile range shown on page 2.",
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
