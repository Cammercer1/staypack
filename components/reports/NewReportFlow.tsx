"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListingUrlStep } from "@/components/reports/ListingUrlStep";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { createEmptyReportDraft } from "@/lib/reports/emptyReportDraft";
import type { Agency, Report } from "@/lib/types";

export function NewReportFlow({ agency }: { agency: Agency }) {
  const router = useRouter();
  const [manualReport, setManualReport] = useState<Report | null>(null);

  if (manualReport) {
    return <ReportWizard initialReport={manualReport} agency={agency} />;
  }

  return (
    <ListingUrlStep
      report={createEmptyReportDraft()}
      onComplete={(nextReport) => {
        router.push(`/reports/${nextReport.id}`);
        router.refresh();
      }}
      onManualEntry={setManualReport}
    />
  );
}
