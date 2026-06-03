"use client";

import Link from "next/link";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { Button } from "@/components/ui/button";
import { HAVEN_PROPERTIES_STR_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import type { FinalReportJson } from "@/lib/types";

const SOURCE_FILES = [
  "lib/reports/templates/haven-properties/brand.ts",
  "lib/reports/templates/haven-properties/HavenPropertiesStrTemplate.tsx",
  "lib/reports/templates/bold/BoldTemplate.tsx",
  "lib/reports/templates/haven-properties/HavenPageTwo.tsx",
  "lib/reports/templates/registry.ts",
];

type Props = {
  listingId: string;
  reportId: string;
  propertyAddress: string | null;
  baseReport: FinalReportJson;
};

export function HavenPropertiesPlayground({
  listingId,
  reportId,
  propertyAddress,
  baseReport,
}: Props) {
  const previewReport: FinalReportJson = {
    ...baseReport,
    template_id: HAVEN_PROPERTIES_STR_TEMPLATE_ID,
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b bg-background lg:w-96 lg:border-b-0 lg:border-r">
        <div className="space-y-6 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dev only
            </p>
            <h1 className="mt-1 font-display text-2xl tracking-tight">
              havenly property STR
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Layout is <strong>Bold detailed STR</strong> (
              <code className="text-xs">lib/reports/templates/bold/BoldTemplate.tsx</code>
              ). Logos/colours hardcoded in <code className="text-xs">brand.ts</code>. Live
              listing data below.
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

          <p className="text-xs text-muted-foreground">
            URL:{" "}
            <code>/dev/haven-properties?listingId={"{"}uuid{"}"}</code>
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-auto bg-muted/40 p-6 lg:p-10">
        <FittedReportPreview
          report={previewReport}
          maxHeight="none"
          className="mx-auto w-full max-w-[920px] border-0 bg-transparent shadow-none"
        />
      </main>
    </div>
  );
}
