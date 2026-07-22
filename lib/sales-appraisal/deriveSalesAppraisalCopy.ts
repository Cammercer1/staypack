import { PAGE_ONE_BULLET_COUNT } from "@/lib/copy/pageOneMarketingCopy";
import {
  blurbVariantsParagraphsToStored,
  enforceBlurbVariantsParagraphs,
  variantTextToParagraphs,
} from "@/lib/copy/blurbVariants";
import type { LeaseAppraisalCopy } from "@/lib/lease-appraisal/deriveLeaseAppraisalCopy";
import {
  deriveSaleComparableEvidence,
  SALES_APPRAISAL_COMPARABLE_DISCLAIMER,
} from "@/lib/sales-appraisal/comparableEvidenceCopy";
import type { Agency, Listing, ParsedListing, SaleCompCard } from "@/lib/types";

/** Same page-one copy shape as lease appraisals — templates share the layout. */
export type SalesAppraisalCopy = LeaseAppraisalCopy;

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

  return address || "Property appraisal overview";
}

function pricePositionLine(
  soldCompCount: number,
  forSaleCompCount: number,
  agencyGuideApplied: boolean,
) {
  if (agencyGuideApplied) {
    return `The estimated price range alongside retains the agency’s current marketed guide, reviewed against recent sold results and current competing listings.`;
  }

  if (soldCompCount > 0) {
    return `The estimated price range alongside is drawn from comparable properties sold within the past 12 months and matched to this home's property type, size and location${forSaleCompCount > 0 ? ", with current for-sale listings providing additional market context" : ""}.`;
  }

  if (forSaleCompCount > 0) {
    return `The estimated price range alongside reflects comparable properties currently on the market near this home.`;
  }

  return `Use the estimated price range alongside as a starting point for your selling decision.`;
}

export type DeriveSalesAppraisalCopyInput = {
  agency: Agency;
  listing: Listing;
  parsed: ParsedListing;
  soldCompCount: number;
  forSaleCompCount: number;
  priceMin?: number | null;
  priceMax?: number | null;
  featuredComps?: SaleCompCard[];
};

export function deriveSalesAppraisalCopy({
  agency,
  listing,
  parsed,
  soldCompCount,
  forSaleCompCount,
  priceMin = null,
  priceMax = null,
  featuredComps = [],
}: DeriveSalesAppraisalCopyInput): SalesAppraisalCopy {
  const descriptionLead = firstSentences(
    parsed.description ?? listing.listing_description ?? "",
    2,
    280,
  );

  const propertyLead =
    descriptionLead ||
    `A ${listing.bedrooms ?? parsed.bedrooms ?? ""}-bedroom ${(listing.property_type ?? parsed.propertyType ?? "property").toLowerCase()} in ${listing.suburb ?? parsed.suburb ?? "the local market"}, well placed to attract strong buyer interest.`.replace(
      /\s+/g,
      " ",
    );

  const priceLine = pricePositionLine(
    soldCompCount,
    forSaleCompCount,
    Boolean(parsed.salesAppraisal?.agencyGuide),
  );
  const marketLine =
    soldCompCount > 0
      ? `Recent sold results nearby demonstrate active buyer demand for comparable homes in the area.`
      : "";

  const blurbBody = [propertyLead, priceLine, marketLine].filter(Boolean).join(" ");
  const blurb_variants = blurbVariantsParagraphsToStored(
    enforceBlurbVariantsParagraphs({
      short: variantTextToParagraphs(blurbBody).slice(0, 1).length
        ? variantTextToParagraphs(blurbBody).slice(0, 1)
        : [blurbBody],
      medium: (() => {
        const parts = variantTextToParagraphs(blurbBody);
        if (parts.length >= 2) return parts.slice(0, 2);
        return [parts[0] ?? blurbBody, priceLine || ""];
      })(),
      long: (() => {
        const parts = variantTextToParagraphs(blurbBody);
        if (parts.length >= 3) return parts.slice(0, 3);
        return [propertyLead || blurbBody, priceLine || "", marketLine || ""];
      })(),
    }),
  );
  const blurb = blurb_variants.medium || blurbBody;

  const suburb = listing.suburb ?? parsed.suburb ?? "the area";
  const appeal_points = [
    propertyLead || `Well-located ${(listing.property_type ?? parsed.propertyType ?? "property").toLowerCase()} in ${suburb}.`,
    priceLine || "Price range informed by recently sold comparable properties nearby.",
    marketLine || "Local sold results support current buyer demand.",
    "Confirm presentation, campaign strategy and timing when finalising the asking price.",
  ].slice(0, PAGE_ONE_BULLET_COUNT);

  const comparable_evidence = deriveSaleComparableEvidence({
    suburb: listing.suburb ?? parsed.suburb,
    bedrooms: listing.bedrooms ?? parsed.bedrooms,
    bathrooms: listing.bathrooms ?? parsed.bathrooms,
    carSpaces: listing.car_spaces ?? parsed.carSpaces,
    propertyType: listing.property_type ?? parsed.propertyType,
    description: parsed.description ?? listing.listing_description ?? "",
    soldCompCount,
    forSaleCompCount,
    priceMin,
    priceMax,
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
      "Confirm presentation, styling and campaign inclusions when setting the asking price.",
      "Allow for marketing costs, agent fees and settlement timing when planning the sale.",
    ],
    methodology_note: parsed.salesAppraisal?.agencyGuide
      ? "The agency’s current marketed guide is retained as the estimated sale price range and reviewed against same-property-type comparables sold within the past 12 months. Current for-sale listings provide additional context; comparable evidence is shown on page 2."
      : "Estimated sale price range from same-property-type REA comparables sold within the past 12 months, matched on beds, baths and parking. The search expands to nearby areas when local evidence is limited; current for-sale listings provide context only. Outliers trimmed; comparable evidence shown on page 2.",
    disclaimer:
      agency.default_disclaimer ??
      "This appraisal is indicative only and does not constitute financial, legal or valuation advice. Vendors should make their own enquiries.",
    comparable_evidence,
    comparable_disclaimer: SALES_APPRAISAL_COMPARABLE_DISCLAIMER,
    cta: agency.default_cta || "Contact us to discuss the sales strategy for your property.",
  };
}
