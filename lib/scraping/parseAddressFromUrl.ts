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

/**
 * Domain listing URLs encode the address in the path, e.g.
 * /6606-88-the-esplanade-surfers-paradise-qld-4217-2020878542
 */
function parseDomainListingSlug(slug: string): Partial<ParsedListing> | null {
  const parts = slug.split("-").filter(Boolean);
  if (parts.length < 5) {
    return null;
  }

  let endIndex = parts.length;
  if (/^\d{7,}$/.test(parts[endIndex - 1] ?? "")) {
    endIndex -= 1;
  }

  const postcode = parts[endIndex - 1];
  const state = parts[endIndex - 2]?.toUpperCase();

  if (!/^\d{4}$/.test(postcode) || !AU_STATES.has(state)) {
    return null;
  }

  const remainder = parts.slice(0, endIndex - 2);
  if (remainder.length < 2) {
    return null;
  }

  let streetNumberParts = 1;
  if (
    /^\d+$/.test(remainder[0] ?? "") &&
    /^\d+$/.test(remainder[1] ?? "") &&
    remainder.length >= 3
  ) {
    streetNumberParts = 2;
  } else if (!/^\d+[a-z]?$/i.test(remainder[0] ?? "")) {
    return null;
  }

  const afterNumber = remainder.slice(streetNumberParts);
  if (!afterNumber.length) {
    return null;
  }

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
  if (!streetNameTokens.length || !suburbTokens.length) {
    return null;
  }

  const streetNumber =
    streetNumberParts === 2
      ? `${remainder[0]}/${remainder[1]}`
      : (remainder[0] ?? "");
  const street = `${streetNumber} ${titleCaseWords(streetNameTokens.join(" "))}`;
  const suburb = titleCaseWords(suburbTokens.join(" "));

  if (!street.trim() || !suburb) {
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

function extractDomainListingSlug(url: string) {
  try {
    const { pathname } = new URL(url);
    const segment = pathname.split("/").filter(Boolean).at(-1);
    if (!segment || !/\d-.*-[a-z]{2,3}-\d{4}/i.test(segment)) {
      return null;
    }
    return segment;
  } catch {
    return null;
  }
}

export function parseAddressFromListingUrl(url: string): Partial<ParsedListing> | null {
  const hostname = listingHostname(url);

  if (hostname?.endsWith("domain.com.au")) {
    const slug = extractDomainListingSlug(url);
    if (slug) {
      const parsed = parseDomainListingSlug(slug);
      if (parsed) {
        return {
          ...parsed,
          warnings: [
            "Address parsed from Domain listing URL (page HTML was unavailable or blocked).",
          ],
        };
      }
    }
  }

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
