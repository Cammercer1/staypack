"use client";

import { SalesBrochureWizard } from "@/components/collateral/sales-brochure/SalesBrochureWizard";
import type {
  Agency,
  AgentProfile,
  CollateralItem,
  Listing,
} from "@/lib/types";

import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";

type Props = {
  agencyAgents?: AgentProfile[];
  availableTemplates?: TemplatesResponse;
  listing: Listing;
  collateral: CollateralItem;
  agency: Agency;
};

export function SalesBrochureEditor({
  listing,
  collateral,
  agency,
  agencyAgents,
  availableTemplates,
}: Props) {
  return (
    <SalesBrochureWizard
      initialListing={listing}
      initialCollateral={collateral}
      agency={agency}
      initialAgencyAgents={agencyAgents}
      availableTemplates={availableTemplates}
    />
  );
}
