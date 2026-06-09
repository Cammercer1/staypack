import { generateHeadlessSalesBrochure } from "@/lib/delivery/brochure/generateHeadlessSalesBrochure";
import { resolveDeliveryAgency } from "@/lib/delivery/brand/ensureShadowAgency";
import { generateHeadlessLeaseAppraisal } from "@/lib/delivery/lease/generateHeadlessLeaseAppraisal";
import { updateDeliveryListingScrapedJson } from "@/lib/delivery/listing/createDeliveryListing";
import { resolveOutreachAgents } from "@/lib/delivery/outreach/resolveOutreachAgents";
import type {
  OutreachDeliverable,
  OutreachGenerateRequest,
} from "@/lib/delivery/outreach/schema";
import { rentAppraisalTierSetting } from "@/lib/delivery/rentAppraisalConfig";
import { generateHeadlessStrReport } from "@/lib/delivery/str/generateHeadlessStr";
import { getDeliveryTenantBySlug } from "@/lib/delivery/tenants/repository";
import { prepareListingFromScrape } from "@/lib/listings/prepareListingFromScrape";
import { enrichListingRentalAppraisal } from "@/lib/rental/enrichListingRentalAppraisal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, Listing, ParsedListing } from "@/lib/types";

export type OutreachArtifact = {
  type: OutreachDeliverable;
  pdf_url: string;
  pdf_filename: string;
  public_url: string;
  report_id?: string;
  collateral_id?: string;
};

export type OutreachGenerateResponse = {
  listing_id: string;
  address: string;
  agents: {
    name: string;
    email: string;
    phone: string;
    role_title: string;
    photo_url: string;
  }[];
  agent_source: "profile" | "listing" | "brand";
  listing: {
    hero_image_url: string | null;
    bedrooms: number | null;
    display_price: string | null;
  };
  artifacts: OutreachArtifact[];
  warnings: string[];
  errors: { type: OutreachDeliverable; message: string }[];
};

function formatAddress(listing: Listing, parsed: ParsedListing): string {
  return (
    [listing.property_address, listing.suburb, listing.state]
      .filter(Boolean)
      .join(", ") ||
    parsed.address ||
    ""
  );
}

export async function generateOutreachBundle(
  request: OutreachGenerateRequest,
): Promise<OutreachGenerateResponse> {
  const tenant = await getDeliveryTenantBySlug(request.tenant_slug);
  if (!tenant) {
    throw new Error(`Unknown delivery tenant: ${request.tenant_slug}`);
  }

  const agency = await resolveDeliveryAgency({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    agencyId: tenant.agency_id,
    brand: tenant.brand,
  });

  const agentProfileId = request.agent_profile_ids?.[0] ?? null;
  const prep = await prepareListingFromScrape({
    agency: agency as Agency,
    listingUrl: request.listing_url,
    agentProfileId,
  });

  const warnings = [...prep.warnings];
  if (prep.unknown_agents.length > 0) {
    warnings.push(
      `Unknown scraped agents (not on agency roster): ${prep.unknown_agents
        .map((a) => a.name)
        .join(", ")}`,
    );
  }

  let listing = prep.listing;
  let parsed = prep.parsed;

  const { agents, agentProfile, agentSource } = await resolveOutreachAgents({
    agency: agency as Agency,
    listing,
    parsed,
    tenantBrand: tenant.brand,
    agentProfileIds: request.agent_profile_ids,
    agencyAgents: prep.agencyAgents,
  });

  if (request.agent_profile_ids?.length && agentProfile) {
    const admin = createAdminClient();
    const { data: updated } = await admin
      .from("listings")
      .update({ agent_profile_id: agentProfile.id })
      .eq("id", listing.id)
      .select("*")
      .single();

    if (updated) {
      listing = updated as Listing;
    }
  }

  const deliverables = request.deliverables;
  const templates = request.templates ?? {};
  const artifacts: OutreachArtifact[] = [];
  const errors: OutreachGenerateResponse["errors"] = [];

  if (deliverables.includes("lease_appraisal")) {
    try {
      const enriched = await enrichListingRentalAppraisal(parsed, {
        rentAppraisalConfig: {
          tier: rentAppraisalTierSetting(tenant) ?? "auto",
        },
      });

      if (
        enriched.rentalAppraisal?.weeklyMin == null ||
        enriched.rentalAppraisal?.weeklyMax == null
      ) {
        throw new Error(
          enriched.warnings?.find((w) => w.startsWith("Rental appraisal")) ??
            "Lease appraisal could not compute a weekly rent range",
        );
      }

      await updateDeliveryListingScrapedJson(listing.id, enriched);
      parsed = enriched;
      listing = {
        ...listing,
        scraped_listing_json: enriched,
      };
    } catch (error) {
      errors.push({
        type: "lease_appraisal",
        message: error instanceof Error ? error.message : "Lease enrichment failed",
      });
    }
  }

  const agentContext = {
    resolvedAgents: agents,
    agentProfile,
    agencyAgents: prep.agencyAgents,
  };

  if (deliverables.includes("str")) {
    try {
      const str = await generateHeadlessStrReport({
        tenant,
        listingUrl: request.listing_url,
        parsed,
        listing,
        agency: agency as Agency,
        templateIdOverride: templates.str,
        ...agentContext,
      });

      artifacts.push({
        type: "str",
        pdf_url: str.pdfUrl,
        pdf_filename: str.pdfFilename,
        public_url: str.publicUrl,
        report_id: str.reportId,
      });
    } catch (error) {
      errors.push({
        type: "str",
        message: error instanceof Error ? error.message : "STR generation failed",
      });
    }
  }

  if (deliverables.includes("lease_appraisal") && !errors.some((e) => e.type === "lease_appraisal")) {
    try {
      const lease = await generateHeadlessLeaseAppraisal({
        tenant,
        listingUrl: request.listing_url,
        parsed,
        listing,
        agency: agency as Agency,
        templateIdOverride: templates.lease_appraisal,
        ...agentContext,
      });

      artifacts.push({
        type: "lease_appraisal",
        pdf_url: lease.pdfUrl,
        pdf_filename: lease.pdfFilename,
        public_url: lease.publicUrl,
        report_id: lease.reportId,
      });
    } catch (error) {
      errors.push({
        type: "lease_appraisal",
        message:
          error instanceof Error ? error.message : "Lease appraisal generation failed",
      });
    }
  }

  if (deliverables.includes("sales_brochure")) {
    try {
      const brochure = await generateHeadlessSalesBrochure({
        tenant,
        listing,
        agency: agency as Agency,
        templateIdOverride: templates.sales_brochure,
        ...agentContext,
      });

      artifacts.push({
        type: "sales_brochure",
        pdf_url: brochure.pdfUrl,
        pdf_filename: brochure.pdfFilename,
        public_url: brochure.publicUrl,
        collateral_id: brochure.collateralId,
      });
    } catch (error) {
      errors.push({
        type: "sales_brochure",
        message:
          error instanceof Error ? error.message : "Sales brochure generation failed",
      });
    }
  }

  const address = formatAddress(listing, parsed);

  return {
    listing_id: listing.id,
    address,
    agents: agents.map((agent) => ({
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      role_title: agent.role_title,
      photo_url: agent.photo_url,
    })),
    agent_source: agentSource,
    listing: {
      hero_image_url: listing.hero_image_url,
      bedrooms: listing.bedrooms,
      display_price: listing.display_price,
    },
    artifacts,
    warnings,
    errors,
  };
}
