import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import {
  emptyListing,
  extractNumbers,
  uniqueStrings,
} from "@/lib/scraping/parsers/utils";

/**
 * Harcourts listing parsers — two platforms:
 *
 * 1. harcourts.net (CloudHI) — national portal, e.g. /au/office/{office}/listing/{id}
 *    Static fetch; images on listings-photos.cloudhi.io via fancybox data-src.
 *    Agents in .agents-card (.agent-name, tel: links; email usually modal-only).
 *
 * 2. Franchise *.com.au sites (WordPress Stepps) — e.g. harcourtsnr.com.au/property/...
 *    Static fetch; images in #listing-single__photos (data-lazy on propertyimages.stepps.net).
 *    Agents in .listing-single__agent-card with tel:/mailto: links.
 */
const STEPPS_IMAGE_HOST = "propertyimages.stepps.net";
const CLOUDHI_IMAGE_HOST = "listings-photos.cloudhi.io";

function normalizeSteppsImageUrl(url: string) {
  return url.replace(/\/(o|small|medium|thumb)\//i, "/large/");
}

function normalizeCloudHiImageUrl(url: string) {
  const withoutSize = url.replace(/\/\d+x\d+$/, "");
  return `${withoutSize}/1448x912`;
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

function cloudHiImageKey(url: string) {
  const match = url.match(
    /listings-photos\.cloudhi\.io\/properties\/\d+\/[a-f0-9-]+\.jpg/i,
  );
  return match?.[0] ?? url;
}

function collectCloudHiImages($: cheerio.CheerioAPI) {
  const byKey = new Map<string, string>();

  const addCloudHiUrl = (candidate?: string) => {
    if (!candidate?.includes(CLOUDHI_IMAGE_HOST)) {
      return;
    }
    const key = cloudHiImageKey(candidate);
    byKey.set(key, normalizeCloudHiImageUrl(candidate));
  };

  $('[data-fancybox="gallery-group-1"]').each((_, element) => {
    addCloudHiUrl($(element).attr("data-src"));
  });

  if (!byKey.size) {
    $('img[src*="listings-photos.cloudhi.io"], img[data-src*="listings-photos.cloudhi.io"]').each(
      (_, img) => {
        addCloudHiUrl($(img).attr("data-src") ?? $(img).attr("src"));
      },
    );
  }

  return uniqueStrings([...byKey.values()]).filter(
    (url) => !/logo|icon|avatar|sprite/i.test(url),
  );
}

function extractAgentPhoto(
  $: cheerio.CheerioAPI,
  root: ReturnType<cheerio.CheerioAPI>,
) {
  for (const selector of ["img.agent-card__wrapper-img", "img"]) {
    const img = root.find(selector).first();
    for (const attribute of ["data-lazy-src", "data-src", "src"]) {
      const value = img.attr(attribute)?.trim();
      if (value && !/^data:image\/svg/i.test(value)) {
        return value;
      }
    }

    const noscriptPhoto = img
      .parent()
      .find("noscript img")
      .first()
      .attr("src")
      ?.trim();
    if (noscriptPhoto && !/^data:image\/svg/i.test(noscriptPhoto)) {
      return noscriptPhoto;
    }
  }

  return undefined;
}

function extractTelPhone(root: ReturnType<cheerio.CheerioAPI>) {
  const href = root.find('a[href^="tel:"]').first().attr("href");
  if (!href) {
    return undefined;
  }

  try {
    return decodeURIComponent(href.replace(/^tel:/i, "")).trim();
  } catch {
    return href.replace(/^tel:/i, "").trim();
  }
}

function parseSteppsAgents($: cheerio.CheerioAPI): ParsedListing["agents"] {
  const agents: ParsedListing["agents"] = [];

  $(".listing-single__agent-card").each((_, card) => {
    const root = $(card);
    const name = root.find(".agent-card__details-name").first().text().trim();
    if (!name) {
      return;
    }

    const phone = extractTelPhone(root);
    const email = root
      .find('a[href^="mailto:"]')
      .first()
      .attr("href")
      ?.replace(/^mailto:/i, "")
      .split("?")[0]
      ?.trim();
    const role_title = root
      .find(".agent-card__details-position")
      .first()
      .text()
      .trim();
    const photo_url = extractAgentPhoto($, root);

    agents.push({ name, phone, email, role_title, photo_url });
  });

  return agents;
}

function parseCloudHiAgents($: cheerio.CheerioAPI): ParsedListing["agents"] {
  const agents: ParsedListing["agents"] = [];
  const seen = new Set<string>();

  $(".agents-container").each((_, container) => {
    const root = $(container);
    const name = root.find(".agent-name").first().text().trim();
    if (!name || seen.has(name.toLowerCase())) {
      return;
    }

    seen.add(name.toLowerCase());
    const phone = extractTelPhone(root);
    const photo_url = extractAgentPhoto($, root);

    agents.push({ name, phone, photo_url });
  });

  return agents;
}

function parsePropertyTypeFromSteppsUrl(url: string) {
  const match = url.match(
    /\/property\/([a-z0-9-]+)-(?:nsw|vic|qld|sa|wa|tas|nt|act)-/i,
  );
  return match?.[1]?.replace(/-/g, " ");
}

function parseStateFromSteppsUrl(url: string) {
  const match = url.match(
    /\/property\/[a-z0-9-]+-(nsw|vic|qld|sa|wa|tas|nt|act)-/i,
  );
  return match?.[1]?.toUpperCase();
}

function parseStateFromCloudHiUrl(url: string) {
  const match = url.match(/-(nsw|vic|qld|sa|wa|tas|nt|act)-\d{4}(?:\/)?$/i);
  return match?.[1]?.toUpperCase();
}

function parsePropertyTypeFromMeta($: cheerio.CheerioAPI) {
  const meta =
    $('meta[name="description"]').attr("content") ??
    $('meta[property="og:title"]').attr("content");
  const match = meta?.match(
    /\b(apartment|house|unit|townhouse|villa|land|acreage)\b/i,
  );
  return match?.[1];
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
      listing.title =
        listing.title ??
        (typeof node.description === "string"
          ? node.description.replace(/&amp;/g, "&")
          : undefined);
    } catch {
      listing.warnings.push("Failed to parse Harcourts Residence JSON-LD.");
    }
  });
}

