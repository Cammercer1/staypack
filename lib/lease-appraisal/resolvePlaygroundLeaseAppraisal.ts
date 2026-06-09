import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLeaseAppraisalTemplatePreview } from "@/lib/lease-appraisal/templatePreviewDocument";
import { mergeLeaseAppraisalPreviewFromListing } from "@/lib/lease-appraisal/mergeLeaseAppraisalPreviewFromListing";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import type { Agency, CollateralItem, FinalReportJson, Listing, Report } from "@/lib/types";

type ResolveInput = {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
  report: Report;
  collateral?: CollateralItem | null;
};

function resolveLeaseTemplateId(
  report: Report,
  collateral?: CollateralItem | null,
): string {
  if (collateral?.template_id && isLeaseAppraisalTemplateId(collateral.template_id)) {
    return collateral.template_id;
  }
  if (isLeaseAppraisalTemplateId(report.template_id)) {
    return report.template_id!;
  }
  return DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID;
}

/** Live lease appraisal preview for a listing (saved JSON or built from listing + agency brand). */
export async function resolvePlaygroundLeaseAppraisal({
  supabase,
  agency,
  listing,
  report,
  collateral,
}: ResolveInput): Promise<FinalReportJson | null> {
  if (!listing.scraped_listing_json) {
    return null;
  }

  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);
  const templateId = resolveLeaseTemplateId(report, collateral);

  if (report.final_report_json) {
    const cached = report.final_report_json as FinalReportJson;
    const merged = mergeAgencyBrandIntoFinalReport(agency, {
      ...cached,
      template_id: templateId,
    });
    return resolveFinalReportForDisplay(
      mergeLeaseAppraisalPreviewFromListing(merged, listing),
    );
  }

  return buildLeaseAppraisalTemplatePreview({
    agency,
    listing,
    report,
    templateId,
    agencyAgents,
  });
}
