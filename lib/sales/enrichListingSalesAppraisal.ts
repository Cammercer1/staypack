import {
  getApifyReaMaxListings,
  hasApifyReaConfig,
  scrapeApifyReaRentSearch,
  scrapeApifyReaRentSearchUrls,
} from "@/lib/apify/client";
import {
  hasBrightDataReaConfig,
  scrapeBrightDataReaRentDiscover,
} from "@/lib/brightdata/client";
import { detectPremiumRentSubject } from "@/lib/rental/detectPremiumRentSubject";
import { parseListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import {
  FOR_SALE_COMPARABLE_POOL_TARGETS,
  MAX_SALE_DISCOVERY_ATTEMPTS_PER_CHANNEL,
  SOLD_COMPARABLE_POOL_TARGETS,
  capComparablePool,
  excludeSubjectComparables,
  summarizeComparablePool,
  type ComparableDiscoverySummary,
  type ComparablePoolTargets,
} from "@/lib/comparables/discoveryPolicy";
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
import { enrichSelectedSaleCompDetails } from "@/lib/sales/enrichSaleCompDetails";
import { mergeSaleComps } from "@/lib/sales/mergeSaleComps";
import { parseApifyReaSaleListings } from "@/lib/sales/parseApifyReaSaleListings";
import { parseReaSaleDiscoverRecords } from "@/lib/sales/parseReaSaleDiscover";
import {
  applyAgencyGuideToCompBand,
} from "@/lib/sales/resolveAgencyGuidePriceBand";
import {
  positionSalesAppraisal,
  saleSubjectFromParsedListing,
} from "@/lib/sales/positionSalesAppraisal";
import {
  filterSaleCompsForSubjectType,
  rankSaleCompsForSubject,
  resolveSaleSubjectPropertyType,
} from "@/lib/sales/rankSaleCompsForSubject";
import { filterRecentSaleComps } from "@/lib/sales/saleCompFreshness";
import type { SaleComp } from "@/lib/sales/types";
import { defaultSelectedSaleCompListingIds } from "@/lib/sales-appraisal/salesAppraisalData";
import type { ParsedListing } from "@/lib/types";

export type EnrichSalesAppraisalOptions = {
  /** Override SERP URLs per channel (for tests). */
  soldSearchUrl?: string;
  buySearchUrl?: string;
  limitPages?: number;
  /** Listing URL used to ensure the subject is never treated as its own comp. */
  subjectListingUrl?: string | null;
};

const MIN_SOLD_COMPS_FOR_BAND = MIN_SALE_COMPS_FOR_BAND;
const MAX_SALE_PRIMARY_BATCH_URLS = 3;

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
  const subjectPropertyType = resolveSaleSubjectPropertyType(listing);
  const eligible = filterRecentSaleComps(
    filterSaleCompsForSubjectType(comps, subjectPropertyType),
  );
  return rankSaleCompsForSubject(eligible, {
    suburb: listing.suburb,
    bedrooms: listing.bedrooms ?? undefined,
    bathrooms: listing.bathrooms ?? undefined,
    subjectPropertyType,
  });
}

type SaleChannelDiscoverResult = {
  comps: SaleComp[];
  searchUrl: string;
  attemptLabel: string;
  provider: "apify" | "brightdata";
  discovery: ComparableDiscoverySummary;
};

function targetsForSaleChannel(channel: ReaSaleChannel): ComparablePoolTargets {
  return channel === "sold"
    ? SOLD_COMPARABLE_POOL_TARGETS
    : FOR_SALE_COMPARABLE_POOL_TARGETS;
}

function prepareSaleComparablePool({
  comps,
  listing,
  subjectListingUrl,
  targets,
  attemptCount,
}: {
  comps: SaleComp[];
  listing: ParsedListing;
  subjectListingUrl?: string | null;
  targets: ComparablePoolTargets;
  attemptCount: number;
}) {
  const withoutSubject = excludeSubjectComparables(comps, {
    address: listing.address,
    suburb: listing.suburb,
    listingUrl: subjectListingUrl,
  });
  const ordered = orderSaleCompsForListing(
    withoutSubject.comparables,
    listing,
  );
  const discovery = summarizeComparablePool({
    comparables: ordered,
    subjectSuburb: listing.suburb,
    targets,
    attemptCount,
    subjectExcludedCount: withoutSubject.excludedCount,
  });

  return {
    comps: capComparablePool(ordered),
    discovery,
  };
}

