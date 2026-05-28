"use client";

import { useState } from "react";
import { ReportWizard } from "@/components/reports/ReportWizard";
import type { Agency, Listing, Report } from "@/lib/types";

type Props = {
  initialListing: Listing;
  initialReport: Report;
  agency: Agency;
};

export function ReportEditor({ initialListing, initialReport, agency }: Props) {
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);

  return (
    <ReportWizard
      initialListing={listing}
      initialReport={report}
      agency={agency}
      onListingChange={setListing}
      onReportChange={setReport}
    />
  );
}
