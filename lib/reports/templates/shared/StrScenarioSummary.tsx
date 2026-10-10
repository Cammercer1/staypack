import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import type { FinalReportJson } from "@/lib/types";

/** Read only the frozen report snapshot, never current company settings. */
export function StrScenarioSummary({ report }: { report: FinalReportJson }) {
  const scenario = report.str_scenario;
  if (!scenario || scenario.basis === "market") return null;
  const management = scenario.management;
  const baseline = scenario.market_benchmark;
  return <div className="mb-2 space-y-1 break-words text-[8px] leading-[1.4]" data-testid="str-scenario-summary">
    <p className="font-semibold">{scenario.basis === "management" ? `Estimated gross STR revenue under ${management?.companyName ?? report.agency.name} management` : "Adjusted estimated gross STR revenue"}: {formatCurrency(report.str.annual_revenue)} / year.</p>
    <p>Market benchmark: {formatCurrency(baseline.annual_revenue)} / year · {formatCurrency(baseline.nightly_rate)} ADR · {formatPercent(baseline.occupancy_rate)} annual occupancy. Both estimates are gross, before costs.</p>
    {management && <>
      <p>{management.listingStage === "launch_year" ? "Launch year" : "Established listing"} · {management.unavailableNights} unavailable nights · {formatPercent(report.str.occupancy_rate)} of all 365 nights booked. {management.rationale}</p>
      <p>Management assumptions are indicative, not a measured management premium. Actual results may vary.</p>
    </>}
  </div>;
}
