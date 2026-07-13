import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { SalesAppraisalEditor } from "@/components/sales-appraisal/SalesAppraisalEditor";
import { Button } from "@/components/ui/button";
import { SALES_APPRAISAL_LABEL } from "@/lib/listings/collateralTypes";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import type { CollateralItem, Report } from "@/lib/types";

export default async function ListingSalesAppraisalPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;

  let agency;
  let listing;
  let supabase;

  try {
    ({ agency, listing, supabase } = await requireListingAccess(listingId));
  } catch {
    notFound();
  }

  const photoError = collateralPhotoRequirementError(listing);
  if (photoError) {
    redirect(`/listings/${listingId}`);
  }

  if (listing.listing_purpose === "lease") {
    redirect(`/listings/${listingId}`);
  }

  let { data: collateral } = await supabase
    .from("collateral_items")
    .select("*")
    .eq("listing_id", listing.id)
    .eq("type", "sales_appraisal")
    .neq("status", "archived")
    .maybeSingle();

  let report: Report | null = null;

  if (collateral?.report_id) {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("id", collateral.report_id)
      .maybeSingle();
    report = (data as Report | null) ?? null;
  }

  if (!report) {
    const { data: reportRows } = await supabase
      .from("reports")
      .select("*")
      .eq("listing_id", listing.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    report =
      (reportRows as Report[] | null)?.find((row) =>
        row.template_id?.includes("sales-appraisal"),
      ) ?? null;
  }

  if (!report) {
    const { data: createdReport, error: reportError } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        listing_id: listing.id,
        status: "draft",
        template_id: null,
      })
      .select("*")
      .single();

    if (reportError || !createdReport) {
      notFound();
    }

    report = createdReport as Report;
  }

  if (!collateral) {
    const { data: createdCollateral, error: collateralError } = await supabase
      .from("collateral_items")
      .insert({
        listing_id: listing.id,
        agency_id: agency.id,
        type: "sales_appraisal",
        status: "draft",
        report_id: report.id,
        template_id: report.template_id,
      })
      .select("*")
      .single();

    if (collateralError || !createdCollateral) {
      notFound();
    }

    collateral = createdCollateral;
  }

  const agencyAgents = await loadAgencyAgentProfiles(supabase, agency.id);

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
          {SALES_APPRAISAL_LABEL}
        </h1>
        <p className="text-muted-foreground">
          Choose a template, review sold and for-sale comps and the price band,
          generate and edit vendor content, then publish a PDF for{" "}
          {listing.property_address ?? "this property"}.
        </p>
      </div>

      <SalesAppraisalEditor
        listing={listing}
        report={report}
        collateral={collateral as CollateralItem}
        agency={agency}
        agencyAgents={agencyAgents}
      />
    </div>
  );
}
