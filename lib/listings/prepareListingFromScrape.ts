import { findUnknownScrapedAgents } from "@/lib/agents/matchScrapedAgents";
import { enrichScrapedAgentsWithProfiles } from "@/lib/agents/enrichScrapedAgents";
import { buildScrapedListingFields } from "@/lib/listings/buildScrapedListingFields";
import { expandListingDescriptionAfterScrape } from "@/lib/listings/expandListingDescriptionAfterScrape";
import {
  ensureListingLandingProvisioned,
  generateListingSlug,
} from "@/lib/listings/provisionLandingPage";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { extractListingFromUrl } from "@/lib/scraping/extractListing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, AgentProfile, Listing, ParsedListing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PrepareListingFromScrapeResult = {
  listing: Listing;
  parsed: ParsedListing;
  agencyAgents: AgentProfile[];
  warnings: string[];
  unknown_agents: ReturnType<typeof findUnknownScrapedAgents>;
  method: string;
  parser_name: string;
};

async function applyExpandedListingDescription({
  admin,
  listing,
  warnings,
}: {
  admin: SupabaseClient;
  listing: Listing;
  warnings: string[];
}) {
  try {
    const { description, expanded } = await expandListingDescriptionAfterScrape(
      listing,
      null,
    );

    if (!expanded || !description || description === listing.listing_description) {
      return listing;
    }

    const { data, error } = await admin
      .from("listings")
      .update({ listing_description: description })
      .eq("id", listing.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Listing;
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Could not expand listing description: ${error.message}`
        : "Could not expand listing description automatically",
    );
    return listing;
  }
}

function enrichParsedAgentsOnListing(
  parsed: ParsedListing,
  agencyAgents: AgentProfile[],
): ParsedListing {
  if (!agencyAgents.length || !parsed.agents?.length) {
    return parsed;
  }

  return {
    ...parsed,
    agents: enrichScrapedAgentsWithProfiles(parsed.agents, agencyAgents),
  };
}

export async function prepareListingFromScrape({
  agency,
  listingUrl,
  agentProfileId,
}: {
  agency: Agency;
  listingUrl: string;
  /** First assigned agent profile (UI listing assignment parity). */
  agentProfileId?: string | null;
}): Promise<PrepareListingFromScrapeResult> {
  const admin = createAdminClient();
  const warnings: string[] = [];

  const { listing: parsedRaw, method, parserName, warnings: scrapeWarnings } =
    await extractListingFromUrl(listingUrl);

  warnings.push(...scrapeWarnings);

  if (!parsedRaw.address?.trim()) {
    throw new Error("Could not extract a property address from this listing");
  }

  const agencyAgents = await loadAgencyAgentProfiles(admin, agency.id);
  const parsed = enrichParsedAgentsOnListing(parsedRaw, agencyAgents);
  const scrapedFields = buildScrapedListingFields(listingUrl, parsed);

  const { data: createdListing, error: listingError } = await admin
    .from("listings")
    .insert({
      agency_id: agency.id,
      status: "active",
      public_slug: generateListingSlug(),
      agent_profile_id: agentProfileId ?? null,
      ...scrapedFields,
    })
    .select("*")
    .single();

  if (listingError || !createdListing) {
    throw new Error(listingError?.message ?? "Failed to create listing");
  }

  let listing = await applyExpandedListingDescription({
    admin,
    listing: createdListing as Listing,
    warnings,
  });

  if (parsed !== parsedRaw) {
    const { data: withAgents, error: agentJsonError } = await admin
      .from("listings")
      .update({ scraped_listing_json: parsed })
      .eq("id", listing.id)
      .select("*")
      .single();

    if (agentJsonError) {
      warnings.push(`Could not persist enriched agent data: ${agentJsonError.message}`);
    } else if (withAgents) {
      listing = withAgents as Listing;
    }
  }

  listing = await ensureListingLandingProvisioned(listing, agency, admin);

  const unknown_agents = findUnknownScrapedAgents(parsed.agents, agencyAgents);

  return {
    listing,
    parsed,
    agencyAgents,
    warnings,
    unknown_agents,
    method,
    parser_name: parserName,
  };
}
