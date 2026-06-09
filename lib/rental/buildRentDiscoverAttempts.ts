import { adjacentRentSearchPostcodes } from "@/lib/rental/adjacentRentSearchPostcodes";
import {
  buildReaRentSearchUrl,
  type BuildReaRentSearchUrlOptions,
  type ReaRentSearchInput,
} from "@/lib/rental/buildReaRentSearchUrl";
import {
  deriveReaRentSearchKeywords,
  shouldUseLuxuryRentSearch,
} from "@/lib/rental/deriveReaRentSearchKeywords";
import { nearbyRentSearchSuburbs } from "@/lib/rental/nearbyRentSearchSuburbs";
import type { ListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import type { ParsedListing } from "@/lib/types";

export type RentDiscoverAttempt = {
  label: string;
  input: ReaRentSearchInput;
  searchUrl: string;
};

function pushAttempt(
  attempts: RentDiscoverAttempt[],
  label: string,
  input: ReaRentSearchInput,
  urlOptions?: BuildReaRentSearchUrlOptions,
) {
  attempts.push({
    label,
    input,
    searchUrl: buildReaRentSearchUrl(input, urlOptions),
  });
}

function buildSearchInput(
  listing: ParsedListing,
  bedrooms: number,
  options: {
    propertyType?: string;
    includeBathrooms?: boolean;
    includeCarSpaces?: boolean;
    featureKeywords?: string[];
    additionalPostcodes?: string[];
    suburb?: string;
    state?: string;
    postcode?: string;
  },
): ReaRentSearchInput {
  const input: ReaRentSearchInput = {
    suburb: (options.suburb ?? listing.suburb)!.trim(),
    state: (options.state ?? listing.state)!.trim(),
    postcode: (options.postcode ?? listing.postcode)!.trim(),
    bedrooms,
  };

  if (options.propertyType?.trim()) {
    input.propertyType = options.propertyType;
  }

  if (options.includeBathrooms && listing.bathrooms != null && listing.bathrooms > 0) {
    input.bathrooms = listing.bathrooms;
  }

  if (options.includeCarSpaces && listing.carSpaces != null && listing.carSpaces > 0) {
    input.carSpaces = listing.carSpaces;
  }

  if (options.featureKeywords?.length) {
    input.featureKeywords = options.featureKeywords;
  }

  if (options.additionalPostcodes?.length) {
    input.additionalPostcodes = options.additionalPostcodes;
  }

  return input;
}

/**
 * Progressive REA rent SERPs: tightest match first (type + suburb + beds + bath + park),
 * then drop parking, baths, bedroom tolerance. Typed paths only — no unit/house mixing.
 */
function pushTypedSuburbLadder(
  attempts: RentDiscoverAttempt[],
  listing: ParsedListing,
  propertyType: string,
  bedrooms: number,
  labelPrefix: string,
  location?: { suburb: string; state: string; postcode: string },
) {
  const loc = location
    ? {
        suburb: location.suburb,
        state: location.state,
        postcode: location.postcode,
      }
    : undefined;

  const hasBath = listing.bathrooms != null && listing.bathrooms > 0;
  const hasPark = listing.carSpaces != null && listing.carSpaces > 0;

  if (hasBath || hasPark) {
    pushAttempt(
      attempts,
      `${labelPrefix}-type-bed-bath-park-suburb`,
      buildSearchInput(listing, bedrooms, {
        propertyType,
        includeBathrooms: true,
        includeCarSpaces: true,
        ...loc,
      }),
    );
  }

  if (hasPark && hasBath) {
    pushAttempt(
      attempts,
      `${labelPrefix}-type-bed-bath-suburb`,
      buildSearchInput(listing, bedrooms, {
        propertyType,
        includeBathrooms: true,
        includeCarSpaces: false,
        ...loc,
      }),
    );
  }

  pushAttempt(
    attempts,
    `${labelPrefix}-type-bed-suburb`,
    buildSearchInput(listing, bedrooms, {
      propertyType,
      includeBathrooms: false,
      includeCarSpaces: false,
      ...loc,
    }),
  );

  const subjectPostcode = (loc?.postcode ?? listing.postcode)!.trim();
  const adjacentPostcodes = adjacentRentSearchPostcodes(subjectPostcode);
  if (adjacentPostcodes.length > 0) {
    pushAttempt(
      attempts,
      `${labelPrefix}-type-bed-adjacent-postcodes`,
      buildSearchInput(listing, bedrooms, {
        propertyType,
        includeBathrooms: false,
        includeCarSpaces: false,
        additionalPostcodes: adjacentPostcodes,
        ...loc,
      }),
      { includePropertyTypeInPath: false },
    );
  }

  if (bedrooms > 2) {
    pushAttempt(
      attempts,
      `${labelPrefix}-type-bed-minus-one-suburb`,
      buildSearchInput(listing, bedrooms - 1, {
        propertyType,
        includeBathrooms: false,
        includeCarSpaces: false,
        ...loc,
      }),
    );
  }
}

function pushUntypedSuburbLadder(
  attempts: RentDiscoverAttempt[],
  listing: ParsedListing,
  bedrooms: number,
  labelPrefix: string,
) {
  const hasBath = listing.bathrooms != null && listing.bathrooms > 0;
  const hasPark = listing.carSpaces != null && listing.carSpaces > 0;

  if (hasBath || hasPark) {
    pushAttempt(
      attempts,
      `${labelPrefix}-bed-bath-park-suburb`,
      buildSearchInput(listing, bedrooms, {
        includeBathrooms: true,
        includeCarSpaces: true,
      }),
    );
  }

  if (hasPark && hasBath) {
    pushAttempt(
      attempts,
      `${labelPrefix}-bed-bath-suburb`,
      buildSearchInput(listing, bedrooms, {
        includeBathrooms: true,
        includeCarSpaces: false,
      }),
    );
  }

  pushAttempt(
    attempts,
    `${labelPrefix}-bed-suburb`,
    buildSearchInput(listing, bedrooms, {
      includeBathrooms: false,
      includeCarSpaces: false,
    }),
  );

  const adjacentPostcodes = adjacentRentSearchPostcodes(listing.postcode!.trim());
  if (adjacentPostcodes.length > 0) {
    pushAttempt(
      attempts,
      `${labelPrefix}-bed-adjacent-postcodes`,
      buildSearchInput(listing, bedrooms, {
        includeBathrooms: false,
        includeCarSpaces: false,
        additionalPostcodes: adjacentPostcodes,
      }),
      { includePropertyTypeInPath: false },
    );
  }

  if (bedrooms > 2) {
    pushAttempt(
      attempts,
      `${labelPrefix}-bed-minus-one-suburb`,
      buildSearchInput(listing, bedrooms - 1, {
        includeBathrooms: false,
        includeCarSpaces: false,
      }),
    );
  }
}

export function buildRentDiscoverAttempts(
  listing: ParsedListing,
  premiumSignals: ListingPremiumSignals,
): RentDiscoverAttempt[] {
  const bedrooms = listing.bedrooms!;
  const propertyType = resolveRentSubjectPropertyType(listing);
  const useLuxury = shouldUseLuxuryRentSearch(listing, premiumSignals);
  const luxuryKeywords = useLuxury
    ? deriveReaRentSearchKeywords(listing, premiumSignals)
    : [];
  const attempts: RentDiscoverAttempt[] = [];

  if (propertyType) {
    pushTypedSuburbLadder(attempts, listing, propertyType, bedrooms, "primary");

    if (luxuryKeywords.length > 0) {
      pushAttempt(
        attempts,
        "primary-type-bed-suburb-luxury",
        buildSearchInput(listing, bedrooms, {
          propertyType,
          includeBathrooms: false,
          includeCarSpaces: false,
          featureKeywords: luxuryKeywords,
        }),
      );
    }

    for (const neighbor of nearbyRentSearchSuburbs(
      listing.suburb!,
      listing.state!,
      listing.postcode!,
    ).slice(0, 5)) {
      pushTypedSuburbLadder(
        attempts,
        listing,
        propertyType,
        bedrooms,
        `neighbor-${neighbor.suburb.toLowerCase().replace(/\s+/g, "-")}`,
        neighbor,
      );
    }
  } else {
    pushUntypedSuburbLadder(attempts, listing, bedrooms, "primary");
  }

  return attempts;
}
