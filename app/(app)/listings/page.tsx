import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { ListingLibrary } from "@/components/listings/ListingLibrary";
import type { Listing, ListingLibraryRow } from "@/lib/types";

export default async function ListingsPage() {
  const { supabase, agency } = await requireAgency();

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  const listingRows = (listings ?? []) as Listing[];
  const listingIds = listingRows.map((listing) => listing.id);

  const leadCountByListingId = new Map<string, number>();

  if (listingIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("listing_id")
      .in("listing_id", listingIds);

    for (const lead of leads ?? []) {
      if (!lead.listing_id) continue;
      leadCountByListingId.set(
        lead.listing_id,
        (leadCountByListingId.get(lead.listing_id) ?? 0) + 1,
      );
    }
  }

  const libraryRows: ListingLibraryRow[] = listingRows.map((listing) => ({
    ...listing,
    total_leads: leadCountByListingId.get(listing.id) ?? 0,
  }));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Listings"
        highlight="Your"
        title="open house library."
        description="Browse listings and open each property to manage collateral, leads, and listing details."
        action={
          <Link href="/listings/new" prefetch={false}>
            <Button size="lg">
              <Plus className="h-4 w-4" />
              New listing
            </Button>
          </Link>
        }
      />
      <ListingLibrary listings={libraryRows} />
    </div>
  );
}
