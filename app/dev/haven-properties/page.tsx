import Link from "next/link";
import { notFound } from "next/navigation";
import { HavenPropertiesPlayground } from "@/components/dev/HavenPropertiesPlayground";
import { Button } from "@/components/ui/button";
import { requireAgency } from "@/lib/auth/requireUser";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import { resolvePlaygroundReportForListing } from "@/lib/reports/resolvePlaygroundReportForListing";

export const DEFAULT_HAVEN_PLAYGROUND_LISTING_ID =
  "0afd7daa-8da8-49c0-94b6-2820f3971ec8";

export default async function DevHavenPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { listingId = DEFAULT_HAVEN_PLAYGROUND_LISTING_ID } = await searchParams;
  const { supabase } = await requireAgency();

  const bundle = await resolvePlaygroundReportForListing(supabase, listingId);

  if (!bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Listing missing preview data</h1>
          <p className="text-sm text-muted-foreground">
            This property needs a short-term rental appraisal with an estimate and generated copy (
            <code className="text-xs">final_report_json</code> or estimate + AI copy).
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">{listingId}</p>
          <Link href={`/listings/${listingId}`}>
            <Button variant="outline">Open listing</Button>
          </Link>
        </div>
      </div>
    );
  }

  const finalReport = await resolvePlaygroundFinalReport(
    supabase,
    bundle.agency,
    bundle.listing,
    bundle.report,
  );

  if (!finalReport) {
    notFound();
  }

  return (
    <HavenPropertiesPlayground
      listingId={listingId}
      reportId={bundle.report.id}
      propertyAddress={bundle.listing.property_address}
      baseReport={finalReport}
    />
  );
}
