"use client";

import Link from "next/link";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { Button } from "@/components/ui/button";
import { applyBelleBrandToReport } from "@/lib/reports/templates/belle-property/brand";
import { BELLE_PROPERTY_STR_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import type { FinalReportJson } from "@/lib/types";

const SOURCE_FILES = [
  "lib/branding/kits/belle.ts",
  "lib/reports/templates/belle-property/BellePropertyStrTemplate.tsx",
  "lib/collateral/templates/sales-brochure/belle/BelleLayout.tsx",
  "lib/reports/templates/classic/PageTwo.tsx",
  "lib/reports/templates/registry.ts",
];

type Props = {
  listingId: string;
  reportId: string;
  propertyAddress: string | null;
  baseReport: FinalReportJson;
};

export function BellePropertiesPlayground({
  listingId,
  reportId,
  propertyAddress,
  baseReport,
}: Props) {
  const previewReport = applyBelleBrandToReport({
    ...baseReport,
    template_id: BELLE_PROPERTY_STR_TEMPLATE_ID,
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
              Belle Property Group STR
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Isolated fork of Bold page 1 in{" "}
              <code className="text-xs">belle/BelleLayout.tsx</code>. Brand kit in{" "}
              <code className="text-xs">lib/branding/kits/belle.ts</code>.
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-medium">{propertyAddress ?? "Untitled listing"}</p>
            <p className="text-xs text-muted-foreground">Listing</p>
            <p className="break-all font-mono text-xs">{listingId}</p>
            <p className="mt-2 text-xs text-muted-foreground">Report</p>
            <p className="break-all font-mono text-xs">{reportId}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/listings/${listingId}/reports/${reportId}`}>
              <Button variant="outline" size="sm">
                Open report editor
              </Button>
            </Link>
            <Link href={`/dev/belle-property/lease-appraisal?listingId=${listingId}`}>
              <Button variant="outline" size="sm">
                Belle lease preview
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
