import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import { emptyListing, uniqueStrings } from "@/lib/scraping/parsers/utils";

type DomainComponentProps = Record<string, unknown>;

function formatAudPrice(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted =
      millions % 1 === 0 ? String(millions) : millions.toFixed(2).replace(/\.?0+$/, "");
    return `$${formatted} million`;
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function joinDescription(description: unknown) {
  if (typeof description === "string") {
    return description.trim() || undefined;
  }

  if (!Array.isArray(description)) {
    return undefined;
  }

  const paragraphs = description
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  return paragraphs.length ? paragraphs.join("\n\n") : undefined;
}

function extractGalleryImages(componentProps: DomainComponentProps) {
  const urls = new Set<string>();
  const gallery = componentProps.gallery as
    | {
        photos?: Array<{
          mediaUrl?: string;
          imageUrl?: string;
          url?: string;
        }>;
        slides?: Array<{
          images?: {
            original?: { url?: string };
            tablet?: { url?: string };
            mobile?: { url?: string };
          };
        }>;
      }
    | undefined;

  for (const photo of gallery?.photos ?? []) {
    const candidate = photo.mediaUrl ?? photo.imageUrl ?? photo.url;
    if (typeof candidate === "string" && candidate.startsWith("http")) {
      urls.add(candidate.replace(/\/\d+x\d+\//, "/w1600-h1200/"));
    }
  }

  for (const slide of gallery?.slides ?? []) {
    const original = slide.images?.original?.url;
    if (typeof original === "string" && original.startsWith("http")) {
      urls.add(original);
    }
  }

  const heroImages = componentProps.heroImages;
  if (Array.isArray(heroImages)) {
    for (const image of heroImages) {
      if (typeof image === "string") {
        urls.add(image);
      }
    }
  }

  return uniqueStrings([...urls]).slice(0, 24);
}

type DomainPriceNode = {
  priceDetails?: { rawValues?: { exactPriceV2?: number }; displayPrice?: string };
};

function collectRootGraphPriceNodes(rootGraphQuery: unknown): DomainPriceNode[] {
  if (!rootGraphQuery || typeof rootGraphQuery !== "object") {
    return [];
  }

  if (Array.isArray(rootGraphQuery)) {
    return rootGraphQuery.flatMap((entry) => collectRootGraphPriceNodes(entry));
  }

  const record = rootGraphQuery as Record<string, unknown>;
  const nodes: DomainPriceNode[] = [];

  if (record.priceDetails && typeof record.priceDetails === "object") {
    nodes.push(record as DomainPriceNode);
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      nodes.push(...collectRootGraphPriceNodes(value));
    }
  }

  return nodes;
}

function extractRootGraphPrice(componentProps: DomainComponentProps) {
  const nodes = collectRootGraphPriceNodes(componentProps.rootGraphQuery);

  for (const node of nodes) {
    const exact = node.priceDetails?.rawValues?.exactPriceV2;
    if (typeof exact === "number" && exact > 0) {
      return {
        exactPriceV2: exact,
        displayPrice: node.priceDetails?.displayPrice,
      };
    }
  }

  return null;
}

const WITHHELD_PRICE_LABEL =
  /^(?:contact(?:\s+agent)?|call|enquir|auction|eoi|express(?:ions?)?\s+of\s+interest|poa|price\s+on\s+(?:application|request)|tender|by\s+negotiation|negotiable)\b/i;

function isWithheldPublicPrice(label: string) {
  const trimmed = label.replace(/\s+/g, " ").trim();
  return WITHHELD_PRICE_LABEL.test(trimmed) && !/\$\s*\d/.test(trimmed);
}

function extractDisplayPrice(componentProps: DomainComponentProps) {
  const header = componentProps.header as Record<string, unknown> | undefined;
  const priceGuide = componentProps.priceGuide as Record<string, unknown> | undefined;
  const listingSummary = componentProps.listingSummary as
    | Record<string, unknown>
    | undefined;
  const graphPrice = extractRootGraphPrice(componentProps);

  const displayCandidates = [
    graphPrice?.displayPrice,
    header?.displayPrice,
    listingSummary?.displayPrice,
    componentProps.displayPrice,
    componentProps.price,
    priceGuide?.displayPrice,
  ];

  for (const candidate of displayCandidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }

    if (isWithheldPublicPrice(candidate)) {
      return normalizeDisplayPrice(candidate);
    }
  }

  for (const candidate of displayCandidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }

    const normalized = normalizeDisplayPrice(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const rawValues = (header?.rawValues ?? listingSummary?.rawValues) as
    | Record<string, unknown>
    | undefined;

  const exactPrice =
    graphPrice?.exactPriceV2 ??
    rawValues?.exactPriceV2 ??
    rawValues?.exactPrice ??
    componentProps.exactPriceV2;

  return formatAudPrice(exactPrice);
}

function extractAgents(componentProps: DomainComponentProps) {
  const agents = componentProps.agents;
  if (!Array.isArray(agents)) {
    return [];
  }

  return agents
    .map((agent) => {
      if (!agent || typeof agent !== "object") {
        return null;
      }

      const record = agent as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : undefined;
      const phone =
        (typeof record.mobile === "string" ? record.mobile : undefined) ??
        (typeof record.phone === "string" ? record.phone : undefined);
      const email = typeof record.email === "string" ? record.email : undefined;
      const photo_url =
        typeof record.photo === "string" ? record.photo : undefined;

      if (!name && !phone && !email) {
        return null;
      }

      return { name, phone, email, photo_url };
    })
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));
}

