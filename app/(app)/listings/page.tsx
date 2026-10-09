import { CircleAlert } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { WorkspaceHeader } from "@/components/app-shell/WorkspaceHeader";
import { ListingLibrary } from "@/components/listings/ListingLibrary";
import type { Listing } from "@/lib/types";

export default async function ListingsPage() {
  const { supabase, agency } = await requireAgency();
  const { data: listings, error } = await supabase
    .from("listings")
    .select("*")
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div
      data-theme="staypack-workspace"
      className="space-y-8 text-base-content"
    >
      <WorkspaceHeader
        eyebrow="Listings"
        title="Your property library."
        description="Find a property, pick up an appraisal or prepare its next piece of marketing."
      />
      {error ? (
        <div role="alert" className="du-alert du-alert-warning du-alert-soft">
          <CircleAlert className="size-5" aria-hidden="true" />
          <span>
            Your listings could not be loaded. Please refresh to try again.
          </span>
        </div>
      ) : (
        <ListingLibrary listings={(listings ?? []) as Listing[]} />
      )}
    </div>
  );
}
