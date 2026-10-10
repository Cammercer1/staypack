import { DocumentQr } from "@/components/documents/DocumentQr";
import type { FinalReportJson } from "@/lib/types";
import {
  ClassicCompsGrid,
  STR_PAGE_TWO_COMP_IMAGE_ASPECT,
} from "@/lib/reports/templates/classic/ClassicCompsGrid";
import { ClassicMarketInsights } from "@/lib/reports/templates/classic/ClassicMarketInsights";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { ClassicMonthlyRevenueChart } from "@/lib/reports/templates/classic/ClassicMonthlyRevenueChart";
import { ClassicSeasonalityChart } from "@/lib/reports/templates/classic/ClassicSeasonalityChart";
import { getReportBrandColours } from "@/lib/reports/brandColours";

/** Haven STR page 2 — compact comp cards (wide, short photos) to fit A4 with market snapshot. */
export const HAVEN_FEATURED_COMP_COUNT = 6;
export const HAVEN_COMP_IMAGE_ASPECT = STR_PAGE_TWO_COMP_IMAGE_ASPECT;

type Props = {
  report: FinalReportJson;
};

export function HavenPageTwo({ report }: Props) {
  const brand = getReportBrandColours(report.agency);
  const enrichment = report.str_enrichment;
  const comps = enrichment?.comps ?? [];
  const seasonality = enrichment?.seasonality ?? [];
  const hasScenarioSummary = report.str_scenario != null && report.str_scenario.basis !== "market";

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        height: "var(--report-page-height, 297mm)",
      }}
    >
      <ClassicPageHeader report={report} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-10 py-3">
        <div className="flex shrink-0 flex-col gap-4">
          <header>
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-headline-colour, inherit)",
              }}
            >
              Market evidence
            </h2>
            <p className="mt-1.5 text-xs leading-snug text-neutral-600">
              {enrichment?.provider === "airroi" ? "Estimated revenue and comparable short-term rentals near" : "Revenue and occupancy trends from comparable short-term rentals near"}{" "}
              {report.property.suburb || "the subject property"}.
            </p>
          </header>

          <section>
            <div className="grid grid-cols-2 items-stretch gap-x-6">
              <ClassicMonthlyRevenueChart report={report} compact />
              <ClassicSeasonalityChart seasonality={seasonality} marketOccupancy={enrichment?.market_occupancy} revenueRange={enrichment?.provider === "airroi" ? enrichment.revenue_range : null} compact />
            </div>
          </section>

          <section className="border-t border-neutral-200/80 pt-4">
            <ClassicCompsGrid
              comps={comps}
              showManagement={report.str_scenario?.basis === "management"}
              suburb={report.property.suburb}
              featuredCount={enrichment?.selected_comp_ids ? comps.length : HAVEN_FEATURED_COMP_COUNT}
              imageAspectClass={hasScenarioSummary ? "aspect-[4/1]" : HAVEN_COMP_IMAGE_ASPECT}
              compact
              showPoolSubtitle={false}
            />
          </section>

          <section className={`border-t border-neutral-200/80 pt-4 ${hasScenarioSummary ? "flex items-end gap-4" : ""}`}>
            <div className="min-w-0 flex-1"><ClassicMarketInsights report={report} compact /></div>
            {hasScenarioSummary && <DocumentQr document={report} />}
          </section>
        </div>
      </div>
      {!hasScenarioSummary && report.document_link && report.document_link.mode !== "none" && report.assets.qr_code_url ? <div className="flex shrink-0 justify-end px-10 pb-3"><DocumentQr document={report} /></div> : null}
    </section>
  );
}
