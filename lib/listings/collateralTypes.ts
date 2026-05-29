import type { CollateralType, ListingPurpose } from "@/lib/types";

export const STR_REPORT_LABEL = "Short-Term Rental Report";

export const COLLATERAL_TYPE_ORDER: CollateralType[] = [
  "sales_brochure",
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
      ? type !== "str_report" && type !== "sales_brochure"
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
    comingSoon: true,
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
