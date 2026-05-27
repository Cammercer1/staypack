import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import {
  emptyListing,
  extractNumbers,
  uniqueStrings,
} from "@/lib/scraping/parsers/utils";

/**
 * Harcourts agency sites (WordPress + Stepps child theme).
 *
 * Methodology:
 * - Static fetch is sufficient; listing HTML is server-rendered (no Browserless required).
 * - Photos: all gallery images live in #listing-single__photos (hidden modal), using
 *   data-lazy on propertyimages.stepps.net URLs. Hero grid duplicates a subset via data-lazy-src.
 * - Agents: repeating .listing-single__agent-card blocks with tel:/mailto: links.
 * - Listing meta: .listing-single__* selectors for address, price, beds/baths/cars, description.
 * - Address fallback: application/ld+json Residence block.
 * - One parser covers all Harcourts *.com.au office subdomains on the Stepps platform.
 */
const STEPPS_IMAGE_HOST = "propertyimages.stepps.net";

function normalizeSteppsImageUrl(url: string) {
  return url.replace(/\/(o|small|medium|thumb)\//i, "/large/");
}

function collectSteppsImages($: cheerio.CheerioAPI) {
  const urls = new Set<string>();

  $("#listing-single__photos img").each((_, img) => {
    const candidate =
      $(img).attr("data-lazy") ??
      $(img).attr("data-lazy-src") ??
      $(img).attr("src");
    if (candidate?.includes(STEPPS_IMAGE_HOST)) {
      urls.add(normalizeSteppsImageUrl(candidate));
    }
  });

  $("[data-lazy-src]").each((_, element) => {
    const candidate = $(element).attr("data-lazy-src");
    if (candidate?.includes(STEPPS_IMAGE_HOST)) {
      urls.add(normalizeSteppsImageUrl(candidate));
    }
  });

  return uniqueStrings([...urls]).filter(
    (url) => !/logo|icon|avatar|sprite/i.test(url),
  );
}

function parseAgents($: cheerio.CheerioAPI): ParsedListing["agents"] {
  const agents: ParsedListing["agents"] = [];

  $(".listing-single__agent-card").each((_, card) => {
    const root = $(card);
    const name = root.find(".agent-card__details-name").first().text().trim();
    if (!name) {
      return;
    }

    const phone = root
      .find('a[href^="tel:"]')
      .first()
      .attr("href")
      ?.replace(/^tel:/i, "")
      .trim();
    const email = root
      .find('a[href^="mailto:"]')
      .first()
      .attr("href")
      ?.replace(/^mailto:/i, "")
      .split("?")[0]
      ?.trim();

    agents.push({ name, phone, email });
  });

  return agents;
}

function parsePropertyTypeFromUrl(url: string) {
  const match = url.match(
    /\/property\/([a-z0-9-]+)-(?:nsw|vic|qld|sa|wa|tas|nt|act)-/i,
  );
  return match?.[1]?.replace(/-/g, " ");
}

function parseStateFromUrl(url: string) {
  const match = url.match(
    /\/property\/[a-z0-9-]+-(nsw|vic|qld|sa|wa|tas|nt|act)-/i,
  );
  return match?.[1]?.toUpperCase();
}

function applyResidenceJsonLd($: cheerio.CheerioAPI, listing: ParsedListing) {
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!raw) {
      return;
    }

    try {
      const node = JSON.parse(raw);
      if (node["@type"] !== "Residence" || !node.address) {
        return;
      }

      const address = node.address;
      listing.address = listing.address ?? address.streetAddress;
      listing.suburb = listing.suburb ?? address.addressLocality;
      listing.state = listing.state ?? address.addressRegion;
      listing.postcode = listing.postcode ?? address.postalCode;
    } catch {
      listing.warnings.push("Failed to parse Harcourts Residence JSON-LD.");
    }
  });
}

export function parseHarcourtsListing(html: string, url: string): ParsedListing {
  const listing = emptyListing();
  const $ = cheerio.load(html);

  if (!$("[id^='listing-single']").length) {
    listing.warnings.push("Page does not appear to be a Harcourts Stepps listing.");
    return listing;
  }

  const titleEl = $(".listing-single__property-title").first().clone();
  titleEl.find(".listing-single__suburb-name").remove();
  const street = titleEl.text().replace(/\s+/g, " ").trim();
  const suburb = $(".listing-single__suburb-name")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  listing.address = street || undefined;
  listing.suburb = suburb || undefined;
  listing.state = parseStateFromUrl(url);
  listing.title =
    $(".listing-single__heading").first().text().trim() || street || undefined;
  listing.displayPrice = normalizeDisplayPrice(
    $(".listing-single__price").first().text().replace(/\s+/g, " ").trim() ||
      undefined,
  );
  listing.bedrooms = extractNumbers(
    $(".listing-single__attr--bed .listing-single__attr--value").first().text(),
  );
  listing.bathrooms = extractNumbers(
    $(".listing-single__attr--bath .listing-single__attr--value").first().text(),
  );
  listing.carSpaces = extractNumbers(
    $(".listing-single__attr--car .listing-single__attr--value").first().text(),
  );
  listing.description =
    $(".listing-single__content-full").text().replace(/\s+/g, " ").trim() ||
    undefined;
  listing.propertyType = parsePropertyTypeFromUrl(url);

  applyResidenceJsonLd($, listing);

  listing.images = collectSteppsImages($);
  listing.agents = parseAgents($);

  if (listing.address && listing.images.length >= 5 && listing.agents.length) {
    listing.confidence = "high";
  } else if (listing.address || listing.images.length) {
    listing.confidence = "medium";
  }

  return listing;
}
