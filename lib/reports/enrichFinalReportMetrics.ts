import { calculateStrGrossYield } from "@/lib/reports/calculateStrYield";
import {
  primaryReportAgent,
  resolveReportAgents,
} from "@/lib/reports/resolveReportAgents";
import { resolveReportDisplayPrice } from "@/lib/reports/resolveReportDisplayPrice";
import type { AgentProfile, FinalReportJson, Listing } from "@/lib/types";

type EnrichOptions = {
  agentProfile?: AgentProfile | null;
  agencyAgents?: AgentProfile[];
};

type ListingPriceSource = Pick<Listing, "display_price" | "scraped_listing_json">;

export function enrichFinalReportMetrics(
  sourceListing: ListingPriceSource,
  finalReport: FinalReportJson,
  options?: EnrichOptions,
): FinalReportJson {
  const displayPrice = resolveReportDisplayPrice({
    display_price:
      sourceListing.display_price ?? finalReport.property.display_price ?? null,
    scraped_listing_json: sourceListing.scraped_listing_json,
  });

  const strYield =
    finalReport.str_yield ??
    calculateStrGrossYield(displayPrice, finalReport.str.annual_revenue);

  const agents = resolveReportAgents({
    scraped: sourceListing.scraped_listing_json,
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
