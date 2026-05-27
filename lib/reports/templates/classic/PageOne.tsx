import type { FinalReportJson } from "@/lib/types";
import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { ClassicHeroGallery } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPageHeader } from "@/lib/reports/templates/classic/ClassicPageHeader";
import { ClassicPropertySection } from "@/lib/reports/templates/classic/ClassicPropertySection";
import { getReportBrandColours } from "@/lib/reports/brandColours";

type Props = {
  report: FinalReportJson;
  variant?: "light" | "detailed";
};

export function ClassicPageOne({ report, variant = "light" }: Props) {
  const brand = getReportBrandColours(report.agency);

  return (
    <section
      className="report-page mx-auto flex flex-col overflow-hidden shadow-sm"
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
      }}
    >
      <ClassicPageHeader report={report} />

      <div className="min-h-0 flex-1">
        <ClassicHeroGallery property={report.property} />
      </div>

      <ClassicPropertySection report={report} variant={variant} />

      <ClassicAgentFooter report={report} />
    </section>
  );
}
