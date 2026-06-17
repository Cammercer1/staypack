import { hasServiceRoleKey } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, Listing } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DevListingAccess = {
  supabase: SupabaseClient;
  agency: Agency;
  listing: Listing;
};

/** Dev-only: load any listing by id via service role (e.g. md-belle delivery listings). */
export async function loadDevListingAccess(
  listingId: string,
): Promise<DevListingAccess | null> {
  if (process.env.NODE_ENV !== "development" || !hasServiceRoleKey()) {
    return null;
  }

  const admin = createAdminClient();
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return null;
  }

  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .select("*")
    .eq("id", listing.agency_id)
    .maybeSingle();

  if (agencyError || !agency) {
    return null;
  }

  return {
    supabase: admin,
    agency: agency as Agency,
    listing: listing as Listing,
  };
}
