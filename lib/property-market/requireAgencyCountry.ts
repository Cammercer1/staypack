import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing } from "@/lib/types";
import { assertPropertyCountry } from "./agencyCountry";
export async function requireListingAgencyCountry(supabase: SupabaseClient, listing: Listing) {
  const { data, error } = await supabase.from("agencies").select("country_code").eq("id", listing.agency_id).single();
  if (error || !data) throw new Error("Unable to verify the agency country. Try again.");
  return assertPropertyCountry(data, listing);
}
