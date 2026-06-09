import {
  SALES_BROCHURE_DEV_SOURCES,
  SALES_BROCHURE_SHARED_SOURCES,
} from "@/lib/collateral/templates/sales-brochure/devSources";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";

const SHARED_PAGE_ONE_SOURCES = [
  "lib/reports/templates/shared/reportPageVariant.ts",
  "lib/reports/templates/shared/StrRevenueBlock.tsx",
  "lib/reports/templates/shared/LtrRentBlock.tsx",
];

const LEASE_PAGE_TWO_SOURCES = [
  "lib/reports/templates/lease-appraisal/LeaseAppraisalCompsPage.tsx",
  "lib/reports/templates/lease-appraisal/LeaseAppraisalFamilyTemplates.tsx",
];

/** Page-1 React files to edit per layout family (STR/lease use sales-brochure page-one layouts). */
export const REPORT_FAMILY_PAGE_ONE_SOURCES: Record<string, string[]> = {
  classic: [
    "lib/collateral/templates/sales-brochure/shared/ClassicBrochurePageOneContent.tsx",
    "lib/collateral/templates/sales-brochure/SalesBrochurePropertySection.tsx",
    "lib/collateral/templates/sales-brochure/shared/BrochurePageOneHeroGallery.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
    "lib/reports/finalReportToBrochureShape.ts",
  ],
  bold: [
    "lib/collateral/templates/sales-brochure/bold/BoldLayout.tsx",
    "lib/collateral/templates/sales-brochure/BoldBrochureOnePage.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
  ],
  gallery: [
    "lib/collateral/templates/sales-brochure/gallery/GalleryLayout.tsx",
    "lib/collateral/templates/sales-brochure/GalleryBrochureOnePage.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
  ],
  editorial: [
    "lib/collateral/templates/sales-brochure/EditorialBrochureOnePage.tsx",
    "lib/collateral/templates/sales-brochure/editorial/EditorialChrome.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
  ],
  split: [
    "lib/collateral/templates/sales-brochure/split/SplitLayout.tsx",
    "lib/collateral/templates/sales-brochure/SplitBrochureOnePage.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
  ],
  refined: [
    "lib/collateral/templates/sales-brochure/refined/RefinedLayout.tsx",
    "lib/collateral/templates/sales-brochure/RefinedBrochureOnePage.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
  ],
  minimalist: [
    "lib/collateral/templates/sales-brochure/minimalist/MinimalistLayout.tsx",
    "lib/collateral/templates/sales-brochure/MinimalistBrochureOnePage.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
  ],
  landmark: [
    "lib/collateral/templates/sales-brochure/landmark/LandmarkLayout.tsx",
    "lib/collateral/templates/sales-brochure/LandmarkBrochureOnePage.tsx",
    "lib/reports/templates/shared/ReportBrochureStylePageOne.tsx",
  ],
  "haven-properties": [
    "lib/reports/templates/haven-properties/HavenLeaseAppraisalPageOne.tsx",
    "lib/reports/templates/haven-properties/HavenPropertiesLeaseAppraisalTemplate.tsx",
  ],
};

const STR_PAGE_TWO: Record<string, string[]> = {
  classic: ["lib/reports/templates/classic/PageTwo.tsx"],
  bold: ["lib/reports/templates/classic/PageTwo.tsx"],
  gallery: ["lib/reports/templates/classic/PageTwo.tsx"],
  editorial: ["lib/reports/templates/classic/PageTwo.tsx"],
  split: ["lib/reports/templates/classic/PageTwo.tsx"],
  refined: ["lib/reports/templates/classic/PageTwo.tsx"],
  minimalist: ["lib/reports/templates/classic/PageTwo.tsx"],
  landmark: ["lib/reports/templates/classic/PageTwo.tsx"],
};

export function getSalesBrochureDevSources(templateId: string) {
  return [
    ...(SALES_BROCHURE_DEV_SOURCES[templateId] ?? [
      `lib/collateral/templates/sales-brochure/`,
    ]),
    ...SALES_BROCHURE_SHARED_SOURCES,
    "lib/reports/templates/shared/reportPageVariant.ts",
  ];
}

export function getReportTemplateDevSources(
  family: string,
  pageVariant: ReportPageVariant,
  salesBrochureTemplateId?: string,
): string[] {
  if (pageVariant === "sale") {
    return getSalesBrochureDevSources(
      salesBrochureTemplateId ?? "sales-brochure-classic-1pg",
    );
  }

  const pageOne = REPORT_FAMILY_PAGE_ONE_SOURCES[family] ?? [
    `lib/reports/templates/${family}/`,
  ];
  const pageTwo =
    pageVariant === "lease"
      ? LEASE_PAGE_TWO_SOURCES
      : (STR_PAGE_TWO[family] ?? []);

  return [
    ...SHARED_PAGE_ONE_SOURCES,
    ...pageOne,
    ...pageTwo,
    "lib/reports/templates/registry.ts",
    "lib/reports/templates/ids.ts",
  ];
}
