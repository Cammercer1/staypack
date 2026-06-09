import { ClassicPageTwo } from "@/lib/reports/templates/classic/PageTwo";
import { createBrochureStyleReportPageOne } from "@/lib/reports/templates/shared/createBrochureStyleReportPageOne";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

export const GalleryReportPageOne = createBrochureStyleReportPageOne("gallery");

export function GalleryLightTemplate({ report }: ReportTemplateProps) {
  return <GalleryReportPageOne report={report} />;
}

export function GalleryDetailedTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <GalleryReportPageOne report={report} />
      <ClassicPageTwo report={report} />
    </>
  );
}
