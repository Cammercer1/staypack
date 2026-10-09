import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { ListingLibrary } from "@/components/listings/ListingLibrary";
import type { Listing } from "@/lib/types";

export default async function ListingsPage() {
  const { supabase, agency } = await requireAgency();

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  const listingRows = (listings ?? []) as Listing[];
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Listings"
        highlight="Your"
        title="open house library."
        description="Browse properties and open each one to create reports and marketing material."
        action={
          <Link href="/listings/new" prefetch={false}>
            <Button size="lg">
              <Plus className="h-4 w-4" />
              New listing
            </Button>
          </Link>
        }
      />
      <ListingLibrary listings={listingRows} />
    </div>
  );
}
