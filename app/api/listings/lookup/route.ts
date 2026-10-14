import { assertRequestedCountry, assertPropertyCountry, assertListingUrlCountry } from "@/lib/property-market/agencyCountry";
import { searchPlaceProperties } from "@/lib/geocoding/places";
import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAgency } from "@/lib/auth/requireUser";
import {
  importDomainProperty,
  lookupDomainProperty,
  searchDomainProperties,
} from "@/lib/domain-avm/propertyLookup";
import {
  lookupGoogleProperty,
  addressOnlyPropertyDraft,
  searchGoogleProperties,
} from "@/lib/geocoding/propertyLookup";
import {
  propertyCandidateSchema,
  type PropertyCandidate,
} from "@/lib/listings/propertyLookupTypes";
import { findExistingProperty } from "@/lib/listings/findExistingProperty";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { buildScrapedListingFields } from "@/lib/listings/buildScrapedListingFields";
import { extractListingFromUrl } from "@/lib/scraping/extractListing";
import { resolveListingImageRole } from "@/lib/listings/listingImageMeta";
import type { Listing } from "@/lib/types";
import { userFacingPropertyMessage } from "@/lib/listings/userFacingPropertyMessages";

export const maxDuration = 120;
const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    country: z.enum(["AU", "US"]).optional(),
    query: z
      .string()
      .trim()
      .min(5, "Enter a street address and suburb")
      .max(300),
  }),
  z.object({ action: z.literal("select"), country: z.enum(["AU", "US"]).optional(), candidate: propertyCandidateSchema }),
  z.object({
    action: z.literal("import"),
    country: z.enum(["AU", "US"]).optional(),
    url: z
      .string()
      .url()
      .max(2000)
      .refine((value) => {
        const url = new URL(value);
        return (
          ["https:", "http:"].includes(url.protocol) &&
          !url.username &&
          !url.password &&
          !/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|169\.254\.)/.test(
            url.hostname,
          )
        );
      }, "Enter a public listing URL"),
  }),
]);

export async function POST(request: Request) {
  try {
    // Authorize before any paid provider call. All reads are scoped to this agency.
    const { supabase, agency } = await requireAgency();
    const body = inputSchema.parse(await request.json());
    const country = assertRequestedCountry(agency, body.country);
    if (body.action === "import") assertListingUrlCountry(country, body.url);
    if (body.action === "search") {
      let candidates: PropertyCandidate[];
      let domainFailed = false;
      try {
        candidates = country === "US" ? await searchPlaceProperties(body.query, country) : await searchDomainProperties(body.query);
      } catch {
        domainFailed = true;
        candidates = [];
      }
      if (!candidates.length && country === "AU") {
        try {
          candidates = await searchGoogleProperties(body.query, country);
        } catch {
          /* Manual entry remains available. */
        }
      }
      return NextResponse.json({
        candidates,
        message: candidates.length
          ? country === "AU" && candidates[0].source === "google"
            ? "Property profiles were unavailable. These address suggestions will need property details entered manually."
            : null
          : domainFailed
            ? "Property lookup is temporarily unavailable. Try again or enter the details manually."
            : "No matching property found. Try the full address, including the unit and suburb, or enter it manually.",
      });
    }
    let draft: Listing;
    if (body.action === "select") {
      assertPropertyCountry(agency, { ...body.candidate, country: body.candidate.country ?? (body.candidate.source === "zillow" ? "US" : "AU") });
      if ((country === "US" && body.candidate.source === "domain") || (country === "AU" && body.candidate.source === "zillow")) throw new Error("Choose a property in your agency country.");
      const duplicate = await findExistingProperty(supabase, agency.id, {
        country: body.candidate.country,
        property_address: body.candidate.streetAddress,
        suburb: body.candidate.suburb,
        state: body.candidate.state,
        postcode: body.candidate.postcode,
      });
      if (duplicate) return NextResponse.json({ duplicate });
      if (country === "US") {
        // Verify a Google place's actual country before asking Zillow for its profile.
        const verified = body.candidate.source === "google" ? await lookupGoogleProperty(body.candidate) : null;
        try {
          draft = await (await import("@/lib/us-property/lookup")).lookupUsProperty(body.candidate);
        } catch {
          draft = verified ?? addressOnlyPropertyDraft({ ...body.candidate, country: "US" },
            "We couldn't retrieve details for this exact home. Check the address and add the property details manually, or go back and paste its Zillow link.");
        }
      } else {
        draft = body.candidate.source === "domain"
          ? await lookupDomainProperty(body.candidate)
          : await lookupGoogleProperty(body.candidate);
      }
    } else if (country === "US") {
      draft = await (await import("@/lib/us-property/lookup")).importUsProperty(body.url);
    } else {
      let imported: Listing | null = null;
      try {
        imported = await importDomainProperty(body.url);
      } catch {
        /* Existing resilient URL importer is the fallback. */
      }
      if (imported) draft = imported;
      else {
        const result = await extractListingFromUrl(body.url);
        if (!result.listing.address?.trim())
          throw new Error(
            "We could not find the property address. Try address lookup or enter the details manually.",
          );
        draft = createEmptyListingDraft(
          buildScrapedListingFields(body.url, result.listing),
        );
        draft.scraped_listing_json!.propertyLookup = {
          source: "url",
          matchedAt: new Date().toISOString(),
          originalAgents: result.listing.agents,
          media: result.listing.images.map((url) => ({
            url,
            role: resolveListingImageRole(draft.listing_image_meta, url),
            current: true,
          })),
        };
        draft.selected_image_urls = draft
          .scraped_listing_json!.propertyLookup.media.filter(
            (m) => m.role === "photo",
          )
          .map((m) => m.url)
          .slice(0, 25);
        draft.hero_image_url = draft.selected_image_urls[0] ?? null;
      }
    }
    assertPropertyCountry(agency, draft);
    const duplicate = await findExistingProperty(supabase, agency.id, draft);
    // A preview only: no listing, scrape job or agent directory entry is created here.
    return NextResponse.json({ draft, duplicate });
  } catch (error) {
    unstable_rethrow(error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? userFacingPropertyMessage(error.message)
              : "Unable to look up this property. Try again or enter the details manually.",
      },
      { status: 400 },
    );
  }
}
