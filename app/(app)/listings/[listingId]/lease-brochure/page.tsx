import Link from "next/link";
import { loadAgencyAgentProfiles } from "@/lib/reports/loadReportAgent";
import { resolveAvailableTemplates } from "@/lib/templates/resolveAvailableTemplates";
import { serializeTemplateForApi } from "@/lib/templates/serializeForApi";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LeaseBrochureEditor } from "@/components/collateral/sales-brochure/LeaseBrochureEditor";
import { Button } from "@/components/ui/button";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { COLLATERAL_TYPE_META } from "@/lib/listings/collateralTypes";
import type { CollateralItem } from "@/lib/types";

export default async function ListingLeaseBrochurePage({
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



  let { data: collateral } = await supabase
    .from("collateral_items")
    .select("*")
    .eq("listing_id", listing.id)
    .eq("type", "rental_brochure")
    .neq("status", "archived")
    .maybeSingle();

  if (!collateral) {
    if (collateralPhotoRequirementError(listing)) redirect(`/listings/${listingId}`);
    const { data: created, error } = await supabase
      .from("collateral_items")
      .insert({
        listing_id: listing.id,
        agency_id: agency.id,
        type: "rental_brochure",
        status: "draft",
      })
      .select("*")
      .single();

    if (error || !created) {
      notFound();
    }

    collateral = created;
  }

  const [availableTemplates, agencyAgents] = await Promise.all([
    resolveAvailableTemplates(agency, "rental_brochure"),
    loadAgencyAgentProfiles(supabase, agency.id),
  ]);
  const meta = COLLATERAL_TYPE_META.rental_brochure;

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
        <h1 className="heading-gradient text-3xl font-semibold">{meta.label}</h1>
        <p className="text-muted-foreground">
          {listing.property_address ?? "This property"}
        </p>
      </div>

      <LeaseBrochureEditor
        listing={listing}
        agency={agency}
        collateral={collateral as CollateralItem}
        agencyAgents={agencyAgents}
        availableTemplates={{ default_template_id: availableTemplates.defaultTemplateId, templates: availableTemplates.templates.map(serializeTemplateForApi) }}
      />
    </div>
  );
}
