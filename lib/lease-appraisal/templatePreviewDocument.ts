import { buildLeaseAppraisalReport } from "@/lib/lease-appraisal/buildLeaseAppraisalReport";
import { resolveAgentProfile } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { resolveFinalReportForDisplay } from "@/lib/reports/resolveFinalReportForDisplay";
import type { Agency, AgentProfile, FinalReportJson, Listing, Report } from "@/lib/types";

/** Draft lease appraisal for template picker (listing photos, agency brand, account agents). */
export function buildLeaseAppraisalTemplatePreview({
  agency,
  listing,
  report,
  templateId,
  agencyAgents = [],
}: {
  agency: Agency;
  listing: Listing;
  report: Report;
  templateId: string;
  agencyAgents?: AgentProfile[];
}): FinalReportJson | null {
  const parsed = listing.scraped_listing_json;
  if (!parsed) {
    return null;
  }

  const agentProfile = resolveAgentProfile(listing, agencyAgents);

  return resolveFinalReportForDisplay(
    buildLeaseAppraisalReport({
      agency,
      listing,
      report,
      parsed,
      agentProfile,
      agencyAgents,
      templateId,
    }),
  );
}
