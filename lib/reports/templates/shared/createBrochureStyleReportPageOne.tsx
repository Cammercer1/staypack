import {
  ReportBrochureStylePageOne,
  type ReportBrochureLayoutFamily,
} from "@/lib/reports/templates/shared/ReportBrochureStylePageOne";
import type { ReportPageOneProps } from "@/lib/reports/templates/shared/reportPageVariant";

export function createBrochureStyleReportPageOne(family: ReportBrochureLayoutFamily) {
  function ReportPageOne(props: ReportPageOneProps) {
    return <ReportBrochureStylePageOne {...props} family={family} />;
  }

  Object.defineProperty(ReportPageOne, "name", {
    value: `${family.charAt(0).toUpperCase()}${family.slice(1)}ReportPageOne`,
  });

  return ReportPageOne;
}
