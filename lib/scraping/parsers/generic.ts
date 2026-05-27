import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import {
  emptyListing,
  extractNumbers,
  uniqueStrings,
} from "@/lib/scraping/parsers/utils";

function extractFromText(text: string) {
  const bedrooms = text.match(/(\d+)\s*(bed|bedroom)/i);
  const bathrooms = text.match(/(\d+)\s*(bath|bathroom)/i);
  const carSpaces = text.match(/(\d+)\s*(car|garage|parking)/i);

  return {
    bedrooms: bedrooms ? Number(bedrooms[1]) : undefined,
    bathrooms: bathrooms ? Number(bathrooms[1]) : undefined,
    carSpaces: carSpaces ? Number(carSpaces[1]) : undefined,
  };
}

export function parseGenericListing(html: string, _url: string): ParsedListing {
  const $ = cheerio.load(html);
  const listing = emptyListing();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  listing.title =
    $("h1").first().text().trim() ||
    $('[class*="property"], [class*="listing"], [id*="property"]').first().text().trim() ||
    undefined;

  listing.description =
    $('meta[name="description"]').attr("content") ??
    $("article p").first().text().trim() ??
    undefined;

  const priceMatch = bodyText.match(
    /\$[\d,]+(?:\.\d+)?(?:\s*(?:pw|per week|p\/w|pm|per month))?/i,
  );
  if (priceMatch) {
    listing.displayPrice = priceMatch[0];
  }

  const addressMatch = bodyText.match(
    /\d+\s+[A-Za-z0-9\s,'-]+,\s*[A-Za-z\s]+,\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s*\d{4}/,
  );
  if (addressMatch) {
    listing.address = addressMatch[0];
  }

  Object.assign(listing, extractFromText(bodyText));

  $("img").each((_, img) => {
    const src = $(img).attr("src") ?? $(img).attr("data-src");
    if (src && !/logo|icon|avatar|sprite/i.test(src)) {
      listing.images.push(src);
    }
  });

  listing.images = uniqueStrings(listing.images).slice(0, 12);

  if (listing.title || listing.address) {
    listing.confidence = "low";
  }

  return listing;
}
