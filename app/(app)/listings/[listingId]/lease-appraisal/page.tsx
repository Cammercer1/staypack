import Link from "next/link";
import { serializeTemplateForApi } from "@/lib/templates/serializeForApi";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { LeaseAppraisalEditor } from "@/components/lease-appraisal/LeaseAppraisalEditor";
import { Button } from "@/components/ui/button";
import { LEASE_APPRAISAL_LABEL } from "@/lib/listings/collateralTypes";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import type { CollateralItem, Report } from "@/lib/types";

export default async function ListingLeaseAppraisalPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ reportId?: string }>;
}) {
  const { listingId } = await params;
  const { reportId } = await searchParams;

  let agency;
  let listing;
  let supabase;

  try {
    ({ agency, listing, supabase } = await requireListingAccess(listingId));
  } catch {
    notFound();
  }

  const availableTemplates = await resolveAvailableTemplates(agency, "lease");
  const soleTemplateId =
    availableTemplates.templates.length === 1
      ? availableTemplates.templates[0].id
      : null;

  let { data: collateral } = await supabase
    .from("collateral_items")
    .select("*")
    .eq("listing_id", listing.id)
    .eq("type", "lease_appraisal")
    .neq("status", "archived")
    .maybeSingle();

  let report: Report | null = null;

  if (reportId) {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .eq("listing_id", listing.id)
      .neq("status", "archived")
      .maybeSingle();
    if (!data || !data.template_id?.includes("lease-appraisal")) notFound();
    report = data as Report;
  }

  if (!report && collateral?.report_id) {
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
    if (collateralPhotoRequirementError(listing))
      redirect(`/listings/${listingId}`);
    const { data: createdReport, error: reportError } = await supabase
      .from("reports")
      .insert({
        agency_id: agency.id,
        listing_id: listing.id,
        status: "draft",
        template_id: soleTemplateId,
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

  if (
    soleTemplateId &&
    report.status !== "published" &&
    report.template_id !== soleTemplateId
  ) {
    const { data: updatedReport, error: updateError } = await supabase
      .from("reports")
      .update({ template_id: soleTemplateId })
      .eq("id", report.id)
      .select("*")
      .single();

    if (updateError || !updatedReport) {
      notFound();
    }
    report = updatedReport as Report;
  }

  if (
    soleTemplateId &&
    report.status !== "published" &&
    collateral.report_id === report.id &&
    collateral.template_id !== soleTemplateId
  ) {
    const { data: updatedCollateral, error: updateError } = await supabase
      .from("collateral_items")
      .update({ template_id: soleTemplateId })
      .eq("id", collateral.id)
      .select("*")
      .single();

    if (updateError || !updatedCollateral) {
      notFound();
    }
    collateral = updatedCollateral;
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
          {LEASE_APPRAISAL_LABEL}
        </h1>
        <p className="text-muted-foreground">
          {listing.property_address ?? "This property"}
        </p>
      </div>

      <LeaseAppraisalEditor
        listing={listing}
        report={report}
        collateral={collateral as CollateralItem}
        agency={agency}
        agencyAgents={agencyAgents}
        availableTemplates={{
          default_template_id: availableTemplates.defaultTemplateId,
          templates: availableTemplates.templates.map(serializeTemplateForApi),
        }}
        skipTemplateSelection={Boolean(soleTemplateId)}
      />
    </div>
  );
}
