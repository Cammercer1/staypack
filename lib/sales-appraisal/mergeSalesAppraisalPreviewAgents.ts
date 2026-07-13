import { resolveAgentProfile } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import type { AgentProfile, FinalReportJson, Listing } from "@/lib/types";

/** Keep wizard previews in sync with the listing agents and their saved profiles. */
export function mergeSalesAppraisalPreviewAgents(
  report: FinalReportJson,
  listing: Listing,
  agencyAgents: AgentProfile[],
): FinalReportJson {
  const agentProfile = resolveAgentProfile(listing, agencyAgents);
  const agents = resolveReportAgents({
    scraped: listing.scraped_listing_json,
    agentProfile,
    agencyAgents,
  });

  if (agents.length === 0) {
    return report;
  }

  return {
    ...report,
    agent: primaryReportAgent(agents),
    agents,
  };
}
