import { BelleReportPageOne } from "@/lib/reports/templates/belle-property/BelleReportPageOne";
import { BelleLeaseAppraisalPageTwo } from "@/lib/reports/templates/belle-property/BelleLeaseAppraisalPageTwo";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

/** Belle lease appraisal — bespoke page 1 + Belle page 2 with branded header. */
export function BellePropertyLeaseAppraisalTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <BelleReportPageOne report={report} reportVariant="lease" />
      <BelleLeaseAppraisalPageTwo report={report} />
    </>
  );
}
