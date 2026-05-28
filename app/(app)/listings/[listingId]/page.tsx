import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { ensureListingLandingProvisioned } from "@/lib/listings/provisionLandingPage";
import { ListingWorkspace } from "@/components/listings/ListingWorkspace";
import { Button } from "@/components/ui/button";
import type { CollateralItem, Lead, Listing, ListingStats, Report } from "@/lib/types";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const { supabase, agency } = await requireAgency();

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .maybeSingle();

  if (!listing) {
    notFound();
  }

  const provisionedListing = await ensureListingLandingProvisioned(
    listing as Listing,
    agency,
    supabase,
  );

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: reports },
    { data: collateral },
    { data: leads },
    { count: totalViews },
    { count: recentViews },
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("*")
      .eq("listing_id", listingId)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("collateral_items")
      .select("*")
      .eq("listing_id", listingId)
      .neq("status", "archived")
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select("*")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false }),
    supabase
      .from("listing_page_views")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listingId),
    supabase
      .from("listing_page_views")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .gte("created_at", thirtyDaysAgo),
  ]);

  const stats: ListingStats = {
    total_views: totalViews ?? 0,
    views_last_30d: recentViews ?? 0,
    total_leads: leads?.length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/listings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to listings
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="heading-gradient text-3xl font-semibold">
          {listing.property_address ?? "Listing"}
        </h1>
        <p className="text-muted-foreground">
          Manage collateral, leads, and listing details for this property.
        </p>
      </div>

      <ListingWorkspace
        agencySlug={agency.slug}
        listing={provisionedListing}
        collateral={(collateral ?? []) as CollateralItem[]}
        leads={(leads ?? []) as Lead[]}
        reports={(reports ?? []) as Report[]}
        stats={stats}
      />
    </div>
  );
}
