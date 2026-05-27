import type { ReportStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const labels: Record<ReportStatus, string> = {
  draft: "Draft",
  scraped: "Imported",
  estimated: "Estimated",
  generated: "Generated",
  published: "Published",
  failed: "Failed",
  archived: "Archived",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge variant="secondary">{labels[status]}</Badge>;
}
