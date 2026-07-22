import type { CollateralType, ListingPurpose } from "@/lib/types";

export const STR_REPORT_LABEL = "Short-term rental appraisal";
export const LEASE_APPRAISAL_LABEL = "Rental appraisal";
export const SALES_APPRAISAL_LABEL = "Property appraisal";

export const COLLATERAL_TYPE_ORDER: CollateralType[] = [
  "sales_appraisal",
  "lease_appraisal",
  "sales_brochure",
  "rental_brochure",
  "investor_snapshot",
  "str_report",
  "social_posts",
];

export function collateralOrderForPurpose(
  purpose: ListingPurpose,
): CollateralType[] {
  return COLLATERAL_TYPE_ORDER.filter((type) =>
    purpose === "lease"
      ? type !== "str_report" &&
        type !== "sales_brochure" &&
        type !== "lease_appraisal" &&
        type !== "sales_appraisal"
      : type !== "rental_brochure",
  );
}

export const COLLATERAL_TYPE_META: Record<
  CollateralType,
  { label: string; description: string; comingSoon?: boolean }
> = {
  str_report: {
    label: STR_REPORT_LABEL,
    description:
      "A professional short-term rental appraisal with estimated gross revenue, comparable market evidence and a clear performance outlook.",
  },
  sales_brochure: {
    label: "Property brochure",
    description:
      "A polished, print-ready property brochure for open homes, buyer follow-up and vendor presentations.",
  },
  rental_brochure: {
    label: "Rental brochure",
    description:
      "A polished, print-ready rental brochure for inspections and prospective tenant enquiries.",
  },
  lease_appraisal: {
    label: LEASE_APPRAISAL_LABEL,
    description:
      "A landlord-ready rental appraisal with an estimated weekly rent range, comparable rentals and local market context.",
  },
  sales_appraisal: {
    label: SALES_APPRAISAL_LABEL,
    description:
      "A vendor-ready property appraisal with an estimated sale price range and carefully selected comparable sales.",
  },
  social_posts: {
    label: "Social media posts",
    description:
      "On-brand property marketing ready to publish across Instagram, Facebook and LinkedIn.",
  },
  investor_snapshot: {
    label: "Investment report",
    description:
      "A concise, buyer-ready investment report covering the property, suburb and key fundamentals.",
    comingSoon: true,
  },
  agent_business_card: {
    label: "Business card",
    description: "A polished agent contact card with consistent agency branding.",
    comingSoon: true,
  },
};

/** In-app editor route after first-time create, when one exists. */
export function collateralEditorPath(
  listingId: string,
  type: CollateralType,
): string | null {
  switch (type) {
    case "sales_brochure":
      return `/listings/${listingId}/brochure`;
    case "rental_brochure":
      return `/listings/${listingId}/lease-brochure`;
    case "lease_appraisal":
      return `/listings/${listingId}/lease-appraisal`;
    case "sales_appraisal":
      return `/listings/${listingId}/sales-appraisal`;
    case "social_posts":
      return `/listings/${listingId}/social`;
    default:
      return null;
  }
}

export function reportEditorPath(listingId: string, reportId: string): string {
  return `/listings/${listingId}/reports/${reportId}`;
}

export function leaseAppraisalEditorPath(listingId: string): string {
  return `/listings/${listingId}/lease-appraisal`;
}

export function salesAppraisalEditorPath(listingId: string): string {
  return `/listings/${listingId}/sales-appraisal`;
}
