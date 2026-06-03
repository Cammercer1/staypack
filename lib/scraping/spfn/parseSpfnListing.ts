import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";

const AU_STATES = new Set(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);

const STREET_TYPE_TOKENS = new Set([
  "road",
  "rd",
  "street",
  "st",
  "avenue",
  "ave",
  "drive",
  "dr",
  "court",
  "ct",
  "place",
  "pl",
  "lane",
  "ln",
  "way",
  "crescent",
  "cres",
  "parade",
  "pde",
  "esplanade",
  "esp",
  "boulevard",
  "blvd",
  "terrace",
  "tce",
  "circuit",
  "cct",
  "close",
  "cl",
  "grove",
  "gr",
  "highway",
  "hwy",
]);

const PROPERTY_TYPE_PREFIXES = new Set([
  "apartment",
  "house",
  "unit",
  "villa",
  "townhouse",
  "land",
  "acreage",
  "studio",
]);

function titleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function isSpfnHostname(hostname: string) {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return h === "surfersparadisefn.com.au" || h.endsWith(".surfersparadisefn.com.au");
}

export function isSpfnListingUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!isSpfnHostname(parsed.hostname)) return false;
    return /\/buy-residential-real-estate\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function extractSpfnBuySlug(url: string) {
  try {
    const match = new URL(url).pathname.match(
      /\/buy-residential-real-estate\/([^/]+)\/?$/i,
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Slug example: apartment-1401-67-ferny-avenue-surfers-paradise-qld-11028103559
 * (CRM id suffix; postcode comes from detail page title)
 */
export function parseSpfnBuyResidentialSlug(slug: string): Partial<ParsedListing> | null {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length < 6) return null;
  if (!PROPERTY_TYPE_PREFIXES.has(parts[0]?.toLowerCase() ?? "")) return null;

  let endIndex = parts.length;
  if (/^\d{7,}$/.test(parts[endIndex - 1] ?? "")) {
    endIndex -= 1;
  }

  const state = parts[endIndex - 1]?.toUpperCase();
  if (!AU_STATES.has(state)) return null;

  let remainder = parts.slice(1, endIndex - 1);
  if (remainder.length < 2) return null;

  // villa-5-326-342-marine-parade-... → unit 5, street 326-342
  if (
    remainder.length >= 4 &&
    /^\d{1,2}$/.test(remainder[0] ?? "") &&
    /^\d+$/.test(remainder[1] ?? "") &&
    /^\d+$/.test(remainder[2] ?? "")
  ) {
    remainder = [`${remainder[0]}/${remainder[1]}-${remainder[2]}`, ...remainder.slice(3)];
  }

  let streetNumberParts = 1;
  if (
    /^\d+\/\d+-\d+$/i.test(remainder[0] ?? "") ||
    (/^\d+$/.test(remainder[0] ?? "") &&
      /^\d+$/.test(remainder[1] ?? "") &&
      remainder.length >= 3)
  ) {
    streetNumberParts = /^\d+\/\d+-\d+$/i.test(remainder[0] ?? "") ? 1 : 2;
  } else if (!/^\d+[a-z]?$/i.test(remainder[0] ?? "")) {
    return null;
  }

  const afterNumber = remainder.slice(streetNumberParts);
  if (!afterNumber.length) return null;

  let streetEndInAfter = afterNumber.length;
  for (let i = 0; i < afterNumber.length; i++) {
    if (STREET_TYPE_TOKENS.has(afterNumber[i].toLowerCase())) {
      streetEndInAfter = i + 1;
      break;
    }
  }

  if (streetEndInAfter === afterNumber.length && afterNumber.length >= 3) {
    streetEndInAfter = afterNumber.length - 2;
  } else if (streetEndInAfter === afterNumber.length && afterNumber.length === 2) {
    streetEndInAfter = 1;
  }

  const streetNameTokens = afterNumber.slice(0, streetEndInAfter);
  const suburbTokens = afterNumber.slice(streetEndInAfter);
  if (!streetNameTokens.length || !suburbTokens.length) return null;

  const streetNumber =
    streetNumberParts === 2
      ? `${remainder[0]}/${remainder[1]}`
      : (remainder[0] ?? "").replace(
          /^(\d+)\/(\d+)-(\d+)$/i,
          (_, u, a, b) => `${u}/${a}-${b}`,
        );
  const street = `${streetNumber} ${titleCaseWords(streetNameTokens.join(" "))}`;
  const suburb = titleCaseWords(suburbTokens.join(" "));

  return {
    address: `${street}, ${suburb}`,
    suburb,
    state,
    postcode: "",
    title: `${street}, ${suburb} ${state}`,
    confidence: "medium",
    warnings: ["Address parsed from First National Surfers Paradise listing URL slug."],
  };
}

/** Title: "1401/67 Ferny Avenue Surfers Paradise QLD 4217 - FN Surfers Paradise" */
export function parseSpfnAddressFromTitle(title: string): Partial<ParsedListing> | null {
  const cleaned = title
    .replace(/\s+-\s+(?:First National|FN\b).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(
    /^(.+)\s+(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\s+(\d{4})\s*$/i,
  );
  if (!match) return null;

  const addressLine = match[1].trim().replace(/(\d)\/(\d+)-(\d+)/g, "$1/$2-$3");
  const state = match[2].toUpperCase();
  const postcode = match[3];
  const commaIdx = addressLine.lastIndexOf(",");
  let street = addressLine;
  let suburb = "";

  if (commaIdx > 0) {
    street = addressLine.slice(0, commaIdx).trim();
    suburb = addressLine.slice(commaIdx + 1).trim();
  } else {
    const streetTypeIdx = tokensFindStreetEnd(addressLine);
    if (streetTypeIdx < 0) return null;
    const parts = addressLine.split(/\s+/);
    suburb = parts.slice(streetTypeIdx + 1).join(" ");
    street = parts.slice(0, streetTypeIdx + 1).join(" ");
  }

  return {
    address: `${street}, ${suburb}`,
    suburb: titleCaseWords(suburb),
    state,
    postcode,
    title: `${street}, ${suburb} ${state} ${postcode}`,
    confidence: "high",
    warnings: ["Address parsed from First National listing page title."],
  };
}

function tokensFindStreetEnd(line: string) {
  const parts = line.split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (STREET_TYPE_TOKENS.has(parts[i]?.toLowerCase() ?? "")) {
      return i;
    }
  }
  return -1;
}

export function parseSpfnDetailHtml(html: string): Partial<ParsedListing> | null {
  const $ = cheerio.load(html);
  const candidates = [
    $("title").first().text().trim(),
    $('meta[property="og:title"]').attr("content")?.trim() ?? "",
  ].filter(Boolean);

  for (const text of candidates) {
    const parsed = parseSpfnAddressFromTitle(text);
    if (parsed?.postcode) return parsed;
  }

  return null;
}

export function parseSpfnAddressFromListingUrl(url: string): Partial<ParsedListing> | null {
  const slug = extractSpfnBuySlug(url);
  if (!slug) return null;
  return parseSpfnBuyResidentialSlug(slug);
}
