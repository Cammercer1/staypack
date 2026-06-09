import { HavenPageTwo } from "@/lib/reports/templates/haven-properties/HavenPageTwo";
import { HavenStrPageOne } from "@/lib/reports/templates/haven-properties/HavenStrPageOne";
import { applyHavenBrandToReport } from "@/lib/reports/templates/haven-properties/brand";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

/** Haven STR — managed page 1 + Haven market page 2. */
export function HavenPropertiesStrTemplate({ report }: ReportTemplateProps) {
  const branded = applyHavenBrandToReport(report);

  return (
    <>
      <HavenStrPageOne report={branded} />
      <HavenPageTwo report={branded} />
    </>
  );
}
