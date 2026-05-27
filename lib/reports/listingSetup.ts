import type { Report } from "@/lib/types";

export function needsListingSetup(report: Report) {
  return report.status === "draft";
}
