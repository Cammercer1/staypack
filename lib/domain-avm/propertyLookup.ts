import {
  fetchDomainJson,
  hasDomainAvmConfig,
  normalizeDomainAvm,
} from "./client";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { buildScrapedListingFields } from "@/lib/listings/buildScrapedListingFields";
import { getMetaKeyForUrl } from "@/lib/listings/listingImageMeta";
import { sameProperty } from "@/lib/listings/propertyIdentity";
import type {
  LookupMedia,
  PropertyCandidate,
} from "@/lib/listings/propertyLookupTypes";
import type { Listing, ParsedListing } from "@/lib/types";

type Obj = Record<string, unknown>;
const object = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const array = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const string = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const count = (v: unknown): number | undefined =>
  (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) &&
  Number.isFinite(Number(v)) &&
  Number(v) >= 0
    ? Number(v)
    : undefined;
function httpUrl(v: unknown) {
  const text = string(v);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return ["https:", "http:"].includes(url.protocol) ? text : undefined;
  } catch {
    return undefined;
  }
}

export async function searchDomainProperties(
  query: string,
): Promise<PropertyCandidate[]> {
  if (!hasDomainAvmConfig()) return [];
  const response = object(
    await fetchDomainJson(
      "/estimates/auto-complete",
      new URLSearchParams({ query }),
    ),
  );
  return array(response.data)
    .map(object)
    .flatMap((candidate) => {
      const slug = string(candidate.urlSlug);
      const address = string(candidate.address);
      const streetNumber = string(candidate.streetNumber);
      const streetName = string(candidate.streetName);
      if (
        !slug ||
        !/^[a-z0-9-]+$/.test(slug) ||
        !address ||
        !streetNumber ||
        !streetName
      )
        return [];
      const unit = string(candidate.unitNumber);
      return [
        {
          source: "domain" as const,
          slug,
          address,
          streetAddress:
            `${unit ? `${unit}/` : ""}${streetNumber} ${streetName} ${string(candidate.streetTypeLong) ?? string(candidate.streetType) ?? ""}`.trim(),
          suburb: string(candidate.suburb) ?? "",
          state: string(candidate.state) ?? "",
          postcode: string(candidate.postcode) ?? "",
        },
      ];
    })
    .slice(0, 8);
}

function profileMedia(profile: Obj): LookupMedia[] {
  return array(profile.media)
    .map(object)
    .flatMap((item) => {
      // The plain `url` is often only a 150px thumbnail. Prefer the supplied full-size variant.
      const full = Object.entries(item).find(([key]) =>
        key.includes('"width":2040'),
      )?.[1];
      const url = httpUrl(full) ?? httpUrl(item.url);
      if (!url) return [];
      return [
        {
          url,
          role:
            item.type === "floorplan"
              ? ("floor_plan" as const)
              : ("photo" as const),
          date: string(item.date)?.slice(0, 10),
          current: false,
        },
      ];
    });
}
function listingMedia(details: Obj): LookupMedia[] {
  return array(details.media)
    .map(object)
    .flatMap((item) => {
      const url = httpUrl(item.image_url);
      if (
        !url ||
        item.media_type !== "image" ||
        !["photo", "floor_plan"].includes(String(item.type))
      )
        return [];
      return [
        {
          url,
          role:
            item.type === "floor_plan"
              ? ("floor_plan" as const)
              : ("photo" as const),
          current: true,
        },
      ];
    });
}
function activeAgents(details: Obj): ParsedListing["agents"] {
  return array(object(details.advertiser).agency_listing_contacts)
    .map(object)
    .flatMap((contact) => {
      const name =
        string(contact.display_full_name) ??
        [string(contact.first_name), string(contact.last_name)]
          .filter(Boolean)
          .join(" ");
      if (!name) return [];
      const phones = array(contact.phone_numbers).map(object);
      const phone =
        string(phones.find((p) => p.type === "Mobile")?.number) ??
        string(phones.find((p) => p.type === "General")?.number);
      return [
        {
          name,
          email: string(contact.email_address),
          phone,
          photo_url: httpUrl(contact.image_url),
        },
      ];
    })
    .slice(0, 2);
}
function liveAddress(details: Obj) {
  const a = object(object(details.metadata).address_components);
  const unit = string(a.unit_number);
  return {
    property_address:
      a.street_number && a.street
        ? `${unit ? `${unit}/` : ""}${a.street_number} ${a.street}`
        : string(details.address),
    suburb: string(a.suburb),
    state: string(a.state_short),
    postcode: string(a.postcode),
  };
}

