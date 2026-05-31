import type { ParsedListing } from "@/lib/types";
import {
  isBotCheckpointHtml,
  parseAddressFromListingUrl,
} from "@/lib/scraping/parseAddressFromUrl";
import { emptyListing } from "@/lib/scraping/parsers/utils";

export function parseMcGrathListing(html: string, url: string): ParsedListing {
  const listing = emptyListing();
  const fromUrl = parseAddressFromListingUrl(url);

  if (fromUrl) {
    Object.assign(listing, fromUrl);
    listing.warnings = [...fromUrl.warnings ?? []];
  }

  if (isBotCheckpointHtml(html)) {
    listing.warnings.push(
      "McGrath blocked automated access (Vercel security checkpoint). Using URL-derived address when available.",
    );
  }

  return listing;
}
