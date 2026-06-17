import Link from "next/link";
import { notFound } from "next/navigation";
import { BelleLeaseAppraisalPlayground } from "@/components/dev/BelleLeaseAppraisalPlayground";
import { Button } from "@/components/ui/button";
import { getLeaseAppraisalPlaygroundReport } from "@/lib/lease-appraisal/leaseAppraisalPlayground";
import { loadPlaygroundListingContext } from "@/lib/reports/loadPlaygroundListingContext";

export default async function DevBelleLeaseAppraisalPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { listingId } = await searchParams;

  if (!listingId) {
    const baseReport = getLeaseAppraisalPlaygroundReport();

    return (
      <div className="flex min-h-screen flex-col">
        <div className="border-b bg-muted/40 px-6 py-3">
          <p className="text-sm text-muted-foreground">
            Mock fixture data. Pass{" "}
            <code className="text-xs">?listingId=...</code> for live listing preview.
          </p>
        </div>
        <BelleLeaseAppraisalPlayground baseReport={baseReport} />
      </div>
    );
  }

  const context = await loadPlaygroundListingContext(listingId);

  if (!context?.leaseReport || !context.leaseReportId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Listing missing lease preview data</h1>
          <p className="text-sm text-muted-foreground">
            This listing needs a lease appraisal report with comps and generated copy.
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">{listingId}</p>
          <Link href={`/listings/${listingId}`}>
            <Button variant="outline">Open listing</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BelleLeaseAppraisalPlayground
      listingId={listingId}
      reportId={context.leaseReportId}
      propertyAddress={context.propertyAddress}
      baseReport={context.leaseReport}
    />
  );
}
