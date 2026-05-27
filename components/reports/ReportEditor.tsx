"use client";

import { useState } from "react";
import { ReportListingEntry } from "@/components/reports/ReportListingEntry";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { needsListingSetup } from "@/lib/reports/listingSetup";
import type { Agency, Report } from "@/lib/types";

type Props = {
  initialReport: Report;
  agency: Agency;
};

export function ReportEditor({ initialReport, agency }: Props) {
  const [report, setReport] = useState(initialReport);

  if (needsListingSetup(report)) {
    return <ReportListingEntry report={report} onComplete={setReport} />;
  }

  return <ReportWizard initialReport={report} agency={agency} />;
}
