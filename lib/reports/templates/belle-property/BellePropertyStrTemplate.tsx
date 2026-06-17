import { BelleStrPageTwo } from "@/lib/reports/templates/belle-property/BelleStrPageTwo";
import { BelleReportPageOne } from "@/lib/reports/templates/belle-property/BelleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

/** Belle STR — bespoke page 1 + Belle page 2 with branded header. */
export function BellePropertyStrTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <BelleReportPageOne report={report} />
      <BelleStrPageTwo report={report} />
    </>
  );
}
