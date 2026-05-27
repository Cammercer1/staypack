import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import {
  emptyListing,
  extractNumbers,
  uniqueStrings,
} from "@/lib/scraping/parsers/utils";

function extractImageUrl(item: unknown): string | null {
  if (typeof item === "string") {
    return item;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const candidate =
    record.url ??
    record.src ??
    record.imageUrl ??
    record.image_url ??
    record.fullUrl ??
    record.full_url ??
    record.largeUrl ??
    record.large_url ??
    record.originalUrl ??
    record.original_url;

  return typeof candidate === "string" ? candidate : null;
}

function collectPropertyImages(property: Record<string, unknown>) {
  const urls = new Set<string>();
  const buckets = [
    property.images,
    property.media,
    property.photos,
    property.gallery,
    property.imageGallery,
    property.propertyImages,
    property.listingImages,
  ];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;

    for (const item of bucket) {
      const url = extractImageUrl(item);
      if (url) urls.add(url);

      if (item && typeof item === "object") {
        const nested = item as Record<string, unknown>;
        for (const nestedUrl of [
          nested.url,
          nested.src,
          nested.imageUrl,
          nested.large,
          nested.original,
        ]) {
          if (typeof nestedUrl === "string") {
            urls.add(nestedUrl);
          }
        }
      }
    }
  }

  return uniqueStrings([...urls]).filter((url) => !/logo|icon|avatar|sprite/i.test(url));
}

export function parseRayWhiteListing(html: string, url: string): ParsedListing {
  const listing = emptyListing();

  if (!/raywhite/i.test(url)) {
    return listing;
  }

  const $ = cheerio.load(html);
  const nextData = $("#__NEXT_DATA__").text();

  if (nextData) {
    try {
      const parsed = JSON.parse(nextData);
      const property =
        parsed?.props?.pageProps?.property ??
        parsed?.props?.pageProps?.listing ??
        parsed?.props?.pageProps?.data;

      if (property && typeof property === "object") {
        const record = property as Record<string, unknown>;
        listing.title =
          (record.headline as string | undefined) ??
          (record.title as string | undefined) ??
          (record.name as string | undefined);
        listing.description =
          (record.description as string | undefined) ??
          (record.summary as string | undefined);

        const address = record.address as Record<string, unknown> | undefined;
        listing.address =
          (record.displayAddress as string | undefined) ??
          (address?.display as string | undefined);
        listing.suburb =
          (address?.suburb as string | undefined) ??
          (record.suburb as string | undefined);
        listing.state =
          (address?.state as string | undefined) ??
          (record.state as string | undefined);
        listing.postcode =
          (address?.postcode as string | undefined) ??
          (record.postcode as string | undefined);
        listing.bedrooms =
          (record.bedrooms as number | undefined) ??
          (record.beds as number | undefined) ??
          extractNumbers(String(record.bedroomText ?? ""));
        listing.bathrooms =
          (record.bathrooms as number | undefined) ??
          (record.baths as number | undefined) ??
          extractNumbers(String(record.bathroomText ?? ""));
        listing.carSpaces =
          (record.carSpaces as number | undefined) ??
          (record.garages as number | undefined) ??
          extractNumbers(String(record.parkingText ?? ""));
        listing.displayPrice =
          (record.displayPrice as string | undefined) ??
          (record.priceDisplay as string | undefined) ??
          ((record.price as Record<string, unknown> | undefined)?.display as
            | string
            | undefined);

        listing.images = collectPropertyImages(record);

        listing.confidence = listing.address ? "high" : "medium";
      }
    } catch {
      listing.warnings.push("Failed to parse Ray White embedded JSON.");
    }
  }

  return listing;
}
