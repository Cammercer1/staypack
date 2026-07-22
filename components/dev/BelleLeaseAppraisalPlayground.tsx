"use client";

import Link from "next/link";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { Button } from "@/components/ui/button";
import { applyBelleBrandToReport } from "@/lib/reports/templates/belle-property/brand";
import { BELLE_PROPERTY_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import type { FinalReportJson } from "@/lib/types";

const SOURCE_FILES = [
  "lib/branding/kits/belle.ts",
  "lib/reports/templates/belle-property/BellePropertyLeaseAppraisalTemplate.tsx",
  "lib/collateral/templates/sales-brochure/belle/BelleLayout.tsx",
  "lib/reports/templates/belle-property/BelleLeaseAppraisalPageTwo.tsx",
  "lib/reports/templates/registry.ts",
];

type Props = {
  baseReport: FinalReportJson;
  listingId?: string;
  reportId?: string;
  propertyAddress?: string | null;
};

export function BelleLeaseAppraisalPlayground({
  baseReport,
  listingId,
  reportId,
  propertyAddress,
}: Props) {
  const previewReport = applyBelleBrandToReport({
    ...baseReport,
    template_id: BELLE_PROPERTY_LEASE_APPRAISAL_TEMPLATE_ID,
  });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b bg-background lg:w-96 lg:border-b-0 lg:border-r">
        <div className="space-y-6 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dev only
            </p>
            <h1 className="mt-1 font-display text-2xl tracking-tight">
              Belle Property Group rental appraisal
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Bold-derived page 1 with shared lease comps page 2.
            </p>
          </div>

          {listingId ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{propertyAddress ?? "Untitled listing"}</p>
              <p className="text-xs text-muted-foreground">Listing</p>
              <p className="break-all font-mono text-xs">{listingId}</p>
              {reportId ? (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">Report</p>
                  <p className="break-all font-mono text-xs">{reportId}</p>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {listingId && reportId ? (
              <Link href={`/listings/${listingId}/reports/${reportId}`}>
                <Button variant="outline" size="sm">
                  Open report editor
                </Button>
              </Link>
            ) : null}
            <Link
              href={
                listingId
                  ? `/dev/belle-property?listingId=${listingId}`
                  : "/dev/belle-property"
              }
            >
              <Button variant="outline" size="sm">
                Belle STR preview
              </Button>
            </Link>
            <Link href="/dev/templates">
              <Button variant="outline" size="sm">
                All templates
              </Button>
            </Link>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Source files</p>
            <ul className="space-y-1 font-mono text-xs text-muted-foreground">
              {SOURCE_FILES.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-auto bg-neutral-200 p-6">
        <FittedReportPreview report={previewReport} />
      </main>
    </div>
  );
}
