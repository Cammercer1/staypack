"use client";

import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";

import { SalesAppraisalWizard } from "@/components/sales-appraisal/SalesAppraisalWizard";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
  Report,
} from "@/lib/types";

type Props = {
  availableTemplates?: TemplatesResponse;
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
  availableTemplates,
}: Props) {
  return (
    <SalesAppraisalWizard
      initialListing={listing}
      initialReport={report}
      initialCollateral={collateral}
      agency={agency}
      initialAgencyAgents={agencyAgents}
      availableTemplates={availableTemplates}
      skipTemplateSelection={skipTemplateSelection}
    />
  );
}
