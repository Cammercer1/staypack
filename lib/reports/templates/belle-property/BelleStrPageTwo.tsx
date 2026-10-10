import { DocumentQr } from "@/components/documents/DocumentQr";
import { ReportCopyDisclaimer } from "@/components/reports/inline/ReportCopyFields";
import type { FinalReportJson } from "@/lib/types";
import { ClassicCompsGrid } from "@/lib/reports/templates/classic/ClassicCompsGrid";
import { ClassicMarketInsights } from "@/lib/reports/templates/classic/ClassicMarketInsights";
import { ClassicMonthlyRevenueChart } from "@/lib/reports/templates/classic/ClassicMonthlyRevenueChart";
import { ClassicSeasonalityChart } from "@/lib/reports/templates/classic/ClassicSeasonalityChart";
import { getReportBrandColours } from "@/lib/reports/brandColours";
import { BelleReportPageHeader } from "@/lib/reports/templates/belle-property/BelleReportPageHeader";

type Props = {
  report: FinalReportJson;
};

/** Belle STR page 2 — classic market layout with branded header band. */
export function BelleStrPageTwo({ report }: Props) {
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
      }}
    >
      <BelleReportPageHeader report={report} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-10 py-4">
        <div className={`flex shrink-0 flex-col ${hasScenarioSummary ? "gap-3" : "gap-5"}`}>
          <header>
            <h2
              className="text-xl font-semibold"
              style={{
                fontFamily: "var(--report-heading-font, inherit)",
                color: "var(--report-headline-colour, inherit)",
              }}
            >
              Market evidence
            </h2>
            <p className="mt-1.5 text-sm leading-snug text-neutral-600">
              {enrichment?.provider === "airroi" ? "Estimated revenue and comparable short-term rentals near" : "Revenue and occupancy trends from comparable short-term rentals near"}{" "}
              {report.property.suburb || "the subject property"}.
            </p>
          </header>

          <section className="shrink-0">
            <div className="grid grid-cols-2 items-stretch gap-x-8">
              <ClassicMonthlyRevenueChart report={report} compact />
              <ClassicSeasonalityChart seasonality={seasonality} marketOccupancy={enrichment?.market_occupancy} revenueRange={enrichment?.provider === "airroi" ? enrichment.revenue_range : null} compact />
            </div>
          </section>

          <section className={`shrink-0 border-t border-neutral-200/80 ${hasScenarioSummary ? "pt-3" : "pt-5"}`}>
            <ClassicCompsGrid
              comps={comps}
              showManagement={report.str_scenario?.basis === "management"}
              imageAspectClass={hasScenarioSummary ? "aspect-[4/1]" : undefined}
              suburb={report.property.suburb}
              totalCompCount={enrichment?.comp_count}
              featuredCount={enrichment?.selected_comp_ids ? comps.length : undefined}
              compPoolDescription={enrichment?.selected_comp_ids ? `${comps.length} selected comparable listings` : undefined}
              compact={hasScenarioSummary || (enrichment?.provider === "airroi" && comps.length > 4)}
            />
          </section>
        </div>

        <div className={`mt-auto shrink-0 ${hasScenarioSummary ? "pt-3" : "pt-5"}`}>
          <div className={hasScenarioSummary ? "flex items-end gap-4" : undefined}>
            <div className="min-w-0 flex-1"><ClassicMarketInsights report={report} compact={hasScenarioSummary} /></div>
            {hasScenarioSummary && <DocumentQr document={report} />}
          </div>
          {report.copy.disclaimer ? (
            <ReportCopyDisclaimer
              text={report.copy.disclaimer}
              as="p"
              className="mt-3 text-[0.5rem] leading-[1.35] text-neutral-500"
            />
          ) : null}
        </div>
      </div>
      {!hasScenarioSummary && report.document_link && report.document_link.mode !== "none" && report.assets.qr_code_url ? <div className="flex shrink-0 justify-end px-10 pb-3"><DocumentQr document={report} /></div> : null}
    </section>
  );
}
