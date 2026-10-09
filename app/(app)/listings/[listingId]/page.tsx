import { notFound } from "next/navigation";
import { requireAgency } from "@/lib/auth/requireUser";
import { ListingWorkspace } from "@/components/listings/ListingWorkspace";
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
