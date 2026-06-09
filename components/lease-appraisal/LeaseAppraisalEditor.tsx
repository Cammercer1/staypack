"use client";

import { LeaseAppraisalWizard } from "@/components/lease-appraisal/LeaseAppraisalWizard";
import type { Agency, CollateralItem, Listing, Report } from "@/lib/types";

type Props = {
  listing: Listing;
  report: Report;
  collateral: CollateralItem;
  agency: Agency;
};

export function LeaseAppraisalEditor({
  listing,
  report,
  collateral,
  agency,
}: Props) {
  return (
    <LeaseAppraisalWizard
      initialListing={listing}
      initialReport={report}
      initialCollateral={collateral}
      agency={agency}
    />
  );
}
