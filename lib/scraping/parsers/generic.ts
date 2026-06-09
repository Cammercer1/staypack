import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
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

/** e.g. `12/136 Foo Road, Suburb, QLD 4218` → street + suburb + state + postcode */
function splitAustralianAddressLine(line: string) {
  const match = line.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2,3})\s*(\d{4})?/i);
  if (!match) {
    return { address: line.trim() };
  }

  return {
    address: match[1]?.trim(),
    suburb: match[2]?.trim(),
    state: match[3]?.trim().toUpperCase(),
    postcode: match[4]?.trim(),
  };
}

function addressFromTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const withComma = normalized.match(
    /^(\d+\/\d+\s+[^,]+),\s*([^,]+),\s*([A-Z]{2,3})\s*(\d{4})/i,
  );
  if (withComma) {
    return {
      address: withComma[1]?.trim(),
      suburb: withComma[2]?.trim(),
      state: withComma[3]?.trim().toUpperCase(),
      postcode: withComma[4]?.trim(),
    };
  }

  const spaced = normalized.match(
    /^(\d+\/\d+\s+.+)\s+([A-Z][A-Z\s'-]+),\s*([A-Z]{2,3})\s*(\d{4})/,
  );
  if (spaced) {
    return {
      address: spaced[1]?.trim(),
      suburb: spaced[2]?.trim(),
      state: spaced[3]?.trim().toUpperCase(),
      postcode: spaced[4]?.trim(),
    };
  }

  return null;
}

function applyUnitPrefixFromTitle(title: string, streetAddress?: string) {
  const unit = title.replace(/\s+/g, " ").trim().match(/^(\d+\/\d+)\s+/)?.[1];
  if (!unit || !streetAddress?.trim()) {
    return streetAddress;
  }

  const street = streetAddress.trim();
  if (street.startsWith(unit)) {
    return street;
  }

  const withoutLeadingNumber = street.replace(/^\d+\s+/, "").trim();
  return `${unit} ${withoutLeadingNumber}`;
}

export function parseGenericListing(html: string, url: string): ParsedListing {
  const $ = cheerio.load(html);
  const listing = emptyListing();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const isDomainHost = (() => {
    try {
      return /domain\.com\.au$/i.test(new URL(url).hostname.replace(/^www\./i, ""));
    } catch {
      return false;
    }
  })();

  listing.title =
    $("h1").first().text().trim() ||
    $('[class*="property"], [class*="listing"], [id*="property"]').first().text().trim() ||
    undefined;

  listing.description =
    $('meta[name="description"]').attr("content") ??
    $("article p").first().text().trim() ??
    undefined;

  if (!isDomainHost) {
    const priceMatch = bodyText.match(
      /\$[\d,]+(?:\.\d+)?(?:\s*(?:pw|per week|p\/w|pm|per month))?/i,
    );
    if (priceMatch) {
      listing.displayPrice = normalizeDisplayPrice(priceMatch[0]);
    }
  }

  const addressMatch = bodyText.match(
    /\d+\s*[A-Za-z0-9/]*\s*[A-Za-z0-9\s,'-]+,\s*[A-Za-z\s]+,\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s*\d{4}/,
  );
  if (addressMatch) {
    Object.assign(listing, splitAustralianAddressLine(addressMatch[0]));
  }

  const fromTitle = listing.title ? addressFromTitle(listing.title) : null;
  if (fromTitle) {
    listing.address = fromTitle.address ?? listing.address;
    listing.suburb = listing.suburb ?? fromTitle.suburb;
    listing.state = listing.state ?? fromTitle.state;
    listing.postcode = listing.postcode ?? fromTitle.postcode;
  } else if (listing.address && !listing.suburb) {
    Object.assign(listing, splitAustralianAddressLine(listing.address));
  }

  if (listing.title && listing.address) {
    listing.address = applyUnitPrefixFromTitle(listing.title, listing.address);
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
