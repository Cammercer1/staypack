import { BoldReportPageOne } from "@/lib/reports/templates/bold/BoldTemplate";
import { ClassicPageOne } from "@/lib/reports/templates/classic/PageOne";
import { EditorialReportPageOne } from "@/lib/reports/templates/editorial/EditorialTemplate";
import { GalleryReportPageOne } from "@/lib/reports/templates/gallery/GalleryTemplate";
import { HavenLeaseAppraisalPageOne } from "@/lib/reports/templates/haven-properties/HavenLeaseAppraisalPageOne";
import { LandmarkReportPageOne } from "@/lib/reports/templates/landmark/LandmarkTemplate";
import { LeaseAppraisalCompsPage } from "@/lib/reports/templates/lease-appraisal/LeaseAppraisalCompsPage";
import { MinimalistReportPageOne } from "@/lib/reports/templates/minimalist/MinimalistTemplate";
import { RefinedReportPageOne } from "@/lib/reports/templates/refined/RefinedTemplate";
import { SplitReportPageOne } from "@/lib/reports/templates/split/SplitTemplate";
import type { ReportPageOneProps } from "@/lib/reports/templates/shared/reportPageVariant";
import type { ReactNode } from "react";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

const LEASE_PAGE_ONE_PROPS = { reportVariant: "lease" } as const satisfies Partial<
  ReportPageOneProps
>;

function composeLeaseAppraisalTemplate(
  PageOne: (props: ReportPageOneProps) => ReactNode,
) {
  return function LeaseAppraisalTemplate({ report }: ReportTemplateProps) {
    return (
      <>
        {PageOne({ report, ...LEASE_PAGE_ONE_PROPS })}
        <LeaseAppraisalCompsPage report={report} />
      </>
    );
  };
}

/** STR-style page 1 (lease variant) + shared REA comparables page 2. */
export const ClassicLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <ClassicPageOne report={props.report} tier="detailed" reportVariant="lease" />
));

export const BoldLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <BoldReportPageOne report={props.report} reportVariant="lease" />
));

export const GalleryLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <GalleryReportPageOne report={props.report} reportVariant="lease" />
));

export const EditorialLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <EditorialReportPageOne report={props.report} reportVariant="lease" />
));

export const SplitLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <SplitReportPageOne report={props.report} reportVariant="lease" />
));

export const RefinedLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <RefinedReportPageOne report={props.report} reportVariant="lease" />
));

export const MinimalistLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <MinimalistReportPageOne report={props.report} reportVariant="lease" />
));

export const LandmarkLeaseAppraisalTemplate = composeLeaseAppraisalTemplate((props) => (
  <LandmarkReportPageOne report={props.report} reportVariant="lease" />
));

export function HavenPropertiesLeaseAppraisalTemplate({ report }: ReportTemplateProps) {
  return (
    <>
      <HavenLeaseAppraisalPageOne report={report} />
      <LeaseAppraisalCompsPage report={report} />
    </>
  );
}
