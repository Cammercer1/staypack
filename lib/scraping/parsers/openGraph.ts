import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import { emptyListing, extractMeta, uniqueStrings } from "@/lib/scraping/parsers/utils";

export function parseOpenGraphListing(html: string, _url: string): ParsedListing {
  const $ = cheerio.load(html);
  const listing = emptyListing();

  listing.title = extractMeta($, "og:title") ?? $("title").first().text().trim();
  listing.description =
    extractMeta($, "og:description") ??
    extractMeta($, "description") ??
    undefined;

  const image =
    extractMeta($, "og:image") ??
    $('meta[property="og:image:secure_url"]').attr("content");
  if (image) {
    listing.images = uniqueStrings([image]);
  }

  if (listing.title || listing.description || listing.images.length) {
    listing.confidence = listing.images.length ? "medium" : "low";
  }

  return listing;
}
