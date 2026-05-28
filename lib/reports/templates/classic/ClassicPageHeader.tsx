import { getAgencyLogoUrl } from "@/lib/branding/logos";
import type { FinalReportJson } from "@/lib/types";

export function ClassicPageHeader({ report }: { report: FinalReportJson }) {
  const logoUrl = getAgencyLogoUrl(report.agency, "light");

  return (
    <header className="shrink-0 border-b border-neutral-200 bg-white px-10 py-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
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
  );
}
