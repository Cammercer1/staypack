"use client";

import { useState } from "react";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import { ReportWizard } from "@/components/reports/ReportWizard";
import type { Agency, Listing, Report } from "@/lib/types";

type Props = {
  initialListing: Listing;
  initialReport: Report;
  agency: Agency;
  availableTemplates?: TemplatesResponse;
};

export function ReportEditor({ initialListing, initialReport, agency, availableTemplates }: Props) {
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);

  return (
    <ReportWizard
      initialListing={listing}
      initialReport={report}
      agency={agency}
      availableTemplates={availableTemplates}
      onListingChange={setListing}
      onReportChange={setReport}
    />
  );
}
