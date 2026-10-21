import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStrAppraisalAccess } from "@/lib/str-appraisals/service";
import { hasPublishedProposal } from "@/lib/digital-proposals/publication";
import { AppraisalCustomerPanel } from "@/components/str-appraisals/AppraisalCustomerPanel";
import { ReportEditor } from "@/components/reports/ReportEditor";
import { Button } from "@/components/ui/button";
import { STR_REPORT_LABEL } from "@/lib/listings/collateralTypes";
import type { Listing, Report } from "@/lib/types";

export default async function ListingReportEditorPage({
  params, searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams?: Promise<{ review?: string }>;
}) {
  const { reportId } = await params;
  const reviewProperty = (await searchParams)?.review === "property";
  let appraisal;

  let agency;
  let listing: Listing;
  let report: Report;
  let publishedProposal = false;

  try {
    const context = await requireStrAppraisalAccess(reportId);
    ({ agency, listing, report, appraisal } = context);
    if (report.status !== "archived") {
      publishedProposal = await hasPublishedProposal(context.supabase, agency.id, report.id);
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && ["STR appraisal not found", "Report not found", "Listing not found"].includes(error.message)) notFound();
    throw error;
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/short-term-rentals">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Short-Term Rentals
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="heading-gradient text-3xl font-semibold">
          {STR_REPORT_LABEL}
        </h1>
        <p className="text-muted-foreground">
          Prepare a digital proposal for{" "}
          {listing.property_address ?? "this listing"}.
        </p>
      </div>

      {report.status === "archived" && <AppraisalCustomerPanel key={`${appraisal.updated_at}-${report.status}`} initialAppraisal={appraisal} archived />}
      {report.status === "archived" ? <p>This appraisal is archived. Restore it to continue editing. Restoring does not republish its public link.</p> : <ReportEditor
        calculatorReview={reviewProperty}
        appraisal={appraisal}
        initialListing={listing}
        initialReport={report}
        hasPublishedProposal={publishedProposal}
        agency={agency}
      />}
    </div>
  );
}
