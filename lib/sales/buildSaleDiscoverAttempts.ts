import { buildRentDiscoverAttempts } from "@/lib/rental/buildRentDiscoverAttempts";
import type { ListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import {
  buildReaSaleSearchUrl,
  type ReaSaleChannel,
  type ReaSaleSearchInput,
} from "@/lib/sales/buildReaSaleSearchUrl";
import type { ParsedListing } from "@/lib/types";

export type SaleDiscoverAttempt = {
  label: string;
  channel: ReaSaleChannel;
  input: ReaSaleSearchInput;
  searchUrl: string;
};

/**
 * Progressive REA sold/buy SERPs reusing the rent discovery ladder
 * (type+bed+bath+park → drop filters → adjacent postcodes → nearby suburbs →
 * bed-minus-one). Sold attempts drive the price band; buy attempts fill the pool.
 */
export function buildSaleDiscoverAttemptsForChannel(
  listing: ParsedListing,
  premiumSignals: ListingPremiumSignals,
  channel: ReaSaleChannel,
): SaleDiscoverAttempt[] {
  return buildRentDiscoverAttempts(listing, premiumSignals).map((attempt) => ({
    label: `${channel}-${attempt.label}`,
    channel,
    input: attempt.input,
    searchUrl: buildReaSaleSearchUrl(channel, attempt.input, {
      // Rent ladder drops the property-type path segment for multi-postcode SERPs.
      includePropertyTypeInPath: !attempt.label.includes("adjacent-postcodes"),
    }),
  }));
}

export function buildSaleDiscoverAttempts(
  listing: ParsedListing,
  premiumSignals: ListingPremiumSignals,
): SaleDiscoverAttempt[] {
  return [
    ...buildSaleDiscoverAttemptsForChannel(listing, premiumSignals, "sold"),
    ...buildSaleDiscoverAttemptsForChannel(listing, premiumSignals, "buy"),
  ];
}
