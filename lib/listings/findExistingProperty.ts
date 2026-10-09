import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExistingProperty } from "./propertyLookupTypes";
import { sameProperty } from "./propertyIdentity";

export async function findExistingProperty(
  supabase: SupabaseClient,
  agencyId: string,
  address: Partial<ExistingProperty>,
): Promise<ExistingProperty | null> {
  if (!address.property_address?.trim()) return null;
  // Paginate so a duplicate is not missed in larger agency libraries. Only address fields leave the DB.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("listings")
      .select("id,property_address,suburb,state,postcode")
      .eq("agency_id", agencyId)
      .neq("status", "archived")
      .order("id")
      .range(offset, offset + 999);
    if (error)
      throw new Error(
        "Could not check your property library. Please try again.",
      );
    const rows = (data ?? []) as ExistingProperty[];
    const match = rows.find((row) => sameProperty(row, address));
    if (match) return match;
    if (rows.length < 1000) return null;
  }
}