async function fetchSaleCompsForSearchUrl(
  searchUrl: string,
  channel: ReaSaleChannel,
  options?: EnrichSalesAppraisalOptions,
  skipApify = false,
): Promise<{ comps: SaleComp[]; provider: "apify" | "brightdata" }> {
  if (!skipApify && hasApifyReaConfig()) {
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
  const targets = targetsForSaleChannel(channel);
  const overrideUrl =
    channel === "sold" ? options?.soldSearchUrl : options?.buySearchUrl;

  if (overrideUrl) {
    const { comps, provider } = await fetchSaleCompsForSearchUrl(
      overrideUrl,
      channel,
      options,
    );
    const prepared = prepareSaleComparablePool({
      comps,
      listing,
      subjectListingUrl: options?.subjectListingUrl,
      targets,
      attemptCount: 1,
    });
    return {
      comps: prepared.comps,
      searchUrl: overrideUrl,
      attemptLabel: "override",
      provider,
      discovery: prepared.discovery,
    };
  }

  const attempts: SaleDiscoverAttempt[] = buildSaleDiscoverAttemptsForChannel(
    listing,
    premiumSignals,
    channel,
  ).slice(0, MAX_SALE_DISCOVERY_ATTEMPTS_PER_CHANNEL);
  let apifyBatchFailed = false;

  if (hasApifyReaConfig()) {
    const batches = [
      attempts.slice(0, MAX_SALE_PRIMARY_BATCH_URLS),
      attempts.slice(MAX_SALE_PRIMARY_BATCH_URLS),
    ].filter((batch) => batch.length > 0);
    let mergedComps: SaleComp[] = [];
    let attemptedSearches = 0;
    let prepared = prepareSaleComparablePool({
      comps: [],
      listing,
      subjectListingUrl: options?.subjectListingUrl,
      targets,
      attemptCount: 0,
    });

    try {
      for (const [batchIndex, batch] of batches.entries()) {
        const records = await scrapeApifyReaRentSearchUrls({
          searchUrls: batch.map((attempt) => attempt.searchUrl),
          maxItems: getApifyReaMaxListings(),
        });
        mergedComps = mergeSaleComps(
          mergedComps,
          parseApifyReaSaleListings(records, channel),
        );
        attemptedSearches += batch.length;
        prepared = prepareSaleComparablePool({
          comps: mergedComps,
          listing,
          subjectListingUrl: options?.subjectListingUrl,
          targets,
          attemptCount: attemptedSearches,
        });

        if (prepared.discovery.targetMet || batchIndex === batches.length - 1) {
          return {
            comps: prepared.comps,
            searchUrl: attempts[0]?.searchUrl ?? "",
            attemptLabel: `${channel}-${batchIndex === 0 ? "batched-primary-search" : "batched-expanded-search"}`,
            provider: "apify",
            discovery: prepared.discovery,
          };
        }
      }
    } catch (error) {
      if (!hasBrightDataReaConfig()) {
        throw error;
      }
      apifyBatchFailed = true;
    }
  }

  let mergedComps: SaleComp[] = [];
  let lastProvider: SaleChannelDiscoverResult["provider"] = hasApifyReaConfig()
    ? "apify"
    : "brightdata";
  let lastSearchUrl = "";
  let lastAttemptLabel = "merged";
  let lastPrepared = prepareSaleComparablePool({
    comps: [],
    listing,
    subjectListingUrl: options?.subjectListingUrl,
    targets,
    attemptCount: 0,
  });

  for (const [index, attempt] of attempts.entries()) {
    const { comps, provider } = await fetchSaleCompsForSearchUrl(
      attempt.searchUrl,
      channel,
      options,
      apifyBatchFailed,
    );
    mergedComps = mergeSaleComps(mergedComps, comps);
    lastPrepared = prepareSaleComparablePool({
      comps: mergedComps,
      listing,
      subjectListingUrl: options?.subjectListingUrl,
      targets,
      attemptCount: index + 1,
    });
    lastProvider = provider;
    lastSearchUrl = attempt.searchUrl;
    lastAttemptLabel = attempt.label;

    if (lastPrepared.discovery.targetMet) {
      return {
        comps: lastPrepared.comps,
        searchUrl: attempt.searchUrl,
        attemptLabel: attempt.label,
        provider,
        discovery: lastPrepared.discovery,
      };
    }
  }

  return {
    comps: lastPrepared.comps,
    searchUrl: lastSearchUrl,
    attemptLabel: lastAttemptLabel,
    provider: lastProvider,
    discovery: lastPrepared.discovery,
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
  "batched-primary-search",
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
    const subjectPropertyType = resolveSaleSubjectPropertyType(listingWithSignals);

    // These channels are independent. Discover them together, then preserve
    // the existing sold-required / for-sale-optional error handling below.
    const [soldOutcome, buyOutcome] = await Promise.allSettled([
      discoverSaleCompsForChannel(
        listingWithSignals,
        premiumSignals,
        "sold",
        options,
      ),
      discoverSaleCompsForChannel(
        listingWithSignals,
        premiumSignals,
        "buy",
        options,
      ),
    ]);

    if (soldOutcome.status === "rejected") {
      throw soldOutcome.reason;
    }
    const soldResult = soldOutcome.value;

    let buyResult: SaleChannelDiscoverResult;
    if (buyOutcome.status === "fulfilled") {
      buyResult = buyOutcome.value;
    } else {
      buyResult = {
        comps: [],
        searchUrl: "",
        attemptLabel: "failed",
        provider: soldResult.provider,
        discovery: summarizeComparablePool({
          comparables: [],
          subjectSuburb: listingWithSignals.suburb,
          targets: FOR_SALE_COMPARABLE_POOL_TARGETS,
          attemptCount: 0,
          subjectExcludedCount: 0,
        }),
      };
      pushUniqueWarning(
        warnings,
        `Sales appraisal: for-sale comp discovery failed (${buyOutcome.reason instanceof Error ? buyOutcome.reason.message : "unknown error"}); using sold comps only.`,
      );
    }

    const merged = mergeSaleComps(soldResult.comps, buyResult.comps);
    const comps = capComparablePool(
      orderSaleCompsForListing(merged, listingWithSignals),
    );
    const soldComps = comps.filter((comp) => comp.saleStatus === "sold");
    const forSaleComps = comps.filter((comp) => comp.saleStatus === "for_sale");
    const discovery = {
      sold: soldResult.discovery,
      forSale: buyResult.discovery,
    };

    if (!soldResult.discovery.targetMet) {
      pushUniqueWarning(
        warnings,
        `Sales appraisal candidate sold pool below target (${soldResult.discovery.poolCount}/${soldResult.discovery.targetCount} total, ${soldResult.discovery.sameSuburbCount}/${soldResult.discovery.targetSameSuburbCount} in ${listingWithSignals.suburb}).`,
      );
    }
    if (!buyResult.discovery.targetMet) {
      pushUniqueWarning(
        warnings,
        `Sales appraisal candidate for-sale pool below target (${buyResult.discovery.poolCount}/${buyResult.discovery.targetCount} total, ${buyResult.discovery.sameSuburbCount}/${buyResult.discovery.targetSameSuburbCount} in ${listingWithSignals.suburb}).`,
      );
    }

    if (comps.length < MIN_SALE_COMPS_FOR_BAND) {
      const selectedCompListingIds = defaultSelectedSaleCompListingIds({
        ...listingWithSignals,
        salesComps: comps,
      });
      pushUniqueWarning(
        warnings,
        `Sales appraisal: only ${comps.length} sale listings returned from REA (need at least ${MIN_SALE_COMPS_FOR_BAND}).`,
      );
      return {
        ...listingWithSignals,
        salesComps: comps,
        salesAppraisal: {
          ...listingWithSignals.salesAppraisal,
          compCount: comps.length,
          soldCompCount: soldComps.length,
          forSaleCompCount: forSaleComps.length,
          featuredCompCount: selectedCompListingIds.length,
          searchUrl: soldResult.searchUrl,
          discovery,
          selectedCompListingIds,
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
      const selectedCompListingIds = defaultSelectedSaleCompListingIds({
        ...listingWithSignals,
        salesComps: comps,
      });
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
          featuredCompCount: selectedCompListingIds.length,
          searchUrl: soldResult.searchUrl,
          discovery,
          selectedCompListingIds,
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

    const compDerivedBand = { ...band };
    const guideResolution = applyAgencyGuideToCompBand({
      displayPrice: listingWithSignals.displayPrice,
      compBand: compDerivedBand,
      premiumTier: premiumResult.premium,
    });
    const { agencyGuide } = guideResolution;
    const agencyGuideReview = guideResolution.review ?? undefined;

    if (agencyGuide) {
      band = guideResolution.band;
      pushUniqueWarning(
        warnings,
        `Sales appraisal retained the agency's advertised guide (${formatSalePriceRange(agencyGuide.priceMin, agencyGuide.priceMax)}) as the appraisal range.`,
      );
    }

    if (agencyGuideReview?.required) {
      pushUniqueWarning(
        warnings,
        "Sales appraisal requires agent review because the agency guide materially differs from the comp-derived range.",
      );
    }

    const compSelectionBase = {
      ...listingWithSignals,
      salesComps: comps,
    };
    const selectedCompListingIds =
      positioned.selectedCompListingIds ??
      defaultSelectedSaleCompListingIds(compSelectionBase);
    let detailedComps = comps;
    try {
      detailedComps = await enrichSelectedSaleCompDetails(
        comps,
        selectedCompListingIds,
      );
    } catch (error) {
      pushUniqueWarning(
        warnings,
        `Sales appraisal comparable detail enrichment failed (${error instanceof Error ? error.message : "unknown error"}); using search-result fields.`,
      );
    }

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
        featuredCompCount: selectedCompListingIds.length,
        searchUrl: soldResult.searchUrl,
        discovery,
        premiumTier: premiumResult.premium,
        premiumReasons: premiumResult.reasons,
        agencyGuide: agencyGuide ?? undefined,
        compDerivedBand: agencyGuide
          ? {
              priceMin: compDerivedBand.priceMin,
              priceMax: compDerivedBand.priceMax,
              priceMidpoint: compDerivedBand.priceMidpoint,
            }
          : undefined,
        agencyGuideReview,
        positioning: positioned.positioning
          ? {
              ...positioned.positioning,
              statistical_price_midpoint: statisticalBand.priceMidpoint,
            }
          : undefined,
      },
      salesComps: detailedComps,
      warnings,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sales appraisal failed.";
    warnings.push(`Sales appraisal failed: ${message}`);
    return { ...listingWithSignals, warnings };
  }
}
