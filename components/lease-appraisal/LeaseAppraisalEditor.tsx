"use client";

import { LeaseAppraisalWizard } from "@/components/lease-appraisal/LeaseAppraisalWizard";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
  Report,
} from "@/lib/types";

type Props = {
  listing: Listing;
  report: Report;
  collateral: CollateralItem;
  agency: Agency;
  agencyAgents: AgentProfile[];
  skipTemplateSelection?: boolean;
};

export function LeaseAppraisalEditor({
  listing,
  report,
  collateral,
  agency,
  agencyAgents,
  skipTemplateSelection = false,
}: Props) {
  return (
    <LeaseAppraisalWizard
      initialListing={listing}
      initialReport={report}
      initialCollateral={collateral}
      agency={agency}
      initialAgencyAgents={agencyAgents}
      skipTemplateSelection={skipTemplateSelection}
    />
  );
}
