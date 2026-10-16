import { getAgencyLogoUrl } from "@/lib/branding/logos";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";
import type { FinalReportJson } from "@/lib/types";

export function ClassicPageHeader({ report }: { report: FinalReportJson }) {
  const logoUrl = getAgencyLogoUrl(report.agency, "light");
  const title = report.proposal_print_revision === 2
    ? isLeaseAppraisalTemplateId(report.template_id) ? "Lease appraisal" : isSalesAppraisalTemplateId(report.template_id) ? "Sales appraisal" : null
    : null;

  return (
    <header className={title ? "flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-10 py-4" : "shrink-0 border-b border-neutral-200 bg-white px-10 py-4"}>
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
      {title ? <p data-proposal-appraisal-title className="text-sm font-semibold">{title}</p> : null}
    </header>
  );
}
