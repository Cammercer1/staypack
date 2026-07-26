import {
  getReaMaxListings,
  hasReaDataProviderConfig,
  scrapeReaSearch,
  scrapeReaSearchUrls,
  type ReaDataProvider,
} from "@/lib/rea/client";
import {
  RENT_COMPARABLE_POOL_TARGETS,
  capComparablePool,
  excludeSubjectComparables,
  summarizeComparablePool,
  type ComparableDiscoverySummary,
} from "@/lib/comparables/discoveryPolicy";
import type { RentAppraisalConfig } from "@/lib/delivery/rentAppraisalConfig";
import { buildRentDiscoverAttempts } from "@/lib/rental/buildRentDiscoverAttempts";
import { mergeRentalComps } from "@/lib/rental/mergeRentalComps";
import { MIN_RENT_COMPS_FOR_BAND } from "@/lib/rental/rentCompThresholds";
import {
  buildRentalCompSelectionPool,
  filterRentalCompsForSubjectType,
} from "@/lib/rental/rankRentalCompsForSubject";
import { applyRentBandSuburbFloor } from "@/lib/rental/applyRentBandSuburbFloor";
import {
  computeRentBandFromComps,
  formatWeeklyRentRange,
  matchesSubjectPropertyType,
  type RentBandTier,
} from "@/lib/rental/computeRentBand";
import { detectPremiumRentSubject } from "@/lib/rental/detectPremiumRentSubject";
import { enrichLtrSuburbMarket } from "@/lib/propradar/enrichLtrSuburbMarket";
import { parseListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import { parseApifyReaListings } from "@/lib/rental/parseApifyReaListings";
import {
  computeReaBedroomRentMedian,
  computeReaBedroomRentPercentile,
  resolveSuburbRentFloor,
} from "@/lib/rental/resolveSuburbRentFloor";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import {
  fillLeaseAppraisalCompSelection,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import { rentalCompListingId } from "@/lib/lease-appraisal/rentalCompIds";
import {
  positionLeaseAppraisal,
  subjectFromParsedListing,
} from "@/lib/lease-appraisal/positionLeaseAppraisal";
import { enrichListingWithDomainAvm } from "@/lib/domain-avm/client";
import {
  anchorRentBandToDomainAvm,
  filterRentalCompsAroundDomainAvm,
  isTrustedDomainConfidence,
} from "@/lib/domain-avm/appraisalEvidence";
import type { ParsedListing } from "@/lib/types";
import type { RentalComp } from "@/lib/rental/types";

function orderRentalCompsForListing(
  comps: RentalComp[],
  listing: ParsedListing,
): RentalComp[] {
  const subjectPropertyType = resolveRentSubjectPropertyType(listing);
  return buildRentalCompSelectionPool(comps, {
    suburb: listing.suburb,
    bedrooms: listing.bedrooms ?? undefined,
    bathrooms: listing.bathrooms ?? undefined,
    carSpaces: listing.carSpaces ?? undefined,
    targetWeeklyRent:
      isTrustedDomainConfidence(
        listing.domainAvm?.rentalEstimate?.confidence,
      )
        ? listing.domainAvm?.rentalEstimate?.weeklyRent
        : undefined,
    subjectPropertyType,
  });
}

export type EnrichRentalAppraisalOptions = {
  /** Override SERP URL (for tests). */
  searchUrl?: string;
  /** Delivery tenant rent_appraisal config (tier override). */
  rentAppraisalConfig?: RentAppraisalConfig | null;
  /** Listing URL used to ensure the subject is never treated as its own comp. */
  subjectListingUrl?: string | null;
};

function hasRentDiscoverConfig() {
  return hasReaDataProviderConfig();
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

type RentDiscoverResult = {
  comps: RentalComp[];
  searchUrl: string;
  attemptLabel: string;
  discovery: ComparableDiscoverySummary;
  provider?: ReaDataProvider;
};

const GRANULAR_RENT_DISCOVER_LABELS = new Set([
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

const MAX_PRIMARY_RENT_SEARCH_URLS = 6;
const MAX_EXPANDED_RENT_SEARCH_URLS = 8;
const MAX_RENT_DATASET_ITEMS = 100;

function prepareRentalComparablePool({
  comps,
  listing,
  subjectListingUrl,
  attemptCount,
}: {
  comps: RentalComp[];
  listing: ParsedListing;
  subjectListingUrl?: string | null;
  attemptCount: number;
}) {
  const withoutSubject = excludeSubjectComparables(comps, {
    address: listing.address,
    suburb: listing.suburb,
    listingUrl: subjectListingUrl,
  });
  const ordered = orderRentalCompsForListing(
    withoutSubject.comparables,
    listing,
  );
  const subjectPropertyType = resolveRentSubjectPropertyType(listing);
  const evidenceComps = subjectPropertyType
    ? withoutSubject.comparables.filter((comp) =>
        matchesSubjectPropertyType(comp, subjectPropertyType),
      )
    : withoutSubject.comparables;
  const discovery = summarizeComparablePool({
    comparables: evidenceComps,
    subjectSuburb: listing.suburb,
    targets: RENT_COMPARABLE_POOL_TARGETS,
    attemptCount,
    subjectExcludedCount: withoutSubject.excludedCount,
  });

  return {
    comps: capComparablePool(ordered),
    discovery,
  };
}

async function fetchRentCompsForSearchUrl(
  searchUrl: string,
): Promise<{ comps: RentalComp[]; provider: ReaDataProvider }> {
  const { records, provider } = await scrapeReaSearch({
    searchUrl,
    maxItems: getReaMaxListings(),
    includeSurroundingSuburbs: true,
    datasetItemLimit: MAX_RENT_DATASET_ITEMS,
  });
  return { comps: parseApifyReaListings(records), provider };
}

async function discoverRentalComps(
  listing: ParsedListing,
  premiumSignals: ReturnType<typeof parseListingPremiumSignals>,
  options?: EnrichRentalAppraisalOptions,
): Promise<RentDiscoverResult> {
  if (options?.searchUrl) {
    const { comps, provider } = await fetchRentCompsForSearchUrl(options.searchUrl);
    const prepared = prepareRentalComparablePool({
      comps,
      listing,
      subjectListingUrl: options.subjectListingUrl,
      attemptCount: 1,
    });
    return {
      comps: prepared.comps,
      searchUrl: options.searchUrl,
      attemptLabel: "override",
      discovery: prepared.discovery,
      provider,
    };
  }

  const attempts = buildRentDiscoverAttempts(listing, premiumSignals);
  if (attempts.length === 0) {
    const prepared = prepareRentalComparablePool({
      comps: [],
      listing,
      subjectListingUrl: options?.subjectListingUrl,
      attemptCount: 0,
    });
    return {
      comps: [],
      searchUrl: "",
      attemptLabel: "no-search-attempts",
      discovery: prepared.discovery,
    };
  }

  const primaryAttempts = attempts
    .filter((attempt) => attempt.label.startsWith("primary-"))
    .slice(0, MAX_PRIMARY_RENT_SEARCH_URLS);
  const expandedAttempts = attempts
    .filter((attempt) => !attempt.label.startsWith("primary-"))
    .slice(0, MAX_EXPANDED_RENT_SEARCH_URLS);
  const firstBatch = primaryAttempts.length > 0
    ? primaryAttempts
    : attempts.slice(0, MAX_PRIMARY_RENT_SEARCH_URLS);

  const {
    records: primaryRecords,
    provider: primaryProvider,
  } = await scrapeReaSearchUrls({
    searchUrls: firstBatch.map((attempt) => attempt.searchUrl),
    maxItems: getReaMaxListings(),
    includeSurroundingSuburbs: true,
    datasetItemLimit: MAX_RENT_DATASET_ITEMS,
  });
  let mergedComps = mergeRentalComps(
    [],
    parseApifyReaListings(primaryRecords),
  );
  let prepared = prepareRentalComparablePool({
    comps: mergedComps,
    listing,
    subjectListingUrl: options?.subjectListingUrl,
    attemptCount: firstBatch.length,
  });

  if (prepared.discovery.targetMet || expandedAttempts.length === 0) {
    return {
      comps: prepared.comps,
      searchUrl: firstBatch[0]?.searchUrl ?? "",
      attemptLabel:
        firstBatch.length > 1
          ? "batched-primary-search"
          : (firstBatch[0]?.label ?? "no-search-attempts"),
      discovery: prepared.discovery,
      provider: primaryProvider,
    };
  }

  const {
    records: expandedRecords,
    provider: expandedProvider,
  } = await scrapeReaSearchUrls({
    searchUrls: expandedAttempts.map((attempt) => attempt.searchUrl),
    maxItems: getReaMaxListings(),
    includeSurroundingSuburbs: true,
    datasetItemLimit: MAX_RENT_DATASET_ITEMS,
  });
  mergedComps = mergeRentalComps(
    mergedComps,
    parseApifyReaListings(expandedRecords),
  );
  prepared = prepareRentalComparablePool({
    comps: mergedComps,
    listing,
    subjectListingUrl: options?.subjectListingUrl,
    attemptCount: firstBatch.length + expandedAttempts.length,
  });

  return {
    comps: prepared.comps,
    searchUrl: firstBatch[0]?.searchUrl ?? "",
    attemptLabel: "batched-expanded-search",
    discovery: prepared.discovery,
    provider: expandedProvider,
  };
}

export async function enrichListingRentalAppraisal(
  listing: ParsedListing,
  options?: EnrichRentalAppraisalOptions,
): Promise<ParsedListing> {
  const warnings = [...listing.warnings];
  const premiumSignals = parseListingPremiumSignals(listing);
  let listingWithSignals: ParsedListing = {
    ...listing,
    landAreaSqm: premiumSignals.landAreaSqm ?? listing.landAreaSqm,
  };

  if (!hasRentDiscoverConfig()) {
    warnings.push(
      "Rental appraisal skipped: no REA comparable-search provider is configured.",
    );
    return finishRentalAppraisalEnrichment({ ...listingWithSignals, warnings });
  }

  if (!hasMinimumFields(listingWithSignals)) {
    warnings.push(
      "Rental appraisal skipped: suburb, state, postcode, and bedrooms are required.",
    );
    return finishRentalAppraisalEnrichment({ ...listingWithSignals, warnings });
  }

  try {
    const domainResult = await enrichListingWithDomainAvm(listingWithSignals);
    listingWithSignals = domainResult.listing;
    if (domainResult.status === "failed") {
      pushUniqueWarning(
        warnings,
        `Domain AVM unavailable (${domainResult.error}); continuing with REA comparables.`,
      );
    } else if (domainResult.status === "unavailable") {
      pushUniqueWarning(
        warnings,
        "Domain AVM did not return an exact-address match; continuing with REA comparables.",
      );
    }

    const { listing: withSuburb } = await enrichLtrSuburbMarket(listingWithSignals);

    const subjectPropertyType = resolveRentSubjectPropertyType(withSuburb);

    const {
      comps: discoveredComps,
      searchUrl,
      attemptLabel,
      discovery,
      provider,
    } =
      await discoverRentalComps(withSuburb, premiumSignals, options);

    const comps = capComparablePool(
      orderRentalCompsForListing(discoveredComps, withSuburb),
    );

    if (!discovery.targetMet) {
      pushUniqueWarning(
        warnings,
        `Rental appraisal candidate pool below target (${discovery.poolCount}/${discovery.targetCount} total, ${discovery.sameSuburbCount}/${discovery.targetSameSuburbCount} in ${withSuburb.suburb}).`,
      );
    }

    if (comps.length < MIN_RENT_COMPS_FOR_BAND) {
      const selectedCompListingIds = fillLeaseAppraisalCompSelection({
        ...withSuburb,
        rentalComps: comps,
      });
      pushUniqueWarning(
        warnings,
        `Rental appraisal: only ${comps.length} rent listings returned from REA (need at least ${MIN_RENT_COMPS_FOR_BAND}).`,
      );
      return finishRentalAppraisalEnrichment({
        ...withSuburb,
        rentalComps: comps,
        rentalAppraisal: {
          ...withSuburb.rentalAppraisal,
          compCount: comps.length,
          featuredCompCount: selectedCompListingIds.length,
          searchUrl,
          discovery,
          selectedCompListingIds,
        },
        warnings,
      });
    }

    const tierSetting = options?.rentAppraisalConfig?.tier ?? "auto";
    const tierOverride: RentBandTier | undefined =
      tierSetting === "premium"
        ? "premium"
        : tierSetting === "standard"
          ? "standard"
          : undefined;

    const premiumResult = detectPremiumRentSubject({
      tier: tierOverride,
      tierSetting,
      subjectBedrooms: withSuburb.bedrooms ?? undefined,
      subjectBathrooms: withSuburb.bathrooms ?? undefined,
      subjectPropertyType,
      signals: premiumSignals,
    });

    const rentBandOptions = {
      subjectPropertyType,
      preferSuburb: withSuburb.suburb,
      subjectBedrooms: withSuburb.bedrooms ?? undefined,
      subjectBathrooms: withSuburb.bathrooms ?? undefined,
      subjectCarSpaces: withSuburb.carSpaces ?? undefined,
      targetWeeklyRent: isTrustedDomainConfidence(
        withSuburb.domainAvm?.rentalEstimate?.confidence,
      )
        ? withSuburb.domainAvm?.rentalEstimate?.weeklyRent
        : undefined,
      tier: tierOverride,
      tierSetting,
      premiumSignals,
      strictFeaturedPropertyType: true,
      maxFeaturedComps: 6,
    };

    const estimationComps = filterRentalCompsAroundDomainAvm(
      filterRentalCompsForSubjectType(comps, subjectPropertyType),
      withSuburb.domainAvm,
    );

    let band = computeRentBandFromComps(estimationComps, rentBandOptions);

    if (!band) {
      warnings.push("Rental appraisal: could not compute a rent band from REA listings.");
      const selectedCompListingIds = fillLeaseAppraisalCompSelection({
        ...withSuburb,
        rentalComps: comps,
      });
      return finishRentalAppraisalEnrichment({
        ...withSuburb,
        rentalComps: comps,
        rentalAppraisal: {
          ...withSuburb.rentalAppraisal,
          compCount: comps.length,
          featuredCompCount: selectedCompListingIds.length,
          searchUrl,
          discovery,
          selectedCompListingIds,
        },
        warnings,
      });
    }

    const bedrooms = withSuburb.bedrooms!;
    const reaBedMedian = computeReaBedroomRentMedian(estimationComps, bedrooms);
    const reaBedP75 = computeReaBedroomRentPercentile(
      estimationComps,
      bedrooms,
      0.75,
    );
    const rentFloor = resolveSuburbRentFloor({
      reaBedMedian,
      reaBedP75,
      suburbMarket: withSuburb.ltrSuburbMarket,
      bedrooms,
      premium: premiumResult.premium,
    });

    const trustedDomainRent = isTrustedDomainConfidence(
      withSuburb.domainAvm?.rentalEstimate?.confidence,
    );
    const appliedRentFloor = trustedDomainRent ? undefined : rentFloor;
    if (appliedRentFloor) {
      const beforeMin = band.weeklyMin;
      band = applyRentBandSuburbFloor(band, appliedRentFloor);
      if (band.weeklyMin > beforeMin) {
        warnings.push(
          `Rental appraisal band raised to align with suburb benchmark ($${appliedRentFloor.weeklyRent}/wk from ${appliedRentFloor.source.replace(/_/g, " ")}).`,
        );
      }
    }

    const statisticalBand = { ...band };
    const positioned = await positionLeaseAppraisal({
      subject: subjectFromParsedListing(withSuburb, premiumResult.premium),
      band,
      comps: estimationComps,
      suburbMarket: withSuburb.ltrSuburbMarket,
    });

    if (positioned.positioning) {
      band = positioned.band;
      pushUniqueWarning(
        warnings,
        `Lease appraisal rent band reviewed against comps (${positioned.positioning.confidence} confidence).`,
      );
      if (positioned.positioning.was_clamped) {
        pushUniqueWarning(
          warnings,
          "Lease appraisal LLM band adjusted to stay within comp-derived bounds.",
        );
      }
    }

    const domainRent = withSuburb.domainAvm?.rentalEstimate;
    if (domainRent) {
      if (isTrustedDomainConfidence(domainRent.confidence)) {
        band = anchorRentBandToDomainAvm(band, withSuburb.domainAvm);
        pushUniqueWarning(
          warnings,
          `Rental appraisal anchored to the exact-address Domain estimate (${domainRent.confidence} confidence, $${domainRent.weeklyRent}/wk).`,
        );
      } else {
        pushUniqueWarning(
          warnings,
          "Domain rental estimate was Low confidence and was retained as advisory evidence only.",
        );
      }
    }

    const compSelectionBase = {
      ...withSuburb,
      rentalComps: comps,
    };
    const bandFeaturedIds = band.featuredComps.map((comp) =>
      rentalCompListingId(comp, Math.max(0, comps.indexOf(comp))),
    );
    const selectedCompListingIds = fillLeaseAppraisalCompSelection(
      compSelectionBase,
      [
        ...bandFeaturedIds,
        ...(positioned.selectedCompListingIds ?? []),
      ],
    );

    const displayPrice = formatWeeklyRentRange(band.weeklyMin, band.weeklyMax);

    if (
      attemptLabel !== "override" &&
      !GRANULAR_RENT_DISCOVER_LABELS.has(attemptLabel)
    ) {
      pushUniqueWarning(
        warnings,
        `Rental appraisal used widened REA rent search (${attemptLabel}) to find enough comparables.`,
      );
    }

    if (attemptLabel.includes("luxury")) {
      pushUniqueWarning(
        warnings,
        "Rental appraisal REA search used luxury/amenity keywords.",
      );
    }

    if (premiumResult.premium) {
      const reasonSummary =
        premiumResult.reasons.length > 0
          ? premiumResult.reasons.join(", ")
          : "scored premium";
      warnings.push(
        `Rental appraisal used premium tier (${reasonSummary}).`,
      );
    }

    if (premiumSignals.luxuryKeywordHits.length > 0) {
      warnings.push(
        `Rental appraisal luxury signals: ${premiumSignals.luxuryKeywordHits.slice(0, 5).join(", ")}${premiumSignals.luxuryKeywordHits.length > 5 ? "…" : ""}.`,
      );
    }

    if (premiumSignals.landAreaSqm != null) {
      warnings.push(
        `Rental appraisal land area parsed: ${premiumSignals.landAreaSqm} m².`,
      );
    }

    pushUniqueWarning(
      warnings,
      `Rental appraisal from ${trustedDomainRent ? "Domain AVM evidence plus " : ""}${provider === "rapidapi" ? "RapidAPI" : "Apify"} REA rent comps (n=${band.compCount}, median $${band.weeklyMidpoint}/wk).`,
    );

    const enriched = await finishRentalAppraisalEnrichment({
      ...withSuburb,
      purpose: withSuburb.purpose ?? "lease",
      displayPrice: withSuburb.displayPrice ?? displayPrice,
      rentalAppraisal: {
        weeklyMin: band.weeklyMin,
        weeklyMax: band.weeklyMax,
        weeklyMidpoint: band.weeklyMidpoint,
        selectedCompListingIds,
        source: provider === "rapidapi" ? "rapidapi_rea" : "apify_rea",
        compCount: comps.length,
        featuredCompCount: selectedCompListingIds.length,
        searchUrl,
        discovery,
        premiumTier: premiumResult.premium,
        premiumReasons: premiumResult.reasons,
        rentFloorWeekly: appliedRentFloor?.weeklyRent,
        rentFloorSource: appliedRentFloor?.source,
        positioning: positioned.positioning
          ? {
              ...positioned.positioning,
              statistical_weekly_midpoint: statisticalBand.weeklyMidpoint,
            }
          : undefined,
      },
      rentalComps: comps,
      warnings,
    });
    return enriched;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rental appraisal failed.";
    warnings.push(`Rental appraisal failed: ${message}`);
    return finishRentalAppraisalEnrichment({ ...listingWithSignals, warnings });
  }
}

async function finishRentalAppraisalEnrichment(
  listing: ParsedListing,
): Promise<ParsedListing> {
  if (listing.ltrSuburbMarket) {
    return listing;
  }
  const { listing: withSuburb } = await enrichLtrSuburbMarket(listing);
  return withSuburb;
}