export function normalizePropertyLookup(
  profile: Obj,
  slug: string,
  activeDetails?: Obj,
): Listing {
  const a = object(profile.address);
  const unit = string(a.unitNumber);
  const street = [
    string(a.streetNumber),
    string(a.street) ??
      [string(a.streetName), string(a.streetTypeLong)]
        .filter(Boolean)
        .join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const address = `${unit ? `${unit}/` : ""}${street}`;
  const sourceAddress = {
    property_address: address,
    suburb: string(a.suburbName),
    state: string(a.state),
    postcode: string(a.postcode),
  };
  if (!street || !sourceAddress.suburb)
    throw new Error(
      "The property profile has no complete address. Enter the details manually.",
    );
  const active =
    activeDetails &&
    activeDetails.lifecycle_status === "Live" &&
    sameProperty(sourceAddress, liveAddress(activeDetails))
      ? activeDetails
      : undefined;
  const live = active
    ? array(profile.listings)
        .map(object)
        .find(
          (l) =>
            l.status === "LIVE" && Number(l.listingId) === Number(active.id),
        )
    : undefined;
  const current = live ? active : undefined;
  const listingUrl = current
    ? (httpUrl(current.seo_url) ??
      httpUrl(live?.seoUrl) ??
      `https://www.domain.com.au/${slug}-${current.id}`)
    : null;
  const history = profileMedia(profile);
  const media = current ? listingMedia(current) : history;
  const selectedDate = media
    .filter((m) => m.role === "photo" && m.date)
    .map((m) => m.date!)
    .sort()
    .at(-1);
  // Historical images need explicit selection; active listing photos are ready to review.
  const selected = current
    ? media
        .filter((m) => m.role === "photo")
        .map((m) => m.url)
        .slice(0, 25)
    : [];
  const agents = current ? activeAgents(current) : [];
  const lookup = {
    source: "domain" as const,
    matchedAt: new Date().toISOString(),
    profileSlug: slug,
    activeListingId: current ? Number(current.id) : undefined,
    agencyName: current ? string(object(current.advertiser).name) : undefined,
    features: array(profile.features).filter(
      (v): v is string => typeof v === "string",
    ),
    media,
    originalAgents: agents,
  };
  const parsed: ParsedListing = {
    address,
    suburb: sourceAddress.suburb,
    state: sourceAddress.state,
    postcode: sourceAddress.postcode,
    propertyType: string(current?.dwelling_type) ?? string(profile.type),
    purpose: current
      ? current.search_mode === "rent"
        ? "lease"
        : "sale"
      : undefined,
    bedrooms: current
      ? (count(current.bedroom_count) ?? count(profile.bedrooms))
      : count(profile.bedrooms),
    bathrooms: current
      ? (count(current.bathroom_count) ?? count(profile.bathrooms))
      : count(profile.bathrooms),
    // A missing current parking count is unknown, not zero or an old profile value.
    carSpaces: current
      ? count(
          current.parking_count ??
            current.car_space_count ??
            current.car_spaces,
        )
      : count(profile.parkingSpaces),
    title: string(current?.headline),
    description: string(current?.description),
    displayPrice: string(current?.price),
    floorAreaSqm:
      count(profile['internalArea({"unit":"SQUARE_METERS"})']) || undefined,
    images: media.map((m) => m.url),
    agents,
    confidence: "high",
    warnings: [],
    domainAvm: normalizeDomainAvm(profile, slug),
    propertyLookup: lookup,
  };
  const coordinates = object(current?.geo_location ?? a.geolocation);
  const fields = buildScrapedListingFields(listingUrl ?? "", parsed);
  return createEmptyListingDraft({
    ...fields,
    listing_url: listingUrl,
    latitude:
      typeof coordinates.latitude === "number" &&
      Number.isFinite(coordinates.latitude)
        ? coordinates.latitude
        : null,
    longitude:
      typeof coordinates.longitude === "number" &&
      Number.isFinite(coordinates.longitude)
        ? coordinates.longitude
        : null,
    hero_image_url: selected[0] ?? null,
    selected_image_urls: selected,
    listing_image_meta: Object.fromEntries(
      media.map((m) => [
        getMetaKeyForUrl(m.url),
        {
          role: m.role,
          label:
            m.role === "floor_plan"
              ? "Floor plan"
              : m.date
                ? `Photo · ${m.date}`
                : "Listing photo",
        },
      ]),
    ),
    // Used by the UI for grouping only; historical photos remain unselected.
    scraped_listing_json: {
      ...parsed,
      warnings:
        !current && selectedDate
          ? [
              `Historical photos are dated ${selectedDate}. Review them before use.`,
            ]
          : [],
    },
  });
}

export async function lookupDomainProperty(
  candidate: PropertyCandidate,
  suppliedDetails?: Obj,
): Promise<Listing> {
  if (!hasDomainAvmConfig() || !candidate.slug)
    throw new Error(
      "Property lookup is unavailable. You can enter the details manually.",
    );
  const response = object(
    await fetchDomainJson(
      "/estimates/details",
      new URLSearchParams({ query: candidate.slug }),
    ),
  );
  const profile = object(object(response.data).propertyDetails);
  const a = object(profile.address);
  if (
    !sameProperty(
      {
        property_address: candidate.streetAddress,
        suburb: candidate.suburb,
        state: candidate.state,
        postcode: candidate.postcode,
      },
      {
        property_address: string(a.displayAddress),
        suburb: string(a.suburbName),
        state: string(a.state),
        postcode: string(a.postcode),
      },
    )
  )
    throw new Error(
      "The returned profile did not match the selected address. Try another result or enter the details manually.",
    );
  const live = array(profile.listings)
    .map(object)
    .filter(
      (l) =>
        l.status === "LIVE" &&
        ["BUY", "RENT"].includes(String(l.type)) &&
        Number.isSafeInteger(l.listingId),
    );
  let details: Obj | undefined;
  let warning: string | undefined;
  if (live.length) {
    try {
      const data =
        suppliedDetails &&
        Number(suppliedDetails.id) === Number(live[0].listingId)
          ? suppliedDetails
          : object(
              object(
                await fetchDomainJson(
                  "/properties/details",
                  new URLSearchParams({ id: String(live[0].listingId) }),
                ),
              ).data,
            );
      if (Number(data.id) === Number(live[0].listingId)) details = data;
      else
        warning =
          "The active listing could not be verified. Review the property profile and historical photos below.";
    } catch {
      warning =
        "The active listing could not be loaded. Property details are available; you can retry or continue manually.";
    }
  }
  const draft = normalizePropertyLookup(profile, candidate.slug, details);
  if (
    live.length &&
    !draft.scraped_listing_json?.propertyLookup?.activeListingId &&
    !warning
  )
    warning =
      "The active listing no longer matches this property. Review the profile details below.";
  if (warning) draft.scraped_listing_json!.warnings.push(warning);
  if (live.length > 1)
    draft.scraped_listing_json!.warnings.push(
      "More than one active listing was found. Check the sale or lease purpose and imported details.",
    );
  return draft;
}

export async function importDomainProperty(url: string) {
  const parsed = new URL(url);
  const id = parsed.pathname.match(/(?:\/|-)(\d{6,})\/?$/)?.[1];
  if (!id || !["domain.com.au", "www.domain.com.au"].includes(parsed.hostname))
    return null;
  const details = object(
    object(
      await fetchDomainJson("/properties/details", new URLSearchParams({ id })),
    ).data,
  );
  const address = liveAddress(details);
  const query = [
    address.property_address,
    address.suburb,
    address.state,
    address.postcode,
  ]
    .filter(Boolean)
    .join(" ");
  const candidates = await searchDomainProperties(query);
  const candidate = candidates.find((c) =>
    sameProperty(address, {
      property_address: c.streetAddress,
      suburb: c.suburb,
      state: c.state,
      postcode: c.postcode,
    }),
  );
  if (!candidate) return null;
  return lookupDomainProperty(candidate, details);
}
