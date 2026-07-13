"use client";

import { SalesAppraisalWizard } from "@/components/sales-appraisal/SalesAppraisalWizard";
import type { Agency, CollateralItem, Listing, Report } from "@/lib/types";

type Props = {
  listing: Listing;
  report: Report;
  collateral: CollateralItem;
  agency: Agency;
};

export function SalesAppraisalEditor({
  listing,
  report,
  collateral,
  agency,
}: Props) {
  return (
    <SalesAppraisalWizard
      initialListing={listing}
      initialReport={report}
      initialCollateral={collateral}
      agency={agency}
    />
  );
}
