import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { LeaseAppraisalEditor } from "@/components/lease-appraisal/LeaseAppraisalEditor";
import { Button } from "@/components/ui/button";
import { LEASE_APPRAISAL_LABEL } from "@/lib/listings/collateralTypes";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/lease-appraisal/leaseAppraisalTemplates";
import type { CollateralItem, Report } from "@/lib/types";

/** Drafts auto-assigned Classic before template step existed — reopen on Choose template. */
async function clearLegacyAutoTemplate(
  supabase: Awaited<ReturnType<typeof requireListingAccess>>["supabase"],
  report: Report,
  collateral: CollateralItem | null,
) {
  if (report.final_report_json || report.status !== "draft") {
    return { report, collateral };
  }

  const hadAutoTemplate =
    report.template_id === DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID ||
    collateral?.template_id === DEFAULT_LEASE_APPRAISAL_TEMPLATE_ID;

  if (!hadAutoTemplate) {
    return { report, collateral };
  }

  const { data: updatedReport } = await supabase
    .from("reports")
    .update({ template_id: null })
    .eq("id", report.id)
    .select("*")
    .single();

  let nextCollateral = collateral;
  if (collateral?.id) {
    const { data: updatedCollateral } = await supabase
      .from("collateral_items")
      .update({ template_id: null })
      .eq("id", collateral.id)
      .select("*")
      .single();
    nextCollateral = (updatedCollateral as CollateralItem | null) ?? collateral;
  }

  return {
    report: (updatedReport as Report | null) ?? { ...report, template_id: null },
    collateral: nextCollateral,
  };
}

export default async function ListingLeaseAppraisalPage({
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
    .eq("type", "lease_appraisal")
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
        row.template_id?.includes("lease-appraisal"),
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
        type: "lease_appraisal",
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

  ({ report, collateral } = await clearLegacyAutoTemplate(
    supabase,
    report,
    collateral as CollateralItem | null,
  ));

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
          {LEASE_APPRAISAL_LABEL}
        </h1>
        <p className="text-muted-foreground">
          Choose a template, set rent comps and weekly range, generate and edit
          investor content, then publish a PDF for{" "}
          {listing.property_address ?? "this property"}.
        </p>
      </div>

      <LeaseAppraisalEditor
        listing={listing}
        report={report}
        collateral={collateral as CollateralItem}
        agency={agency}
      />
    </div>
  );
}
