"use client";

import { SalesBrochureWizard } from "@/components/collateral/sales-brochure/SalesBrochureWizard";
import type { Agency, CollateralItem, Listing } from "@/lib/types";

type Props = {
  listing: Listing;
  collateral: CollateralItem;
  agency: Agency;
};

export function SalesBrochureEditor({ listing, collateral, agency }: Props) {
  return (
    <SalesBrochureWizard
      initialListing={listing}
      initialCollateral={collateral}
      agency={agency}
    />
  );
}
