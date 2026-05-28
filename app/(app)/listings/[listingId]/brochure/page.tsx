import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SalesBrochureEditor } from "@/components/collateral/sales-brochure/SalesBrochureEditor";
import { Button } from "@/components/ui/button";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { COLLATERAL_TYPE_META } from "@/lib/listings/collateralTypes";
import type { CollateralItem } from "@/lib/types";

export default async function ListingSalesBrochurePage({
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

  let { data: collateral } = await supabase
    .from("collateral_items")
    .select("*")
    .eq("listing_id", listing.id)
    .eq("type", "sales_brochure")
    .neq("status", "archived")
    .maybeSingle();

  if (!collateral) {
    const { data: created, error } = await supabase
      .from("collateral_items")
      .insert({
        listing_id: listing.id,
        agency_id: agency.id,
        type: "sales_brochure",
        status: "draft",
      })
      .select("*")
      .single();

    if (error || !created) {
      notFound();
    }

    collateral = created;
  }

  const meta = COLLATERAL_TYPE_META.sales_brochure;

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
          Choose a template, generate brochure copy, and publish for{" "}
          {listing.property_address ?? "this listing"}.
        </p>
      </div>

      <SalesBrochureEditor
        listing={listing}
        agency={agency}
        collateral={collateral as CollateralItem}
      />
    </div>
  );
}
