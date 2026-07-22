import slugify from "slugify";
import type { CollateralType } from "@/lib/types";
import { isLeaseAppraisalTemplateId } from "@/lib/reports/templates/shared/isLeaseAppraisalReport";
import { isSalesAppraisalTemplateId } from "@/lib/reports/templates/shared/isSalesAppraisalReport";

const ADDRESS_SEGMENT_MAX = 80;
const BRAND_SEGMENT_MAX = 56;

const collateralTypeSegments: Record<CollateralType, string> = {
  str_report: "short-term-rental-appraisal",
  sales_brochure: "sales-brochure",
  rental_brochure: "rental-brochure",
  lease_appraisal: "rental-appraisal",
  sales_appraisal: "sales-appraisal",
  social_posts: "social-media-assets",
  investor_snapshot: "investor-snapshot",
  agent_business_card: "business-card",
};

function filenameSegment(value: string | null | undefined, fallback: string) {
  return (
    slugify(value?.trim() ?? "", {
      lower: true,
      strict: true,
      trim: true,
    }) || fallback
  );
}

export function resolveReportDownloadType(templateId: string | null | undefined) {
  if (isSalesAppraisalTemplateId(templateId)) {
    return "sales-appraisal";
  }

  if (isLeaseAppraisalTemplateId(templateId)) {
    return "rental-appraisal";
  }

  return "short-term-rental-appraisal";
}

export function resolveCollateralDownloadType(type: CollateralType) {
  return collateralTypeSegments[type];
}

export function buildPublishedPdfFilename({
  address,
  reportType,
  brandName,
}: {
  address: string | null | undefined;
  reportType: string;
  brandName: string | null | undefined;
}) {
  const addressSegment = filenameSegment(address, "property").slice(
    0,
    ADDRESS_SEGMENT_MAX,
  );
  const typeSegment = filenameSegment(reportType, "report");
  const brandSegment = filenameSegment(brandName, "agency").slice(
    0,
    BRAND_SEGMENT_MAX,
  );

  return `${addressSegment}-${typeSegment}-${brandSegment}.pdf`;
}
