import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireListingReportAccess } from "@/lib/auth/requireUser";
import { ReportEditor } from "@/components/reports/ReportEditor";
import { Button } from "@/components/ui/button";
import type { Listing, Report } from "@/lib/types";

export default async function ListingReportEditorPage({
  params,
}: {
  params: Promise<{ listingId: string; reportId: string }>;
}) {
  const { listingId, reportId } = await params;

  let agency;
  let listing: Listing;
  let report: Report;

  try {
    ({ agency, listing, report } = await requireListingReportAccess(
      listingId,
      reportId,
    ));
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/listings/${listing.id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to listing
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="heading-gradient text-3xl font-semibold">
          STR report
        </h1>
        <p className="text-muted-foreground">
          Run the STR estimate, generate copy, and publish this report for{" "}
          {listing.property_address ?? "this listing"}.
        </p>
      </div>

      <ReportEditor
        initialListing={listing}
        initialReport={report}
        agency={agency}
      />
    </div>
  );
}
