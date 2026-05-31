import type { ParsedListing } from "@/lib/types";
import { listingHostname } from "@/lib/scraping/parsers/registry";

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

function titleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function isBotCheckpointHtml(html: string) {
  return /vercel security checkpoint|we're verifying your browser/i.test(html);
}

/**
 * McGrath listing URLs encode the address in the path, e.g.
 * /property/42-suttor-road-moss-vale-nsw-2577-59P7099
 */
function parseMcGrathPropertySlug(slug: string): Partial<ParsedListing> | null {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length < 5) {
    return null;
  }

  const postcode = parts[parts.length - 2];
  const state = parts[parts.length - 3]?.toUpperCase();

  if (!/^\d{4}$/.test(postcode) || !AU_STATES.has(state)) {
    return null;
  }

  const remainder = parts.slice(0, -3);
  if (!/^\d+[a-z]?$/i.test(remainder[0] ?? "")) {
    return null;
  }

  let streetEndIndex = remainder.length;
  for (let i = 1; i < remainder.length; i++) {
    if (STREET_TYPE_TOKENS.has(remainder[i].toLowerCase())) {
      streetEndIndex = i + 1;
      break;
    }
  }

  const streetTokens = remainder.slice(0, streetEndIndex);
  const street =
    /^\d+$/.test(streetTokens[0] ?? "") &&
    /^\d+$/.test(streetTokens[1] ?? "") &&
    streetTokens.length >= 3
      ? `${streetTokens[0]}/${streetTokens[1]} ${titleCaseWords(streetTokens.slice(2).join(" "))}`
      : titleCaseWords(streetTokens.join(" "));
  const suburb = titleCaseWords(remainder.slice(streetEndIndex).join(" "));

  if (!street || !suburb) {
    return null;
  }

  return {
    address: `${street}, ${suburb}`,
    suburb,
    state,
    postcode,
    title: `${street}, ${suburb} ${state} ${postcode}`,
    confidence: "medium",
    warnings: [],
  };
}

function extractPropertySlug(url: string) {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/\/property\/([^/]+)\/?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function parseAddressFromListingUrl(url: string): Partial<ParsedListing> | null {
  const hostname = listingHostname(url);
  const slug = extractPropertySlug(url);

  if (!slug) {
    return null;
  }

  if (hostname?.endsWith("mcgrath.com.au")) {
    const parsed = parseMcGrathPropertySlug(slug);
    if (parsed) {
      return {
        ...parsed,
        warnings: [
          "Address parsed from McGrath listing URL (page HTML was unavailable or blocked).",
        ],
      };
    }
  }

  return null;
}
