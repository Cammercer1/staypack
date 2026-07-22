"use client";

import { SalesAppraisalWizard } from "@/components/sales-appraisal/SalesAppraisalWizard";
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

export function SalesAppraisalEditor({
  listing,
  report,
  collateral,
  agency,
  agencyAgents,
  skipTemplateSelection = false,
}: Props) {
  return (
    <SalesAppraisalWizard
      initialListing={listing}
      initialReport={report}
      initialCollateral={collateral}
      agency={agency}
      initialAgencyAgents={agencyAgents}
      skipTemplateSelection={skipTemplateSelection}
    />
  );
}
