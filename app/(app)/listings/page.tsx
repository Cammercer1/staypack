import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { ListingLibrary } from "@/components/listings/ListingLibrary";
import type { Listing, ListingWithReport, Report } from "@/lib/types";

export default async function ListingsPage() {
  const { supabase, agency } = await requireAgency();

  const { data: listings } = await supabase
    .from("listings")
    .select("*, reports(*)")
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  const listingRows = (listings ?? []).map((row) => {
    const reports = (row.reports ?? []) as Report[];
    const { reports: _reports, ...listing } = row;
    return {
      ...(listing as Listing),
      str_report:
        reports.find((report) => report.status !== "archived") ?? reports[0] ?? null,
    } satisfies ListingWithReport;
  });

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Listings"
        highlight="Your"
        title="open house library."
        description="Browse listings and open each property to manage STR reports, links, and PDFs."
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
