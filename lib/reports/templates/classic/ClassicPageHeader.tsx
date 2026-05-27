import type { FinalReportJson } from "@/lib/types";

export function ClassicPageHeader({ report }: { report: FinalReportJson }) {
  return (
    <header className="shrink-0 border-b border-neutral-200 bg-white px-10 py-4">
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
  );
}
