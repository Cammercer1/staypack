import "server-only";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import { buildLeaseAppraisalReport } from "@/lib/lease-appraisal/buildLeaseAppraisalReport";
import { buildSalesAppraisalReport } from "@/lib/sales-appraisal/buildSalesAppraisalReport";
import { hasLeaseAppraisalComps } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { hasSalesAppraisalComps } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import { hasLeaseAppraisalSelectedComps } from "@/lib/lease-appraisal/leaseAppraisalData";
import { hasSalesAppraisalSelectedComps } from "@/lib/sales-appraisal/salesAppraisalData";
import { generateLeaseAppraisalCopy } from "@/lib/openai/generateLeaseAppraisalCopy";
import { generateSalesAppraisalCopy } from "@/lib/openai/generateSalesAppraisalCopy";
import { resolveAppraisalInput } from "./resolveAppraisalInput";
import { requireEditableAppraisal, checkAppraisalError, type requireAppraisalAccess } from "./workspace";
import { ProposalError } from "@/lib/digital-proposals/errors";
import type { WorkspaceAppraisal } from "./workspaceTypes";

export async function prepareAppraisalDocument(context: Awaited<ReturnType<typeof requireAppraisalAccess>>, expected: string) {
  const kind = requireEditableAppraisal(context);
  const { appraisal, agency, report, supabase, workingListing: listing } = context;
  if (appraisal.updated_at !== expected) throw new ProposalError("This appraisal changed. Reload before continuing.", 409);
  if (appraisal.document_json && appraisal.document_revision === appraisal.input_revision) return appraisal;
  const parsed = resolveAppraisalInput(listing);
  if (kind === "lease" ? !hasLeaseAppraisalComps(parsed) || !hasLeaseAppraisalSelectedComps(parsed) : !hasSalesAppraisalComps(parsed) || !hasSalesAppraisalSelectedComps(parsed))
    throw new ProposalError("Review the estimate and select at least one comparable before preparing your proposal.");
  if (kind === "sales" && parsed.salesAppraisal?.agencyGuideReview?.required && !parsed.salesAppraisal.agencyGuideReview.confirmed)
    throw new ProposalError("Review and confirm the agency guide against the comparable evidence before continuing.");
  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);
  const args = { agency, listing, report, parsed, agencyAgents, templateId: report.template_id ?? undefined, resolvedAgents: [], propertyImages: { hero_image_url: listing.hero_image_url ?? "", selected_image_urls: listing.selected_image_urls ?? listing.scraped_listing_json?.images ?? [] } };
  let document = kind === "lease" ? buildLeaseAppraisalReport(args) : buildSalesAppraisalReport(args);
  const copy = kind === "lease" ? await generateLeaseAppraisalCopy({ agency, listing, parsed,
    compCount: document.ltr_enrichment?.comp_count ?? 0, weeklyMin: document.ltr.weekly_min, weeklyMax: document.ltr.weekly_max,
    suburbMarket: document.ltr_enrichment?.suburb_market ?? null, featuredComps: document.ltr_enrichment?.comps ?? [] })
    : await generateSalesAppraisalCopy({ agency, listing, parsed, soldCompCount: document.sales_enrichment?.sold_comp_count ?? 0,
      forSaleCompCount: document.sales_enrichment?.for_sale_comp_count ?? 0, priceMin: document.sale_estimate?.price_min ?? null,
      priceMax: document.sale_estimate?.price_max ?? null, featuredComps: document.sales_enrichment?.comps ?? [] });
  document = resolveFinalReportForDisplay(kind === "lease" ? buildLeaseAppraisalReport({ ...args, copy }) : buildSalesAppraisalReport({ ...args, copy }));
  const result = await supabase.rpc("save_appraisal_document", { p_agency_id: agency.id, p_report_id: report.id, p_expected_updated_at: expected, p_document: document });
  checkAppraisalError(result.error);
  return result.data as WorkspaceAppraisal;
}
