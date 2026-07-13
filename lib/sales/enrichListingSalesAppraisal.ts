import {
  getApifyReaMaxListings,
  hasApifyReaConfig,
  scrapeApifyReaRentSearch,
} from "@/lib/apify/client";
import {
  hasBrightDataReaConfig,
  scrapeBrightDataReaRentDiscover,
} from "@/lib/brightdata/client";
import { detectPremiumRentSubject } from "@/lib/rental/detectPremiumRentSubject";
import { parseListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import {
  MIN_RENT_COMPS_FOR_BAND,
  MIN_SAME_SUBURB_COMPS_FOR_DISCOVER,
  TARGET_RENT_COMPS_FOR_BAND,
} from "@/lib/rental/rentCompThresholds";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import {
  buildSaleDiscoverAttemptsForChannel,
  type SaleDiscoverAttempt,
} from "@/lib/sales/buildSaleDiscoverAttempts";
import type { ReaSaleChannel } from "@/lib/sales/buildReaSaleSearchUrl";
import {
  computeSalePriceBandFromComps,
  formatSalePriceRange,
  MIN_SALE_COMPS_FOR_BAND,
} from "@/lib/sales/computeSalePriceBand";
import { mergeSaleComps } from "@/lib/sales/mergeSaleComps";
import { parseApifyReaSaleListings } from "@/lib/sales/parseApifyReaSaleListings";
import { parseReaSaleDiscoverRecords } from "@/lib/sales/parseReaSaleDiscover";
import {
  positionSalesAppraisal,
  saleSubjectFromParsedListing,
} from "@/lib/sales/positionSalesAppraisal";
import {
  countSameSuburbSaleComps,
  filterSaleCompsForSubjectType,
  matchesSaleSubjectPropertyType,
  rankSaleCompsForSubject,
} from "@/lib/sales/rankSaleCompsForSubject";
import type { SaleComp } from "@/lib/sales/types";
import { defaultSelectedSaleCompListingIds } from "@/lib/sales-appraisal/salesAppraisalData";
import type { ParsedListing } from "@/lib/types";

export type EnrichSalesAppraisalOptions = {
  /** Override SERP URLs per channel (for tests). */
  soldSearchUrl?: string;
  buySearchUrl?: string;
  limitPages?: number;
};

const MIN_SOLD_COMPS_FOR_BAND = MIN_SALE_COMPS_FOR_BAND;

function hasSaleDiscoverConfig() {
  return hasApifyReaConfig() || hasBrightDataReaConfig();
}

function pushUniqueWarning(warnings: string[], message: string) {
  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}

function hasMinimumFields(listing: ParsedListing) {
  return Boolean(
    listing.suburb?.trim() &&
      listing.state?.trim() &&
      listing.postcode?.trim() &&
      listing.bedrooms != null &&
      listing.bedrooms > 0,
  );
}

function orderSaleCompsForListing(
  comps: SaleComp[],
  listing: ParsedListing,
): SaleComp[] {
  const subjectPropertyType = resolveRentSubjectPropertyType(listing);
  const eligible = filterSaleCompsForSubjectType(comps, subjectPropertyType);
  return rankSaleCompsForSubject(eligible, {
    suburb: listing.suburb,
    bedrooms: listing.bedrooms ?? undefined,
    bathrooms: listing.bathrooms ?? undefined,
    subjectPropertyType,
  });
}

function countTypeMatchedComps(comps: SaleComp[], subjectPropertyType?: string) {
  if (!subjectPropertyType?.trim()) {
    return comps.length;
  }
  return comps.filter((comp) =>
    matchesSaleSubjectPropertyType(comp, subjectPropertyType),
  ).length;
}

function countSameSuburbTypeMatchedComps(
  comps: SaleComp[],
  suburb: string | undefined,
  subjectPropertyType?: string,
) {
  const pool = subjectPropertyType?.trim()
    ? comps.filter((comp) =>
        matchesSaleSubjectPropertyType(comp, subjectPropertyType),
      )
    : comps;
  return countSameSuburbSaleComps(pool, suburb);
}

type SaleChannelDiscoverResult = {
  comps: SaleComp[];
  searchUrl: string;
  attemptLabel: string;
  provider: "apify" | "brightdata";
};

async function fetchSaleCompsForSearchUrl(
  searchUrl: string,
  channel: ReaSaleChannel,
  options?: EnrichSalesAppraisalOptions,
): Promise<{ comps: SaleComp[]; provider: "apify" | "brightdata" }> {
  if (hasApifyReaConfig()) {
    try {
      const records = await scrapeApifyReaRentSearch({
        searchUrl,
        maxItems: getApifyReaMaxListings(),
      });
      return { comps: parseApifyReaSaleListings(records, channel), provider: "apify" };
    } catch (error) {
      if (!hasBrightDataReaConfig()) {
        throw error;
      }
    }
  }

  const records = await scrapeBrightDataReaRentDiscover({
    searchUrl,
    limitPages: options?.limitPages ?? 1,
  });
  return {
    comps: parseReaSaleDiscoverRecords(records, channel),
    provider: "brightdata",
  };
}

async function discoverSaleCompsForChannel(
  listing: ParsedListing,
  premiumSignals: ReturnType<typeof parseListingPremiumSignals>,
  channel: ReaSaleChannel,
  options?: EnrichSalesAppraisalOptions,
): Promise<SaleChannelDiscoverResult> {
  const overrideUrl =
    channel === "sold" ? options?.soldSearchUrl : options?.buySearchUrl;

  if (overrideUrl) {
    const { comps, provider } = await fetchSaleCompsForSearchUrl(
      overrideUrl,
      channel,
      options,
    );
    return {
      comps,
      searchUrl: overrideUrl,
      attemptLabel: "override",
      provider,
    };
  }

  const subjectPropertyType = resolveRentSubjectPropertyType(listing);
  const attempts: SaleDiscoverAttempt[] = buildSaleDiscoverAttemptsForChannel(
    listing,
    premiumSignals,
    channel,
  );

  let mergedComps: SaleComp[] = [];
  let lastProvider: SaleChannelDiscoverResult["provider"] = hasApifyReaConfig()
    ? "apify"
    : "brightdata";
  let lastSearchUrl = "";
  let lastAttemptLabel = "merged";

  for (const attempt of attempts) {
    const { comps, provider } = await fetchSaleCompsForSearchUrl(
      attempt.searchUrl,
      channel,
      options,
    );
    mergedComps = mergeSaleComps(mergedComps, comps);
    lastProvider = provider;
    lastSearchUrl = attempt.searchUrl;
    lastAttemptLabel = attempt.label;

    const typeMatched = countTypeMatchedComps(mergedComps, subjectPropertyType);
    const enoughTotal = subjectPropertyType?.trim()
      ? typeMatched >= TARGET_RENT_COMPS_FOR_BAND
      : mergedComps.length >= TARGET_RENT_COMPS_FOR_BAND;
    const enoughLocal =
      countSameSuburbTypeMatchedComps(
        mergedComps,
        listing.suburb,
        subjectPropertyType,
      ) >= MIN_SAME_SUBURB_COMPS_FOR_DISCOVER;

    if (enoughTotal && enoughLocal) {
      return {
        comps: mergedComps,
        searchUrl: attempt.searchUrl,
        attemptLabel: attempt.label,
        provider,
      };
    }

    if (
      attempt.label.includes("adjacent-postcodes") &&
      mergedComps.length >= MIN_RENT_COMPS_FOR_BAND
    ) {
      return {
        comps: mergedComps,
        searchUrl: attempt.searchUrl,
        attemptLabel: attempt.label,
        provider,
      };
    }
  }

  return {
    comps: mergedComps,
    searchUrl: lastSearchUrl,
    attemptLabel: lastAttemptLabel,
    provider: lastProvider,
  };
}

const GRANULAR_SALE_DISCOVER_SUFFIXES = new Set([
  "primary-type-bed-bath-park-suburb",
  "primary-type-bed-bath-suburb",
  "primary-type-bed-suburb",
  "primary-type-bed-adjacent-postcodes",
  "primary-bed-bath-park-suburb",
  "primary-bed-bath-suburb",
  "primary-bed-suburb",
  "primary-bed-adjacent-postcodes",
]);

function isGranularSaleAttemptLabel(label: string) {
  if (label === "override") {
    return true;
  }
  const withoutChannel = label.replace(/^(?:sold|buy)-/, "");
  return GRANULAR_SALE_DISCOVER_SUFFIXES.has(withoutChannel);
}

/**
 * Sales appraisal enrichment: discover recently sold + for-sale REA comps,
 * rank the merged pool, compute a sale price band from sold comps, run the
 * LLM positioning pass, and write `parsed.salesAppraisal` + `parsed.salesComps`.
 */
export async function enrichListingSalesAppraisal(
  listing: ParsedListing,
  options?: EnrichSalesAppraisalOptions,
): Promise<ParsedListing> {
  const warnings = [...listing.warnings];
  const premiumSignals = parseListingPremiumSignals(listing);
  const listingWithSignals: ParsedListing = {
    ...listing,
    landAreaSqm: premiumSignals.landAreaSqm ?? listing.landAreaSqm,
  };

  if (!hasSaleDiscoverConfig()) {
    warnings.push(
      "Sales appraisal skipped: Apify or Bright Data REA discovery is not configured.",
    );
    return { ...listingWithSignals, warnings };
  }

  if (!hasMinimumFields(listingWithSignals)) {
    warnings.push(
      "Sales appraisal skipped: suburb, state, postcode, and bedrooms are required.",
    );
    return { ...listingWithSignals, warnings };
  }

  try {
    const subjectPropertyType = resolveRentSubjectPropertyType(listingWithSignals);

    // Sold comps first (they drive the price band), then buy comps for context.
    const soldResult = await discoverSaleCompsForChannel(
      listingWithSignals,
      premiumSignals,
      "sold",
      options,
    );

    let buyResult: SaleChannelDiscoverResult;
    try {
      buyResult = await discoverSaleCompsForChannel(
        listingWithSignals,
        premiumSignals,
        "buy",
        options,
      );
    } catch (error) {
      buyResult = {
        comps: [],
        searchUrl: "",
        attemptLabel: "failed",
        provider: soldResult.provider,
      };
      pushUniqueWarning(
        warnings,
        `Sales appraisal: for-sale comp discovery failed (${error instanceof Error ? error.message : "unknown error"}); using sold comps only.`,
      );
    }

    const merged = mergeSaleComps(soldResult.comps, buyResult.comps);
    const comps = orderSaleCompsForListing(merged, listingWithSignals);
    const soldComps = comps.filter((comp) => comp.saleStatus === "sold");
    const forSaleComps = comps.filter((comp) => comp.saleStatus === "for_sale");

    if (comps.length < MIN_SALE_COMPS_FOR_BAND) {
      pushUniqueWarning(
        warnings,
        `Sales appraisal: only ${comps.length} sale listings returned from REA (need at least ${MIN_SALE_COMPS_FOR_BAND}).`,
      );
      return {
        ...listingWithSignals,
        salesComps: comps,
        salesAppraisal: {
          ...listingWithSignals.salesAppraisal,
          selectedCompListingIds: defaultSelectedSaleCompListingIds({
            ...listingWithSignals,
            salesComps: comps,
          }),
        },
        warnings,
      };
    }

    const premiumResult = detectPremiumRentSubject({
      tierSetting: "auto",
      subjectBedrooms: listingWithSignals.bedrooms ?? undefined,
      subjectBathrooms: listingWithSignals.bathrooms ?? undefined,
      subjectPropertyType,
      signals: premiumSignals,
    });

    let band = computeSalePriceBandFromComps(soldComps, {
      subjectPropertyType,
      preferSuburb: listingWithSignals.suburb,
      subjectBedrooms: listingWithSignals.bedrooms ?? undefined,
      subjectBathrooms: listingWithSignals.bathrooms ?? undefined,
    });

    if (soldComps.length < MIN_SOLD_COMPS_FOR_BAND) {
      pushUniqueWarning(
        warnings,
        `Sales appraisal: only ${soldComps.length} recently sold comps found; the estimated price range needs at least ${MIN_SOLD_COMPS_FOR_BAND}.`,
      );
    }

    if (!band) {
      pushUniqueWarning(
        warnings,
        "Sales appraisal: could not compute a sale price band from sold REA listings.",
      );
      return {
        ...listingWithSignals,
        salesComps: comps,
        salesAppraisal: {
          ...listingWithSignals.salesAppraisal,
          compCount: comps.length,
          soldCompCount: soldComps.length,
          forSaleCompCount: forSaleComps.length,
          searchUrl: soldResult.searchUrl,
          selectedCompListingIds: defaultSelectedSaleCompListingIds({
            ...listingWithSignals,
            salesComps: comps,
          }),
        },
        warnings,
      };
    }

    const statisticalBand = { ...band };
    const positioned = await positionSalesAppraisal({
      subject: saleSubjectFromParsedListing(
        listingWithSignals,
        premiumResult.premium,
      ),
      band,
      comps,
    });

    if (positioned.positioning) {
      band = positioned.band;
      pushUniqueWarning(
        warnings,
        `Sales appraisal price band reviewed against comps (${positioned.positioning.confidence} confidence).`,
      );
      if (positioned.positioning.was_clamped) {
        pushUniqueWarning(
          warnings,
          "Sales appraisal LLM band adjusted to stay within comp-derived bounds.",
        );
      }
    }

    const compSelectionBase = {
      ...listingWithSignals,
      salesComps: comps,
    };
    const selectedCompListingIds =
      positioned.selectedCompListingIds ??
      defaultSelectedSaleCompListingIds(compSelectionBase);

    if (!isGranularSaleAttemptLabel(soldResult.attemptLabel)) {
      pushUniqueWarning(
        warnings,
        `Sales appraisal used widened REA sold search (${soldResult.attemptLabel}) to find enough comparables.`,
      );
    }

    if (soldResult.attemptLabel.includes("luxury")) {
      pushUniqueWarning(
        warnings,
        "Sales appraisal REA search used luxury/amenity keywords.",
      );
    }

    if (premiumResult.premium) {
      const reasonSummary =
        premiumResult.reasons.length > 0
          ? premiumResult.reasons.join(", ")
          : "scored premium";
      pushUniqueWarning(
        warnings,
        `Sales appraisal used premium tier (${reasonSummary}).`,
      );
    }

    pushUniqueWarning(
      warnings,
      `Sales appraisal from ${soldResult.provider === "apify" ? "Apify" : "Bright Data"} REA comps (${soldComps.length} sold, ${forSaleComps.length} for sale, midpoint ${formatSalePriceRange(band.priceMidpoint, band.priceMidpoint)}).`,
    );

    return {
      ...listingWithSignals,
      salesAppraisal: {
        priceMin: band.priceMin,
        priceMax: band.priceMax,
        priceMidpoint: band.priceMidpoint,
        selectedCompListingIds,
        source: soldResult.provider === "apify" ? "apify_rea" : "rea_discover",
        compCount: comps.length,
        soldCompCount: soldComps.length,
        forSaleCompCount: forSaleComps.length,
        searchUrl: soldResult.searchUrl,
        premiumTier: premiumResult.premium,
        premiumReasons: premiumResult.reasons,
        positioning: positioned.positioning
          ? {
              ...positioned.positioning,
              statistical_price_midpoint: statisticalBand.priceMidpoint,
            }
          : undefined,
      },
      salesComps: comps,
      warnings,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sales appraisal failed.";
    warnings.push(`Sales appraisal failed: ${message}`);
    return { ...listingWithSignals, warnings };
  }
}
