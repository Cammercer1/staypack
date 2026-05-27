import { calculateStrGrossYield } from "@/lib/reports/calculateStrYield";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import { normalizeDisplayPrice } from "@/lib/scraping/normalizeDisplayPrice";
import type { AgentProfile, FinalReportJson, Report } from "@/lib/types";

type EnrichOptions = {
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
};

export function enrichFinalReportMetrics(
  sourceReport: Pick<Report, "display_price" | "scraped_listing_json">,
  finalReport: FinalReportJson,
  options?: EnrichOptions,
): FinalReportJson {
  const displayPrice =
    finalReport.property.display_price ??
    normalizeDisplayPrice(sourceReport.display_price) ??
    sourceReport.display_price ??
    null;

  const strYield =
    finalReport.str_yield ??
    calculateStrGrossYield(displayPrice, finalReport.str.annual_revenue);

  const agents = resolveReportAgents({
    scraped: sourceReport.scraped_listing_json,
    agentProfile: options?.agentProfile,
    agencyAgents: options?.agencyAgents,
  });

  return {
    ...finalReport,
    property: {
      ...finalReport.property,
      display_price: displayPrice,
    },
    str_yield: strYield,
    ...(agents.length > 0
      ? {
          agents,
          agent: primaryReportAgent(agents),
        }
      : {}),
  };
}
