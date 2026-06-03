import {
  applyHavenLeaseAppraisalBrandToReport,
} from "@/lib/reports/templates/haven-properties/brand";
import { HavenLeaseAppraisalPageOne } from "@/lib/reports/templates/haven-properties/HavenLeaseAppraisalPageOne";
import { HavenLeaseAppraisalPageTwo } from "@/lib/reports/templates/haven-properties/HavenLeaseAppraisalPageTwo";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

/** Haven Properties — investor lease appraisal (Landmark-inspired, LTR data). */
export function HavenPropertiesLeaseAppraisalTemplate({ report }: ReportTemplateProps) {
  const branded = applyHavenLeaseAppraisalBrandToReport(report);

  return (
    <>
      <HavenLeaseAppraisalPageOne report={branded} />
      <HavenLeaseAppraisalPageTwo report={branded} />
    </>
  );
}
