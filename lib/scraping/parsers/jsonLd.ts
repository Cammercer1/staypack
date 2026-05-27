import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import {
  emptyListing,
  extractNumbers,
  uniqueStrings,
} from "@/lib/scraping/parsers/utils";

function parseAddressParts(address?: string) {
  if (!address) return {};

  const match = address.match(
    /^(.+?),\s*([^,]+),\s*([A-Z]{2,3})\s*(\d{4})?/i,
  );

  if (!match) {
    return { address };
  }

  return {
    address: match[1]?.trim(),
    suburb: match[2]?.trim(),
    state: match[3]?.trim().toUpperCase(),
    postcode: match[4]?.trim(),
  };
}

export function parseJsonLdListing(html: string, _url: string): ParsedListing {
  const $ = cheerio.load(html);
  const listing = emptyListing();

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        const type = String(node["@type"] ?? "");
        if (!/Product|Residence|House|Apartment|SingleFamilyResidence|RealEstateListing/i.test(type)) {
          continue;
        }

        listing.title = listing.title ?? node.name ?? node.headline;
        listing.description = listing.description ?? node.description;
        listing.propertyType = listing.propertyType ?? node["@type"];

        const address = node.address;
        if (typeof address === "string") {
          Object.assign(listing, parseAddressParts(address));
        } else if (address && typeof address === "object") {
          listing.address =
            listing.address ??
            [address.streetAddress, address.addressLocality]
              .filter(Boolean)
              .join(", ");
          listing.suburb = listing.suburb ?? address.addressLocality;
          listing.state = listing.state ?? address.addressRegion;
          listing.postcode = listing.postcode ?? address.postalCode;
        }

        if (node.numberOfRooms) {
          listing.bedrooms = listing.bedrooms ?? extractNumbers(String(node.numberOfRooms));
        }

        const image = node.image;
        if (typeof image === "string") {
          listing.images.push(image);
        } else if (Array.isArray(image)) {
          listing.images.push(...image.map(String));
        } else if (image?.url) {
          listing.images.push(String(image.url));
        }

        if (node.offers?.price) {
          listing.displayPrice =
            listing.displayPrice ??
            normalizeDisplayPrice(String(node.offers.price));
        }
      }
    } catch {
      listing.warnings.push("Failed to parse one JSON-LD block.");
    }
  });

  listing.images = uniqueStrings(listing.images);
  if (listing.title || listing.address || listing.images.length) {
    listing.confidence = listing.address ? "high" : "medium";
  }

  return listing;
}
