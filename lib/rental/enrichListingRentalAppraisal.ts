import {
  getApifyReaMaxListings,
  hasApifyReaConfig,
  scrapeApifyReaRentSearch,
} from "@/lib/apify/client";
import {
  hasBrightDataReaConfig,
  scrapeBrightDataReaRentDiscover,
} from "@/lib/brightdata/client";
import type { RentAppraisalConfig } from "@/lib/delivery/rentAppraisalConfig";
import { fetchDomainSuburbRentMedian } from "@/lib/scraping/domain/fetchDomainSuburbRentMedian";
import { buildRentDiscoverAttempts } from "@/lib/rental/buildRentDiscoverAttempts";
import { mergeRentalComps } from "@/lib/rental/mergeRentalComps";
import {
  MIN_RENT_COMPS_FOR_BAND,
  MIN_SAME_SUBURB_COMPS_FOR_DISCOVER,
  TARGET_RENT_COMPS_FOR_BAND,
} from "@/lib/rental/rentCompThresholds";
import {
  countSameSuburbComps,
  filterRentalCompsForSubjectType,
  rankRentalCompsForSubject,
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
import { parseReaRentDiscoverRecords } from "@/lib/rental/parseReaRentDiscover";
import {
  computeReaBedroomRentMedian,
  computeReaBedroomRentPercentile,
  resolveSuburbRentFloor,
} from "@/lib/rental/resolveSuburbRentFloor";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import { defaultSelectedCompListingIds } from "@/lib/lease-appraisal/leaseAppraisalData";
import type { ParsedListing } from "@/lib/types";
import type { RentalComp } from "@/lib/rental/types";

function orderRentalCompsForListing(
  comps: RentalComp[],
  listing: ParsedListing,
): RentalComp[] {
  const subjectPropertyType = resolveRentSubjectPropertyType(listing);
  const eligible = filterRentalCompsForSubjectType(comps, subjectPropertyType);
  return rankRentalCompsForSubject(eligible, {
    suburb: listing.suburb,
    bedrooms: listing.bedrooms ?? undefined,
    bathrooms: listing.bathrooms ?? undefined,
    subjectPropertyType,
  });
}

export type EnrichRentalAppraisalOptions = {
  /** Override SERP URL (for tests). */
  searchUrl?: string;
  limitPages?: number;
  /** Delivery tenant rent_appraisal config (tier override). */
  rentAppraisalConfig?: RentAppraisalConfig | null;
};

function hasRentDiscoverConfig() {
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

type RentDiscoverResult = {
  comps: RentalComp[];
  searchUrl: string;
  attemptLabel: string;
  provider: "apify" | "brightdata";
};

function countTypeMatchedComps(comps: RentalComp[], subjectPropertyType?: string) {
  if (!subjectPropertyType?.trim()) {
    return comps.length;
  }
  return comps.filter((comp) =>
    matchesSubjectPropertyType(comp, subjectPropertyType),
  ).length;
}

function countSameSuburbTypeMatchedComps(
  comps: RentalComp[],
  suburb: string | undefined,
  subjectPropertyType?: string,
) {
  const pool = subjectPropertyType?.trim()
    ? comps.filter((comp) => matchesSubjectPropertyType(comp, subjectPropertyType))
    : comps;
  return countSameSuburbComps(pool, suburb);
}

const GRANULAR_RENT_DISCOVER_LABELS = new Set([
  "primary-type-bed-bath-park-suburb",
  "primary-type-bed-bath-suburb",
  "primary-type-bed-suburb",
  "primary-type-bed-adjacent-postcodes",
  "primary-bed-bath-park-suburb",
  "primary-bed-bath-suburb",
  "primary-bed-suburb",
  "primary-bed-adjacent-postcodes",
]);

async function fetchRentCompsForSearchUrl(
  searchUrl: string,
  options?: EnrichRentalAppraisalOptions,
): Promise<{ comps: RentalComp[]; provider: "apify" | "brightdata" }> {
  if (hasApifyReaConfig()) {
    try {
      const records = await scrapeApifyReaRentSearch({
        searchUrl,
        maxItems: getApifyReaMaxListings(),
      });
      return { comps: parseApifyReaListings(records), provider: "apify" };
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
  return { comps: parseReaRentDiscoverRecords(records), provider: "brightdata" };
}

async function discoverRentalComps(
  listing: ParsedListing,
  premiumSignals: ReturnType<typeof parseListingPremiumSignals>,
  options?: EnrichRentalAppraisalOptions,
): Promise<RentDiscoverResult> {
  if (options?.searchUrl) {
    const { comps, provider } = await fetchRentCompsForSearchUrl(
      options.searchUrl,
      options,
    );
    return {
      comps,
      searchUrl: options.searchUrl,
      attemptLabel: "override",
      provider,
    };
  }

  const subjectPropertyType = resolveRentSubjectPropertyType(listing);
  const attempts = buildRentDiscoverAttempts(listing, premiumSignals);

  let mergedComps: RentalComp[] = [];
  let lastProvider: RentDiscoverResult["provider"] = hasApifyReaConfig()
    ? "apify"
    : "brightdata";
  let lastSearchUrl = "";
  let lastAttemptLabel = "merged";

  for (const attempt of attempts) {
    const { comps, provider } = await fetchRentCompsForSearchUrl(
      attempt.searchUrl,
      options,
    );
    mergedComps = mergeRentalComps(mergedComps, comps);
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

export async function enrichListingRentalAppraisal(
  listing: ParsedListing,
  options?: EnrichRentalAppraisalOptions,
): Promise<ParsedListing> {
  const warnings = [...listing.warnings];
  const premiumSignals = parseListingPremiumSignals(listing);
  const listingWithSignals: ParsedListing = {
    ...listing,
    landAreaSqm: premiumSignals.landAreaSqm ?? listing.landAreaSqm,
  };

  if (!hasRentDiscoverConfig()) {
    warnings.push(
      "Rental appraisal skipped: Apify or Bright Data REA rent discovery is not configured.",
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
    const { listing: withSuburb } = await enrichLtrSuburbMarket(listingWithSignals);

    const subjectPropertyType = resolveRentSubjectPropertyType(withSuburb);

    const { comps: discoveredComps, searchUrl, attemptLabel, provider } =
      await discoverRentalComps(withSuburb, premiumSignals, options);

    const comps = orderRentalCompsForListing(discoveredComps, withSuburb);

    if (comps.length < MIN_RENT_COMPS_FOR_BAND) {
      pushUniqueWarning(
        warnings,
        `Rental appraisal: only ${comps.length} rent listings returned from REA (need at least ${MIN_RENT_COMPS_FOR_BAND}).`,
      );
      return finishRentalAppraisalEnrichment({
        ...withSuburb,
        rentalComps: comps,
        rentalAppraisal: {
          ...withSuburb.rentalAppraisal,
          selectedCompListingIds: defaultSelectedCompListingIds({
            ...withSuburb,
            rentalComps: comps,
          }),
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
      tier: tierOverride,
      tierSetting,
      premiumSignals,
      strictFeaturedPropertyType: true,
      maxFeaturedComps: 6,
    };

    let band = computeRentBandFromComps(comps, rentBandOptions);

    if (!band) {
      warnings.push("Rental appraisal: could not compute a rent band from REA listings.");
      return finishRentalAppraisalEnrichment({
        ...withSuburb,
        rentalComps: comps,
        warnings,
      });
    }

    const bedrooms = withSuburb.bedrooms!;
    const domainMedian = await fetchDomainSuburbRentMedian({
      suburb: withSuburb.suburb!,
      state: withSuburb.state!,
      postcode: withSuburb.postcode!,
      bedrooms,
      propertyType: withSuburb.propertyType,
    }).catch(() => null);

    const reaBedMedian = computeReaBedroomRentMedian(comps, bedrooms);
    const reaBedP75 = computeReaBedroomRentPercentile(comps, bedrooms, 0.75);
    const rentFloor = resolveSuburbRentFloor({
      domainMedian,
      reaBedMedian,
      reaBedP75,
      suburbMarket: withSuburb.ltrSuburbMarket,
      bedrooms,
      premium: premiumResult.premium,
    });

    if (rentFloor) {
      const beforeMin = band.weeklyMin;
      band = applyRentBandSuburbFloor(band, rentFloor);
      if (band.weeklyMin > beforeMin) {
        warnings.push(
          `Rental appraisal band raised to align with suburb benchmark ($${rentFloor.weeklyRent}/wk from ${rentFloor.source.replace(/_/g, " ")}).`,
        );
      }
    } else if (domainMedian == null) {
      warnings.push(
        "Rental appraisal: Domain suburb rent median unavailable; band uses REA comps only.",
      );
    }

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
      `Rental appraisal from ${provider === "apify" ? "Apify" : "Bright Data"} REA rent comps (n=${band.compCount}, median $${band.weeklyMidpoint}/wk).`,
    );

    const enriched = await finishRentalAppraisalEnrichment({
      ...withSuburb,
      purpose: withSuburb.purpose ?? "lease",
      displayPrice: withSuburb.displayPrice ?? displayPrice,
      rentalAppraisal: {
        weeklyMin: band.weeklyMin,
        weeklyMax: band.weeklyMax,
        weeklyMidpoint: band.weeklyMidpoint,
        selectedCompListingIds: defaultSelectedCompListingIds({
          ...withSuburb,
          rentalComps: comps,
        }),
        source: provider === "apify" ? "apify_rea" : "rea_discover",
        compCount: comps.length,
        searchUrl,
        premiumTier: premiumResult.premium,
        premiumReasons: premiumResult.reasons,
        rentFloorWeekly: rentFloor?.weeklyRent,
        rentFloorSource: rentFloor?.source,
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
