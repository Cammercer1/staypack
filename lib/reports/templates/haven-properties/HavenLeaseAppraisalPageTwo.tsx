import { getReportBrandColours } from "@/lib/reports/brandColours";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { HAVEN_BRAND } from "@/lib/reports/templates/haven-properties/brand";
import {
  HAVEN_LTR_COMP_IMAGE_ASPECT,
  HAVEN_LTR_FEATURED_COMP_COUNT,
  HavenLtrCompsGrid,
} from "@/lib/reports/templates/haven-properties/HavenLtrCompsGrid";
import { HavenLeaseComparableEvidence } from "@/lib/reports/templates/haven-properties/HavenLeaseComparableEvidence";
import { HavenLeaseAppraisalSuburbMarket } from "@/lib/reports/templates/haven-properties/HavenLeaseAppraisalSuburbMarket";
import type { FinalReportJson } from "@/lib/types";

type Props = {
  report: FinalReportJson;
};

export function HavenLeaseAppraisalPageTwo({ report }: Props) {
  const brand = getReportBrandColours(report.agency);
  const enrichment = report.ltr_enrichment;
  const comps = enrichment?.comps ?? [];
  const showSix = comps.length >= HAVEN_LTR_FEATURED_COMP_COUNT;
  const suburbMarket = enrichment?.suburb_market ?? null;
  const accent = report.agency.primary_colour || HAVEN_BRAND.statBar;

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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <section className="min-h-0 shrink-0">
            {report.property.suburb ? (
              <h2
                className={`font-semibold ${showSix ? "mb-2 text-sm" : "mb-3 text-base"}`}
                style={{
                  fontFamily: "var(--report-heading-font, inherit)",
                  color: accent,
                }}
              >
                Comparable rentals near {report.property.suburb}
              </h2>
            ) : null}
            <HavenLtrCompsGrid
              comps={comps}
              featuredCount={HAVEN_LTR_FEATURED_COMP_COUNT}
              imageAspectClass={HAVEN_LTR_COMP_IMAGE_ASPECT}
              compact
              hideHeader
            />
            {report.copy.comparable_evidence ? (
              <HavenLeaseComparableEvidence
                comparableEvidence={report.copy.comparable_evidence}
                comparableDisclaimer={report.copy.comparable_disclaimer}
              />
            ) : null}
          </section>
        </div>

        <div className="mt-auto shrink-0 space-y-4 pt-4">
          {suburbMarket ? (
            <section className="pt-4">
              <HavenLeaseAppraisalSuburbMarket
                market={suburbMarket}
                accent={accent}
                compact
              />
            </section>
          ) : null}
          <ClassicAgentFooter report={report} compact />
        </div>
      </div>
    </section>
  );
}
