import type { ProposalPage } from "@/lib/digital-proposals/template";

/** Import only: no mounting, page tracking, PDF generation or document requests. */
export async function preloadProposalPage(kind: ProposalPage["kind"]) {
  switch (kind) {
    case "comparison":
      await import("./ProposalComparison");
      await (await import("./ProposalChart")).preloadProposalCharts();
      break;
    case "forecast":
      await import("./YearlyForecast");
      await (await import("./ProposalChart")).preloadProposalCharts();
      break;
    case "evidence": await import("./ComparableListings"); break;
    case "service": await import("./ProposalManagementService"); break;
  }
}
