import { requireAgency } from "@/lib/auth/requireUser";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import type { Listing } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, agency } = await requireAgency();
  const recent = await supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <DashboardOverview
      agencyName={agency.name}
      listings={(recent.data ?? []) as Listing[]}
      listingCount={recent.error ? null : recent.count}
      loadError={Boolean(recent.error)}
    />
  );
}
