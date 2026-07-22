import { OcRealEstateLeaseAppraisalPageTwo } from "@/lib/reports/templates/oc-real-estate/OcRealEstateLeaseAppraisalPageTwo";
import { OcRealEstateSalesAppraisalPageOne } from "@/lib/reports/templates/oc-real-estate/OcRealEstateSalesAppraisalTemplate";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export function OcRealEstateLeaseAppraisalTemplate({
  report,
}: ReportTemplateProps) {
  return (
    <>
      <OcRealEstateSalesAppraisalPageOne report={report} variant="lease" />
      <OcRealEstateLeaseAppraisalPageTwo report={report} />
    </>
  );
}
