import {
  hasBrightDataReaConfig,
  scrapeBrightDataReaRentDiscover,
} from "@/lib/brightdata/client";
import type { RentAppraisalConfig } from "@/lib/delivery/rentAppraisalConfig";
import { fetchDomainSuburbRentMedian } from "@/lib/scraping/domain/fetchDomainSuburbRentMedian";
import {
  buildReaRentSearchUrl,
  type ReaRentSearchInput,
} from "@/lib/rental/buildReaRentSearchUrl";
import { applyRentBandSuburbFloor } from "@/lib/rental/applyRentBandSuburbFloor";
import {
  computeRentBandFromComps,
  formatWeeklyRentRange,
  type RentBandTier,
} from "@/lib/rental/computeRentBand";
import { detectPremiumRentSubject } from "@/lib/rental/detectPremiumRentSubject";
import { enrichLtrSuburbMarket } from "@/lib/propradar/enrichLtrSuburbMarket";
import { parseListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import { parseReaRentDiscoverRecords } from "@/lib/rental/parseReaRentDiscover";
import {
  computeReaBedroomRentMedian,
  computeReaBedroomRentPercentile,
  resolveSuburbRentFloor,
} from "@/lib/rental/resolveSuburbRentFloor";
import type { ParsedListing } from "@/lib/types";
import type { RentalComp } from "@/lib/rental/types";

export type EnrichRentalAppraisalOptions = {
  /** Override SERP URL (for tests). */
  searchUrl?: string;
  limitPages?: number;
  /** Delivery tenant rent_appraisal config (tier override). */
  rentAppraisalConfig?: RentAppraisalConfig | null;
};

const MIN_RENT_COMPS = 5;

function hasMinimumFields(listing: ParsedListing) {
  return Boolean(
    listing.suburb?.trim() &&
      listing.state?.trim() &&
      listing.postcode?.trim() &&
      listing.bedrooms != null &&
      listing.bedrooms > 0,
  );
}

type RentDiscoverAttempt = {
  label: string;
  input: ReaRentSearchInput;
};

/** REA bath/parking filters often return too few comps for large homes — widen progressively. */
function buildRentDiscoverAttempts(listing: ParsedListing): RentDiscoverAttempt[] {
  const suburb = listing.suburb!.trim();
  const state = listing.state!.trim();
  const postcode = listing.postcode!.trim();
  const bedrooms = listing.bedrooms!;
  const propertyType = listing.propertyType;

  const attempts: RentDiscoverAttempt[] = [
    {
      label: "beds-type-suburb",
      input: { suburb, state, postcode, bedrooms, propertyType },
    },
  ];

  if (bedrooms > 2) {
    attempts.push({
      label: "beds-minus-one-type-suburb",
      input: {
        suburb,
        state,
        postcode,
        bedrooms: bedrooms - 1,
        propertyType,
      },
    });
  }

  attempts.push({
    label: "beds-suburb",
    input: { suburb, state, postcode, bedrooms },
  });

  return attempts;
}

async function discoverRentalComps(
  listing: ParsedListing,
  options?: EnrichRentalAppraisalOptions,
): Promise<{
  comps: RentalComp[];
  searchUrl: string;
  attemptLabel: string;
}> {
  if (options?.searchUrl) {
    const records = await scrapeBrightDataReaRentDiscover({
      searchUrl: options.searchUrl,
      limitPages: options?.limitPages ?? 1,
    });
    return {
      comps: parseReaRentDiscoverRecords(records),
      searchUrl: options.searchUrl,
      attemptLabel: "override",
    };
  }

  const attempts = buildRentDiscoverAttempts(listing);
  let best = { comps: [] as RentalComp[], searchUrl: "", attemptLabel: "" };

  for (const attempt of attempts) {
    const searchUrl = buildReaRentSearchUrl(attempt.input);
    const records = await scrapeBrightDataReaRentDiscover({
      searchUrl,
      limitPages: options?.limitPages ?? 1,
    });
    const comps = parseReaRentDiscoverRecords(records);

    if (comps.length >= MIN_RENT_COMPS) {
      return { comps, searchUrl, attemptLabel: attempt.label };
    }

    if (comps.length > best.comps.length) {
      best = { comps, searchUrl, attemptLabel: attempt.label };
    }
  }

  return best;
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

  if (!hasBrightDataReaConfig()) {
    warnings.push(
      "Rental appraisal skipped: Bright Data REA dataset is not configured.",
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

    const { comps, searchUrl, attemptLabel } = await discoverRentalComps(
      withSuburb,
      options,
    );

    if (comps.length < MIN_RENT_COMPS) {
      warnings.push(
        `Rental appraisal: only ${comps.length} rent listings returned from REA (need at least ${MIN_RENT_COMPS}).`,
      );
      return finishRentalAppraisalEnrichment({
        ...withSuburb,
        rentalComps: comps,
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
      signals: premiumSignals,
    });

    const rentBandOptions = {
      subjectPropertyType: withSuburb.propertyType,
      preferSuburb: withSuburb.suburb,
      subjectBedrooms: withSuburb.bedrooms ?? undefined,
      subjectBathrooms: withSuburb.bathrooms ?? undefined,
      tier: tierOverride,
      tierSetting,
      premiumSignals,
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

    if (attemptLabel !== "beds-type-suburb") {
      warnings.push(
        `Rental appraisal used widened REA rent search (${attemptLabel}) to find enough comparables.`,
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

    warnings.push(
      `Rental appraisal from REA rent comps (n=${band.compCount}, median $${band.weeklyMidpoint}/wk).`,
    );

    return finishRentalAppraisalEnrichment({
      ...withSuburb,
      purpose: withSuburb.purpose ?? "lease",
      displayPrice: withSuburb.displayPrice ?? displayPrice,
      rentalAppraisal: {
        weeklyMin: band.weeklyMin,
        weeklyMax: band.weeklyMax,
        weeklyMidpoint: band.weeklyMidpoint,
        source: "rea_discover",
        compCount: band.compCount,
        searchUrl,
        premiumTier: premiumResult.premium,
        premiumReasons: premiumResult.reasons,
        rentFloorWeekly: rentFloor?.weeklyRent,
        rentFloorSource: rentFloor?.source,
      },
      rentalComps: band.featuredComps,
      warnings,
    });
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Rental appraisal failed: ${error.message}`
        : "Rental appraisal failed.",
    );
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
