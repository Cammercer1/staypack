import { resolveSalesAppraisalDisclaimer } from "./salesAppraisalDisclaimer";
import { marketForCountry } from "@/lib/property-market";
import { PAGE_ONE_BULLET_COUNT } from "@/lib/copy/pageOneMarketingCopy";
import { appraisalGuideCopy } from "@/lib/copy/appraisalGuideCopy";
import {
  blurbVariantsParagraphsToStored,
  enforceBlurbVariantsParagraphs,
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

  const parts = (cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned]).map(part => part.trim());
  const sentences: string[] = [];
  for (const part of parts.slice(0, maxSentences)) {
    if ([...sentences, part].join(" ").length > maxChars) break;
    sentences.push(part);
  }
  if (sentences.length) return sentences.join(" ");

  // Only shorten when the first sentence alone cannot fit, and never split a word.
  const prefix = parts[0]!.slice(0, maxChars - 1);
  const boundary = prefix.lastIndexOf(" ");
  return boundary > 0 ? `${prefix.slice(0, boundary).trimEnd()}…` : "";
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
  const us = marketForCountry(listing.country).country === "US";
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

  const guide = appraisalGuideCopy("sales", listing, parsed);
  const priceLine = guide.description;
  const marketLine =
    soldCompCount > 0
      ? `Recent sold results nearby demonstrate active buyer demand for comparable homes in the area.`
      : "";

  const blurb_variants = blurbVariantsParagraphsToStored(
    enforceBlurbVariantsParagraphs({
      short: [propertyLead],
      medium: [propertyLead, [priceLine, marketLine].filter(Boolean).join(" ")],
      long: [propertyLead, priceLine, marketLine || "Review the property’s condition and comparable evidence with the agent before setting an asking price."],
    }),
  );
  const blurb = blurb_variants.medium || propertyLead;

  const suburb = listing.suburb ?? parsed.suburb ?? "the area";
  const appeal_points = [
    propertyLead || `Well-located ${(listing.property_type ?? parsed.propertyType ?? "property").toLowerCase()} in ${suburb}.`,
    priceLine || "Price range informed by recently sold comparable properties nearby.",
    marketLine || "Local sold results support current buyer demand.",
    "Confirm presentation, campaign strategy and timing when finalising the asking price.",
  ].slice(0, PAGE_ONE_BULLET_COUNT);

  const comparable_evidence = us ? `${soldCompCount} matching sold properties from the past 18 months are available for review. Prices are in USD. The subject guide uses the available current automated estimate or your appraisal override. A historic sale price is not a current valuation.` : deriveSaleComparableEvidence({
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
    methodology_note: guide.methodology,
    disclaimer: resolveSalesAppraisalDisclaimer(agency.default_disclaimer),
    comparable_evidence,
    comparable_disclaimer: SALES_APPRAISAL_COMPARABLE_DISCLAIMER,
    cta: agency.default_cta || "Contact us to discuss the sales strategy for your property.",
  };
}
