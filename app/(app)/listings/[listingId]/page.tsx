import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { ListingWorkspace } from "@/components/listings/ListingWorkspace";
import { Button } from "@/components/ui/button";
import type { CollateralItem, Listing, Report } from "@/lib/types";

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

  const [{ data: reports }, { data: collateral }] = await Promise.all([
    supabase.from("reports").select("*").eq("listing_id", listingId).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("collateral_items").select("*").eq("listing_id", listingId).neq("status", "archived").order("created_at", { ascending: true }),
  ]);

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
          Create reports and marketing material for this property.
        </p>
      </div>

      <ListingWorkspace
        agencySlug={agency.slug}
        listing={listing as Listing}
        collateral={(collateral ?? []) as CollateralItem[]}
        leads={[]}
        reports={(reports ?? []) as Report[]}
        stats={{ total_views: 0, views_last_30d: 0, total_leads: 0 }}
      />
    </div>
  );
}
