import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireListingReportAccess } from "@/lib/auth/requireUser";
import { ReportEditor } from "@/components/reports/ReportEditor";
import { Button } from "@/components/ui/button";
import { STR_REPORT_LABEL } from "@/lib/listings/collateralTypes";
import { refreshStrEnrichmentInFinalReport } from "@/lib/airbtics/enrich";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import type { FinalReportJson, Listing, Report } from "@/lib/types";

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

  const availableTemplates = await resolveAvailableTemplates(agency, "str");
  const soleTemplateId =
    availableTemplates.templates.length === 1
      ? availableTemplates.templates[0].id
      : null;
  const cachedFinalReport = report.final_report_json as FinalReportJson | null;
  const editorReport: Report = soleTemplateId
    ? {
        ...report,
        template_id: soleTemplateId,
        final_report_json: cachedFinalReport
          ? {
              ...refreshStrEnrichmentInFinalReport(
                cachedFinalReport,
                report.raw_airbtics_json,
              ),
              template_id: soleTemplateId,
            }
          : null,
      }
    : report;

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
          {STR_REPORT_LABEL}
        </h1>
        <p className="text-muted-foreground">
          Run the STR estimate, generate collateral, and publish this report for{" "}
          {listing.property_address ?? "this listing"}.
        </p>
      </div>

      <ReportEditor
        initialListing={listing}
        initialReport={editorReport}
        agency={agency}
      />
    </div>
  );
}
