import { BoldReportPageOne } from "@/lib/reports/templates/bold/BoldTemplate";
import { ClassicPageOne } from "@/lib/reports/templates/classic/PageOne";
import { EditorialReportPageOne } from "@/lib/reports/templates/editorial/EditorialTemplate";
import { GalleryReportPageOne } from "@/lib/reports/templates/gallery/GalleryTemplate";
import { LandmarkReportPageOne } from "@/lib/reports/templates/landmark/LandmarkTemplate";
import { MinimalistReportPageOne } from "@/lib/reports/templates/minimalist/MinimalistTemplate";
import { RefinedReportPageOne } from "@/lib/reports/templates/refined/RefinedTemplate";
import { SplitReportPageOne } from "@/lib/reports/templates/split/SplitTemplate";
import { SalesAppraisalCompsPage } from "@/lib/reports/templates/sales-appraisal/SalesAppraisalCompsPage";
import type { ReportPageOneProps } from "@/lib/reports/templates/shared/reportPageVariant";
import type { ReactNode } from "react";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

const SALES_APPRAISAL_PAGE_ONE_PROPS = {
  reportVariant: "sales_appraisal",
} as const satisfies Partial<ReportPageOneProps>;

function composeSalesAppraisalTemplate(
  PageOne: (props: ReportPageOneProps) => ReactNode,
) {
  return function SalesAppraisalTemplate({ report }: ReportTemplateProps) {
    return (
      <>
        {PageOne({ report, ...SALES_APPRAISAL_PAGE_ONE_PROPS })}
        <SalesAppraisalCompsPage report={report} />
      </>
    );
  };
}

/** STR-style page 1 (sales appraisal variant) + shared REA comparables page 2. */
export const ClassicSalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <ClassicPageOne report={props.report} tier="detailed" reportVariant="sales_appraisal" />
));

export const BoldSalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <BoldReportPageOne report={props.report} reportVariant="sales_appraisal" />
));

export const GallerySalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <GalleryReportPageOne report={props.report} reportVariant="sales_appraisal" />
));

export const EditorialSalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <EditorialReportPageOne report={props.report} reportVariant="sales_appraisal" />
));

export const SplitSalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <SplitReportPageOne report={props.report} reportVariant="sales_appraisal" />
));

export const RefinedSalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <RefinedReportPageOne report={props.report} reportVariant="sales_appraisal" />
));

export const MinimalistSalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <MinimalistReportPageOne report={props.report} reportVariant="sales_appraisal" />
));

export const LandmarkSalesAppraisalTemplate = composeSalesAppraisalTemplate((props) => (
  <LandmarkReportPageOne report={props.report} reportVariant="sales_appraisal" />
));