function parseAddressParts(fullAddress: string) {
  const match = fullAddress.match(
    /^(.+?),\s*([^,]+),\s*([A-Z]{2,3})\s*(\d{4})$/i,
  );
  if (!match) {
    return { address: fullAddress.trim() };
  }

  return {
    address: match[1]?.trim(),
    suburb: match[2]?.trim(),
    state: match[3]?.trim().toUpperCase(),
    postcode: match[4]?.trim(),
  };
}

function listingHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function isCloudHiListing(html: string, url: string) {
  const hostname = listingHostname(url);
  return (
    hostname === "harcourts.net" ||
    html.includes("propdetails-v2") ||
    html.includes(CLOUDHI_IMAGE_HOST)
  );
}

function isSteppsListing(html: string) {
  return html.includes("listing-single__") || html.includes(STEPPS_IMAGE_HOST);
}

function parseHarcourtsSteppsListing(html: string, url: string): ParsedListing {
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
  listing.state = parseStateFromSteppsUrl(url);
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
  listing.propertyType = parsePropertyTypeFromSteppsUrl(url);

  applyResidenceJsonLd($, listing);

  listing.images = collectSteppsImages($);
  listing.agents = parseSteppsAgents($);

  if (listing.address && listing.images.length >= 5 && listing.agents.length) {
    listing.confidence = "high";
  } else if (listing.address || listing.images.length) {
    listing.confidence = "medium";
  }

  return listing;
}

function parseHarcourtsCloudHiListing(html: string, url: string): ParsedListing {
  const listing = emptyListing();
  const $ = cheerio.load(html);

  if (!$("body").hasClass("propdetails-v2") && !html.includes(CLOUDHI_IMAGE_HOST)) {
    listing.warnings.push("Page does not appear to be a Harcourts CloudHI listing.");
    return listing;
  }

  const fullAddress =
    $("._property-residential-attributes-mobile-block h3.display-1")
      .first()
      .text()
      .trim() ||
    $("._property-residential-attributes-block h1")
      .first()
      .text()
      .trim() ||
    undefined;

  if (fullAddress) {
    Object.assign(listing, parseAddressParts(fullAddress));
  }

  listing.state = listing.state ?? parseStateFromCloudHiUrl(url);
  listing.title =
    $("._property-residential-attributes-block h2.display-1")
      .first()
      .text()
      .trim()
      .replace(/&amp;/g, "&") || undefined;
  listing.displayPrice = normalizeDisplayPrice(
    $(".price-by-negotiation-container p").first().text().trim() ||
      $("._property-residential-attributes-block h3")
        .first()
        .text()
        .trim() ||
      undefined,
  );
  listing.bedrooms = extractNumbers(
    $("ul.summary li.bed span").first().text(),
  );
  listing.bathrooms = extractNumbers(
    $("ul.summary li.bath span").first().text(),
  );
  listing.carSpaces =
    extractNumbers($("ul.summary li.carports span").first().text()) ??
    extractNumbers($("ul.summary li.garage span").first().text()) ??
    extractNumbers($("ul.summary li.car span").first().text());
  listing.description =
    $(".details-text p").first().text().replace(/\s+/g, " ").trim() ||
    undefined;
  listing.propertyType = parsePropertyTypeFromMeta($);

  applyResidenceJsonLd($, listing);

  listing.images = collectCloudHiImages($);
  listing.agents = parseCloudHiAgents($);

  if (listing.address && listing.images.length >= 5) {
    listing.confidence = listing.agents.length ? "high" : "medium";
  } else if (listing.address || listing.images.length) {
    listing.confidence = "medium";
  }

  return listing;
}

export function parseHarcourtsListing(html: string, url: string): ParsedListing {
  if (isCloudHiListing(html, url)) {
    return parseHarcourtsCloudHiListing(html, url);
  }

  if (isSteppsListing(html)) {
    return parseHarcourtsSteppsListing(html, url);
  }

  const listing = emptyListing();
  listing.warnings.push("Unrecognised Harcourts listing page format.");
  return listing;
}
