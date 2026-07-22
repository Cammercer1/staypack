import type { ApifyReaListingRecord } from "@/lib/apify/types";
import { normalizeReaImageUrls } from "@/lib/scraping/rea/normalizeReaImageUrl";
import {
  resolveReaFloorAreaSqm,
  resolveReaLandAreaSqm,
  resolveReaSoldDate,
} from "@/lib/scraping/rea/parseReaPropertyFacts";
import { parseLandAreaSqm } from "@/lib/rental/parseListingPremiumSignals";
import type { ParsedListing } from "@/lib/types";

function parseCount(value: number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function detectPurpose(record: ApifyReaListingRecord): ParsedListing["purpose"] {
  const channel = record.channel?.trim().toLowerCase();
  if (channel === "rent" || channel === "lease") {
    return "lease";
  }
  if (channel === "buy" || channel === "sale" || channel === "sold") {
    return "sale";
  }

  const status = record.status?.trim().toLowerCase();
  if (status === "rent" || status === "lease") {
    return "lease";
  }
  if (status === "buy" || status === "sale" || status === "sold") {
    return "sale";
  }

  if (record.isRent) {
    return "lease";
  }
  if (record.isBuy) {
    return "sale";
  }

  return undefined;
}

function isSoldListing(record: ApifyReaListingRecord) {
  return (
    record.channel?.trim().toLowerCase() === "sold" ||
    record.status?.trim().toLowerCase().includes("sold") === true
  );
}

function buildAddress(record: ApifyReaListingRecord) {
  const street = record.address?.trim();
  const suburb = record.suburb?.trim();
  if (street && suburb) {
    return `${street}, ${suburb}`;
  }
  return street || suburb;
}

function buildDisplayPrice(record: ApifyReaListingRecord) {
  if (record.price?.trim()) {
    return record.price.trim();
  }

  const structured = record.listing?.price;
  if (structured?.display?.trim()) {
    return structured.display.trim();
  }

  if (structured?.value != null && Number.isFinite(structured.value) && structured.value > 0) {
    const period = structured.period?.trim().toLowerCase();
    const suffix =
      period && !period.includes("week") ? "" : " per week";
    return `$${structured.value.toLocaleString("en-AU")}${suffix}`;
  }

  return undefined;
}

function buildTitle(record: ApifyReaListingRecord, address?: string) {
  if (record.title?.trim()) {
    return record.title.trim();
  }

  const propertyType = record.propertyType?.trim();
  const bedrooms = parseCount(record.bedrooms);
  const parts = [
    propertyType,
    bedrooms != null ? `${bedrooms} bed` : null,
    address,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : address;
}

function normalizeState(state?: string | null) {
  const trimmed = state?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length <= 3 ? trimmed.toUpperCase() : trimmed;
}

/** Apify often returns `emails: ["a@x.com,b@y.com"]` — one comma-joined string per agent. */
function expandApifyAgentEmails(emails: string[] | undefined) {
  return (emails ?? [])
    .flatMap((entry) => entry.split(/[,;]+/))
    .map((part) => part.trim())
    .filter((part) => part.includes("@") && !part.includes(" "));
}

function isTrackingEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  return /^[0-9a-f-]{20,}$/i.test(local);
}

export function pickApifyAgentEmail(
  emails: string[] | undefined,
  agentName?: string,
): string | undefined {
  const candidates = expandApifyAgentEmails(emails).filter(
    (email) => !isTrackingEmail(email),
  );

  if (!candidates.length) {
    return undefined;
  }

  const nameParts = agentName
    ?.trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length >= 3);

  if (nameParts?.length) {
    const matched = candidates.find((email) => {
      const local = email.split("@")[0]?.toLowerCase() ?? "";
      return nameParts.some((part) => local.includes(part));
    });
    if (matched) {
      return matched;
    }
  }

  return candidates[0];
}

export function parseApifyReaRecord(record: ApifyReaListingRecord): ParsedListing {
  const address = buildAddress(record);
  const images = normalizeReaImageUrls(
    (record.images ?? []).filter(
      (url) => typeof url === "string" && url.startsWith("http"),
    ),
  );
  const agents = (record.agents ?? [])
    .filter((agent) => agent.name?.trim())
    .map((agent) => ({
      name: agent.name?.trim(),
      phone: agent.phoneNumber?.trim() || undefined,
      email: pickApifyAgentEmail(agent.emails, agent.name?.trim()),
      photo_url: agent.image?.trim() || undefined,
      role_title: agent.jobTitle?.trim() || undefined,
    }));

  const description = record.description?.trim();
  const listing: ParsedListing = {
    title: buildTitle(record, address),
    address,
    suburb: record.suburb?.trim(),
    state: normalizeState(record.state),
    postcode: record.postcode?.trim(),
    propertyType: record.propertyType?.trim(),
    purpose: detectPurpose(record),
    bedrooms: parseCount(record.bedrooms),
    bathrooms: parseCount(record.bathrooms),
    carSpaces: parseCount(record.carSpaces),
    description,
    displayPrice: buildDisplayPrice(record),
    soldDate: isSoldListing(record) ? resolveReaSoldDate(record) : undefined,
    landAreaSqm:
      resolveReaLandAreaSqm(record) ??
      (description ? parseLandAreaSqm(description) : undefined),
    floorAreaSqm: resolveReaFloorAreaSqm(record),
    images,
    agents,
    confidence:
      address && images.length && description
        ? "high"
        : address
          ? "medium"
          : "low",
    warnings: [],
  };

  if (!address) {
    listing.warnings.push("Apify REA record did not include a street address.");
  }

  return listing;
}
