"use client";

import { useRouter } from "next/navigation";
import { ListingUrlStep } from "@/components/reports/ListingUrlStep";
import type { Report } from "@/lib/types";

type Props = {
  report: Report;
  redirectOnComplete?: boolean;
  onComplete?: (report: Report) => void;
};

export function ReportListingEntry({
  report,
  redirectOnComplete = false,
  onComplete,
}: Props) {
  const router = useRouter();

  function handleComplete(nextReport: Report) {
    if (onComplete) {
      onComplete(nextReport);
      return;
    }

    if (redirectOnComplete) {
      router.push(`/reports/${nextReport.id}`);
      router.refresh();
    }
  }

  return (
    <ListingUrlStep
      report={report}
      onComplete={handleComplete}
      onManualEntry={handleComplete}
    />
  );
}
