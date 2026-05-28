import type { CollateralType } from "@/lib/types";

export const STR_REPORT_LABEL = "Short-Term Rental Report";

export const COLLATERAL_TYPE_ORDER: CollateralType[] = [
  "str_report",
  "sales_brochure",
  "investor_snapshot",
  "agent_business_card",
];

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
    description: "Print-ready property brochure for open homes.",
    comingSoon: true,
  },
  investor_snapshot: {
    label: "Investor snapshot",
    description: "One-page investment summary for serious buyers.",
    comingSoon: true,
  },
  agent_business_card: {
    label: "Agent business card",
    description: "Branded contact card linked to this listing.",
  },
};
