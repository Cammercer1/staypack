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
              Revenue and occupancy trends from comparable short-term rentals near{" "}
              {report.property.suburb || "the subject property"}.
            </p>
          </header>

          <section>
            <div className="grid grid-cols-2 items-stretch gap-x-6">
              <ClassicMonthlyRevenueChart report={report} compact />
              <ClassicSeasonalityChart seasonality={seasonality} compact />
            </div>
          </section>

          <section className="border-t border-neutral-200/80 pt-4">
            <ClassicCompsGrid
              comps={comps}
              suburb={report.property.suburb}
              featuredCount={HAVEN_FEATURED_COMP_COUNT}
              imageAspectClass={HAVEN_COMP_IMAGE_ASPECT}
              compact
              showPoolSubtitle={false}
            />
          </section>

          <section className="border-t border-neutral-200/80 pt-4">
            <ClassicMarketInsights report={report} compact />
          </section>
        </div>
      </div>
    </section>
  );
}
