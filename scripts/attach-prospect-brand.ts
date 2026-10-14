/** Run only after signup: --brand <uuid> --agency <existing-agency-uuid> --owner <operator-uuid>. */
import { parseArgs } from "node:util";
import { z } from "zod";
import { createAdminClient } from "../lib/supabase/admin";
import { prospectAgency, prospectProfileSchema } from "../lib/prospects/profile";

async function main() {
  const { values } = parseArgs({ options: { brand: { type: "string" }, agency: { type: "string" }, owner: { type: "string" } } });
  const brandId = z.uuid().parse(values.brand), agencyId = z.uuid().parse(values.agency), ownerId = z.uuid().parse(values.owner);
  const admin = createAdminClient();
  const result = await admin.from("prospect_brands").select("profile_json").eq("id", brandId).eq("owner_user_id", ownerId).single();
  if (result.error) throw new Error("Prospect brand not found.");
  const profile = prospectProfileSchema.parse(result.data.profile_json);
  const agency = prospectAgency(profile, brandId);
  const attached = await admin.rpc("attach_prospect_brand", { p_brand_id: brandId, p_agency_id: agencyId, p_owner_id: ownerId,
    p_agency_brand: agency, p_presets: agency.str_management_presets, p_assignment: profile.assignment });
  if (attached.error) throw new Error(attached.error.message);
  console.log("Saved prospect branding attached to the existing customer account. Example snapshots are unchanged.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Unable to attach brand."); process.exitCode = 1; });
