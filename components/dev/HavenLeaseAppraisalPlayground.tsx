"use client";

import Link from "next/link";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { Button } from "@/components/ui/button";
import { applyHavenLeaseAppraisalBrandToReport } from "@/lib/reports/templates/haven-properties/brand";
import { HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import type { FinalReportJson } from "@/lib/types";

const SOURCE_FILES = [
  "lib/reports/templates/haven-properties/brand.ts",
  "lib/reports/templates/haven-properties/HavenPropertiesLeaseAppraisalTemplate.tsx",
  "lib/reports/templates/haven-properties/HavenLeaseAppraisalPageOne.tsx",
  "lib/reports/templates/haven-properties/HavenLeaseAppraisalPageTwo.tsx",
  "lib/reports/templates/haven-properties/HavenLtrCompsGrid.tsx",
  "lib/lease-appraisal/buildLeaseAppraisalReport.ts",
  "lib/rental/enrichListingRentalAppraisal.ts",
];

type Props = {
  baseReport: FinalReportJson;
};

export function HavenLeaseAppraisalPlayground({ baseReport }: Props) {
  const previewReport = applyHavenLeaseAppraisalBrandToReport({
    ...baseReport,
    template_id: HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
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
              havenly property · Rental appraisal
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Landlord-ready <strong>rental appraisal</strong> (not a tenant-facing
              rental brochure). Landmark-inspired layout in{" "}
              <code className="text-xs">haven-properties/</code>. Data from REA discover
              pipeline; fixture: 1401/67 Ferny Ave (live REA scrape).
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-medium">{previewReport.property.address}</p>
            <p className="text-xs text-muted-foreground">
              {previewReport.ltr_enrichment?.comp_count ?? 0} comps ·{" "}
              {previewReport.property.display_price}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dev/haven-properties">
              <Button variant="outline" size="sm">
                STR playground
              </Button>
            </Link>
            <Link href="/api/listings/rental-appraisal" target="_blank">
              <Button variant="outline" size="sm">
                Rental appraisal API
              </Button>
            </Link>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Source files</p>
            <ul className="mt-2 space-y-1 font-mono text-[0.65rem] text-muted-foreground">
              {SOURCE_FILES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="min-h-0 flex-1 bg-neutral-100 p-4 lg:p-8">
        <FittedReportPreview report={previewReport} />
      </main>
    </div>
  );
}