function detectPurpose(componentProps: DomainComponentProps) {
  const listingSummary = componentProps.listingSummary as
    | Record<string, unknown>
    | undefined;
  const mode = String(listingSummary?.mode ?? componentProps.mode ?? "").toLowerCase();

  if (mode === "rent") {
    return "lease" as const;
  }
  if (mode === "buy" || mode === "sale") {
    return "sale" as const;
  }

  return undefined;
}

export function parseDomainListing(html: string, _url: string): ParsedListing {
  const listing = emptyListing();
  const $ = cheerio.load(html);
  const nextData = $("#__NEXT_DATA__").text();

  if (!nextData) {
    listing.warnings.push("Domain page did not include embedded listing data.");
    return listing;
  }

  try {
    const parsed = JSON.parse(nextData) as {
      props?: { pageProps?: { componentProps?: DomainComponentProps } };
    };
    const componentProps = parsed.props?.pageProps?.componentProps;
    if (!componentProps) {
      listing.warnings.push("Domain listing payload was empty.");
      return listing;
    }

    const listingSummary = componentProps.listingSummary as
      | Record<string, unknown>
      | undefined;

    listing.title =
      (typeof componentProps.headline === "string" ? componentProps.headline : undefined) ??
      (typeof componentProps.metaTitle === "string"
        ? componentProps.metaTitle.replace(/\s*\|\s*Domain$/i, "")
        : undefined);

    listing.address =
      typeof componentProps.address === "string" ? componentProps.address : undefined;
    listing.suburb =
      typeof componentProps.suburb === "string"
        ? componentProps.suburb
        : undefined;
    listing.state =
      typeof componentProps.stateAbbreviation === "string"
        ? componentProps.stateAbbreviation
        : undefined;
    listing.postcode =
      typeof componentProps.postcode === "string" ? componentProps.postcode : undefined;

    listing.propertyType =
      (typeof componentProps.primaryPropertyType === "string"
        ? componentProps.primaryPropertyType
        : undefined) ??
      (typeof listingSummary?.propertyType === "string"
        ? listingSummary.propertyType
        : undefined);

    listing.bedrooms =
      (typeof componentProps.beds === "number" ? componentProps.beds : undefined) ??
      (typeof listingSummary?.beds === "number" ? listingSummary.beds : undefined);
    listing.bathrooms =
      (typeof componentProps.bathrooms === "number"
        ? componentProps.bathrooms
        : undefined) ??
      (typeof listingSummary?.baths === "number" ? listingSummary.baths : undefined);
    listing.carSpaces =
      (typeof componentProps.carspaces === "number"
        ? componentProps.carspaces
        : undefined) ??
      (typeof listingSummary?.parking === "number"
        ? listingSummary.parking
        : undefined);

    listing.description = joinDescription(componentProps.description);
    listing.displayPrice = extractDisplayPrice(componentProps);
    listing.images = extractGalleryImages(componentProps);
    listing.agents = extractAgents(componentProps);
    listing.purpose = detectPurpose(componentProps);

    listing.confidence =
      listing.address && listing.images.length && listing.description
        ? "high"
        : listing.address
          ? "medium"
          : "low";
  } catch {
    listing.warnings.push("Failed to parse Domain embedded JSON.");
  }

  return listing;
}
