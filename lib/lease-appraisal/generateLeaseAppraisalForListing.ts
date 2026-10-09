import { resolveAppraisalInput } from "@/lib/appraisals/resolveAppraisalInput";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { buildLeaseAppraisalReport } from "@/lib/lease-appraisal/buildLeaseAppraisalReport";
import { DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/lease-appraisal/ids";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { ltrEnrichmentFromParsed } from "@/lib/lease-appraisal/ltrEnrichmentFromParsed";
import { generateLeaseAppraisalCopy } from "@/lib/openai/generateLeaseAppraisalCopy";
import {
  hasLeaseAppraisalSelectedComps,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import type {
  Agency,
  AgentProfile,
  Listing,
  ParsedListing,
  Report,
} from "@/lib/types";

export { DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID as LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/lease-appraisal/ids";



export function resolveAgentProfile(
  listing: Listing,
  agencyAgents: AgentProfile[],
): AgentProfile | null {
  if (listing.agent_profile_id) {
    return (
      agencyAgents.find((agent) => agent.id === listing.agent_profile_id) ?? null
    );
  }

  return agencyAgents.find((agent) => agent.is_default && !agent.archived_at) ?? agencyAgents.find((agent) => !agent.archived_at) ?? null;
}

export function hasLeaseAppraisalComps(parsed: ParsedListing | null | undefined) {
  const appraisal = parsed?.rentalAppraisal;
  return Boolean(
    appraisal?.compCount != null &&
      appraisal.compCount > 0 &&
      (appraisal.weeklyMidpoint != null ||
        (appraisal.weeklyMin != null && appraisal.weeklyMax != null)),
  );
}

export async function createLeaseAppraisalDraft({
  supabase,
  agency,
  listing,
  userId,
}: {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  userId?: string;
}): Promise<{ report: Report; listing: Listing }> {

  const { data: existingCollateral } = await supabase
    .from("collateral_items")
    .select("report_id")
    .eq("listing_id", listing.id)
    .eq("type", "lease_appraisal")
    .neq("status", "archived")
    .maybeSingle();

  if (existingCollateral?.report_id) {
    const { data: existingReport } = await supabase
      .from("reports")
      .select("*")
      .eq("id", existingCollateral.report_id)
      .maybeSingle();

    if (existingReport) {
      return { report: existingReport as Report, listing };
    }
  }

  const { data: createdReport, error: reportError } = await supabase
    .from("reports")
    .insert({
      agency_id: agency.id,
      listing_id: listing.id,
      created_by: userId ?? null,
      status: "draft",
      template_id: null,
    })
    .select("*")
    .single();

  if (reportError || !createdReport) {
    throw new Error(reportError?.message ?? "Failed to create lease appraisal report");
  }

  const { error: collateralError } = await supabase.from("collateral_items").insert({
    listing_id: listing.id,
    agency_id: agency.id,
    type: "lease_appraisal",
    status: "draft",
    report_id: createdReport.id,
    template_id: null,
  });

  if (collateralError && collateralError.code !== "23505") {
    throw new Error(collateralError.message);
  }

  return { report: createdReport as Report, listing };
}

export async function generateLeaseAppraisalReportContent({
  supabase,
  agency,
  listing: initialListing,
  report,
  agencyAgents = [],
  templateId,
}: {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  report: Report;
  agencyAgents?: AgentProfile[];
  templateId?: string;
}): Promise<{ report: Report; listing: Listing; parsed: ParsedListing }> {

  const listing = initialListing;
  // Generation consumes the figures and evidence reviewed on the data step.
  // Repositioning here silently changed both after the user had saved them.
  const parsed = resolveAppraisalInput(listing);

  if (!hasLeaseAppraisalComps(parsed)) {
    throw new Error("Fetch rental comps before generating appraisal content");
  }

  if (!hasLeaseAppraisalSelectedComps(parsed)) {
    throw new Error("Select at least one comparable rental before generating content");
  }

  const resolvedTemplateId =
    templateId ??
    (isLeaseAppraisalTemplateId(report.template_id)
      ? report.template_id!
      : DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID);

  const agentProfile = resolveAgentProfile(listing, agencyAgents);
  const ltrEnrichment = ltrEnrichmentFromParsed(parsed);

  const copy = await generateLeaseAppraisalCopy({
    agency,
    listing: {
      ...listing,
      listing_description: listing.listing_description ?? parsed.description ?? null,
      listing_title: listing.listing_title ?? parsed.title ?? null,
    },
    parsed,
    compCount: parsed.rentalAppraisal?.compCount ?? ltrEnrichment?.comp_count ?? 0,
    weeklyMin: parsed.rentalAppraisal?.weeklyMin ?? null,
    weeklyMax: parsed.rentalAppraisal?.weeklyMax ?? null,
    suburbMarket: parsed.ltrSuburbMarket ?? ltrEnrichment?.suburb_market ?? null,
    featuredComps: ltrEnrichment?.comps ?? [],
  });

  const finalReportJson = resolveFinalReportForDisplay(
    buildLeaseAppraisalReport({
      agency,
      listing,
      report,
      parsed,
      agentProfile,
      agencyAgents,
      templateId: resolvedTemplateId,
      copy,
    }),
    { templateId: resolvedTemplateId },
  );

  const preservePublished = report.status === "published";

  const { data: savedReport, error: saveError } = await supabase
    .from("reports")
    .update({
      template_id: resolvedTemplateId,
      final_report_json: {
        ...finalReportJson,
        assets: { ...finalReportJson.assets, pdf_url: "" },
      },
      pdf_url: null,
      status: preservePublished ? report.status : "generated",
      generated_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (saveError || !savedReport) {
    throw new Error(saveError?.message ?? "Failed to save lease appraisal report");
  }

  await supabase
    .from("collateral_items")
    .update({
      status: preservePublished ? "published" : "generated",
      generated_at: new Date().toISOString(),
      template_id: resolvedTemplateId,
    })
    .eq("listing_id", listing.id)
    .eq("type", "lease_appraisal")
    .eq("report_id", savedReport.id);

  return {
    report: savedReport as Report,
    listing,
    parsed,
  };
}
