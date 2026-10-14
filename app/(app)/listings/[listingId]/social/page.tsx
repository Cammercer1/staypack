import { redirect } from "next/navigation";
import { requireListingAccess } from "@/lib/auth/requireUser";
export default async function ListingSocialPostsPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const { supabase, agency, listing } = await requireListingAccess(listingId);
  const result = await supabase.from("collateral_items").select("id").eq("agency_id", agency.id).eq("listing_id", listing.id).eq("type", "social_posts").neq("status", "archived").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  redirect(result.data ? `/social/${result.data.id}` : `/social/new?listing_id=${listing.id}`);
}
