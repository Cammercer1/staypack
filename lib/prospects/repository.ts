import { createAdminClient } from "@/lib/supabase/admin";
import { prospectProfileSchema, type ProspectProfile } from "./profile";

/** Trusted server/CLI entry point. Operator ownership is checked even with the admin client. */
export async function saveProspectBrand(ownerId: string, input: ProspectProfile) {
  const profile = prospectProfileSchema.parse(input);
  const admin = createAdminClient();
  const operator = await admin.from("prospect_operators").select("user_id").eq("user_id", ownerId).maybeSingle();
  if (operator.error || !operator.data) throw new Error("Internal prospect access is required.");
  const existing = await admin.from("prospect_brands").select("id,converted_agency_id")
    .eq("owner_user_id", ownerId).eq("slug", profile.slug).maybeSingle();
  if (existing.error) throw new Error("Unable to load prospect brand.");
  if (existing.data?.converted_agency_id) throw new Error("This brand is already attached to a customer account.");
  const result = await admin.from("prospect_brands").upsert({
    owner_user_id: ownerId, slug: profile.slug, name: profile.name,
    profile_json: profile, updated_at: new Date().toISOString(),
  }, { onConflict: "owner_user_id,slug" }).select("id").single();
  if (result.error) throw new Error("Unable to save prospect brand.");
  return result.data.id as string;
}
