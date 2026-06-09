import type { CollateralType, ListingPurpose } from "@/lib/types";

export const STR_REPORT_LABEL = "Short-Term Rental Report";
export const LEASE_APPRAISAL_LABEL = "Long-term rental appraisal";

export const COLLATERAL_TYPE_ORDER: CollateralType[] = [
  "sales_brochure",
  "lease_appraisal",
  "rental_brochure",
  "investor_snapshot",
  "str_report",
  "social_posts",
  "agent_business_card",
];

export function collateralOrderForPurpose(
  purpose: ListingPurpose,
): CollateralType[] {
  return COLLATERAL_TYPE_ORDER.filter((type) =>
    purpose === "lease"
      ? type !== "str_report" && type !== "sales_brochure" && type !== "lease_appraisal"
      : type !== "rental_brochure",
  );
}

export const COLLATERAL_TYPE_META: Record<
  CollateralType,
  { label: string; description: string; comingSoon?: boolean }
> = {
  str_report: {
    label: STR_REPORT_LABEL,
    description: "Short-term rental potential report for buyers.",
  },
  sales_brochure: {
    label: "Sales brochure",
    description: "Print-ready brochure for open homes and property sales.",
  },
  rental_brochure: {
    label: "Lease brochure",
    description: "Branded brochure for properties for lease.",
  },
  lease_appraisal: {
    label: LEASE_APPRAISAL_LABEL,
    description:
      "Investor-facing rental appraisal with REA rent comps, weekly rent range, and suburb context (for sale listings).",
  },
  social_posts: {
    label: "Social posts",
    description: "Ready-to-share graphics for Instagram, Facebook and LinkedIn.",
  },
  investor_snapshot: {
    label: "Investor snapshot",
    description: "Suburb report and one-page investment summary for serious buyers.",
    comingSoon: true,
  },
  agent_business_card: {
    label: "Business card",
    description: "Branded contact card linked to this listing.",
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
