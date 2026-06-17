import type { ReportPageOneProps } from "@/lib/reports/templates/shared/reportPageVariant";
import { ReportBrochureStylePageOne } from "@/lib/reports/templates/shared/ReportBrochureStylePageOne";

type Props = ReportPageOneProps & {
  /** Kept for template API compatibility; brochure classic layout ignores tier. */
  tier?: "detailed";
};

export function ClassicPageOne({ report, reportVariant }: Props) {
  return (
    <ReportBrochureStylePageOne
      report={report}
      reportVariant={reportVariant}
      family="classic"
    />
  );
}
