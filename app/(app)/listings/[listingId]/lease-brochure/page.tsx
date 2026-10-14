import { redirect } from "next/navigation";
import { requireListingAccess } from "@/lib/auth/requireUser";
export default async function LegacyBrochurePage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const { supabase, listing } = await requireListingAccess(listingId);
  const { data, error } = await supabase.from("collateral_items").select("id").eq("listing_id", listing.id).eq("agency_id", listing.agency_id).eq("type", "rental_brochure").neq("status", "archived").maybeSingle();
  if (error) throw new Error(error.message);
  redirect(data ? `/brochures/${data.id}` : `/brochures/new?listing_id=${listing.id}&type=rental_brochure`);
}
