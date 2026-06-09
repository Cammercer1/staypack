import { ReportCopyDisclaimer } from "@/components/reports/inline/ReportCopyFields";
import type { FinalReportJson } from "@/lib/types";
import { ClassicCompsGrid } from "@/lib/reports/templates/classic/ClassicCompsGrid";
import { ClassicMarketInsights } from "@/lib/reports/templates/classic/ClassicMarketInsights";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { ClassicMonthlyRevenueChart } from "@/lib/reports/templates/classic/ClassicMonthlyRevenueChart";
import { ClassicSeasonalityChart } from "@/lib/reports/templates/classic/ClassicSeasonalityChart";
import { getReportBrandColours } from "@/lib/reports/brandColours";

type Props = {
  report: FinalReportJson;
};

export function ClassicPageTwo({ report }: Props) {
  const brand = getReportBrandColours(report.agency);
  const enrichment = report.str_enrichment;
  const comps = enrichment?.comps ?? [];
  const seasonality = enrichment?.seasonality ?? [];

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
      }}
    >
      <ClassicPageHeader report={report} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-10 py-4">
        <div className="flex shrink-0 flex-col gap-5">
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
              Revenue and occupancy trends from comparable short-term rentals near{" "}
              {report.property.suburb || "the subject property"}.
            </p>
          </header>

          <section className="shrink-0">
            <div className="grid grid-cols-2 items-stretch gap-x-8">
              <ClassicMonthlyRevenueChart report={report} compact />
              <ClassicSeasonalityChart seasonality={seasonality} compact />
            </div>
          </section>

          <section className="shrink-0 border-t border-neutral-200/80 pt-5">
            <ClassicCompsGrid
              comps={comps}
              suburb={report.property.suburb}
              totalCompCount={enrichment?.comp_count}
            />
          </section>
        </div>

        <div className="mt-auto shrink-0 pt-5">
          <ClassicMarketInsights report={report} />
          {report.copy.disclaimer ? (
            <ReportCopyDisclaimer
              text={report.copy.disclaimer}
              as="p"
              className="mt-3 text-[0.5rem] leading-[1.35] text-neutral-500"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
