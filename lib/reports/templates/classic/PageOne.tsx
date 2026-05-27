import type { FinalReportJson } from "@/lib/types";
import { ClassicAgentFooter } from "@/lib/reports/templates/classic/ClassicAgentFooter";
import { ClassicHeroGallery } from "@/lib/reports/templates/classic/ClassicHeroGallery";
import { ClassicPropertySection } from "@/lib/reports/templates/classic/ClassicPropertySection";

export function ClassicPageOne({ report }: { report: FinalReportJson }) {
  const textColour = report.agency.text_colour || report.agency.primary_colour;
  const backgroundColour =
    report.agency.background_colour || report.agency.secondary_colour;

  return (
    <section
      className="report-page mx-auto flex min-h-[297mm] flex-col shadow-sm"
      style={{
        backgroundColor: backgroundColour,
        color: textColour,
      }}
    >
      <header className="border-b border-neutral-200 bg-white px-10 py-5">
        {report.agency.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={report.agency.logo_url}
            alt={report.agency.name}
            className="h-10 object-contain object-left"
          />
        ) : (
          <p
            className="text-lg font-semibold text-neutral-900"
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            {report.agency.name}
          </p>
        )}
      </header>

      <ClassicHeroGallery property={report.property} />

      <ClassicPropertySection report={report} />

      <ClassicAgentFooter report={report} />
    </section>
  );
}
