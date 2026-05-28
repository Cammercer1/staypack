import { generateListingDescription } from "@/lib/openai/generateListingDescription";
import type { Listing } from "@/lib/types";

const MIN_CUSTOM_DESCRIPTION_LENGTH = 300;

/** Skip auto-expand when the agent already has rich, edited webpage copy. */
export function shouldAutoExpandListingDescription(
  existing?: Pick<Listing, "listing_description" | "scraped_listing_json"> | null,
) {
  const current = existing?.listing_description?.trim() ?? "";
  if (!current) return true;

  const previousScraped =
    existing?.scraped_listing_json?.description?.trim() ?? "";

  if (previousScraped && current === previousScraped) {
    return true;
  }

  if (current.length < MIN_CUSTOM_DESCRIPTION_LENGTH) {
    return true;
  }

  return false;
}

export async function expandListingDescriptionAfterScrape(
  listing: Listing,
  existingBeforeScrape?: Pick<
    Listing,
    "listing_description" | "scraped_listing_json"
  > | null,
) {
  if (!shouldAutoExpandListingDescription(existingBeforeScrape)) {
    return { description: listing.listing_description, expanded: false as const };
  }

  const description = await generateListingDescription(listing);
  return { description, expanded: true as const };
}
