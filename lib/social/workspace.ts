import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agency, CollateralItem, Listing } from "@/lib/types";
import { openOrCreateMarketingAsset } from "@/lib/brochures/workspace";
import { generateCollateralDocument } from "@/lib/collateral/generateCollateralDocument";
import { resolveCollateralTemplateId } from "@/lib/collateral/templates/resolveTemplateId";

export const createSocialSchema = z.object({ listing_id: z.uuid(), restore_archived: z.boolean().default(false) }).strict();
export const socialQuerySchema = z.object({ q: z.string().trim().max(160).default(""), page: z.coerce.number().int().min(1).max(100000).default(1) });
export const SOCIAL_PAGE_SIZE = 18;
export type SocialRow = Pick<CollateralItem, "id" | "status" | "updated_at"> & {
  exports: { square?: { png_url?: string }; wide?: { png_url?: string }; story?: { png_url?: string } } | null;
  listing: Pick<Listing, "id" | "property_address" | "hero_image_url">;
};
export async function listSocialPosts(supabase: SupabaseClient, agencyId: string, filters: z.infer<typeof socialQuerySchema>) {
  let query = supabase.from("collateral_items")
    .select("id,status,updated_at,exports:document_json->exports,listing:listings!inner(id,property_address,hero_image_url)", { count: "exact" })
    .eq("agency_id", agencyId).eq("listing.agency_id", agencyId).eq("type", "social_posts").neq("status", "archived")
    .order("updated_at", { ascending: false }).order("id");
  if (filters.q) query = query.ilike("listing.property_address", `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`);
  const result = await query.range((filters.page - 1) * SOCIAL_PAGE_SIZE, filters.page * SOCIAL_PAGE_SIZE - 1);
  if (result.error) throw new Error(result.error.message);
  return { rows: (result.data ?? []) as unknown as SocialRow[], total: result.count ?? 0 };
}

/** Only an explicit POST prepares a missing design. Reopening never regenerates saved work. */
export async function openOrCreateSocialPosts(supabase: SupabaseClient, agency: Agency, listing: Listing, restoreArchived = false) {
  const result = await openOrCreateMarketingAsset(supabase, listing, "social_posts", restoreArchived);
  if (result.archived) return result;
  const current = await supabase.from("collateral_items").select("*").eq("id", result.id).eq("agency_id", agency.id).eq("type", "social_posts").neq("status", "archived").single();
  if (current.error) throw new Error(current.error.message);
  const item = current.data as CollateralItem;
  if (item.document_json) return result;
  const photoError = collateralPhotoRequirementError(listing, "social_posts");
  if (photoError) throw new Error(photoError);
  const agents = await supabase.from("agent_profiles").select("*").eq("agency_id", agency.id);
  if (agents.error) throw new Error(agents.error.message);
  const profiles = agents.data ?? [];
  const document = await generateCollateralDocument({ supabase, agency, listing, collateral: item, agencyAgents: profiles, agentProfile: profiles.find(agent => agent.id === listing.agent_profile_id) ?? profiles.find(agent => agent.is_default && !agent.archived_at) ?? null });
  const saved = await supabase.from("collateral_items").update({ document_json: document, template_id: resolveCollateralTemplateId(agency, item), status: "generated", generated_at: new Date().toISOString() })
    .eq("id", item.id).eq("agency_id", agency.id).eq("type", "social_posts").neq("status", "archived").is("document_json", null).select("id").maybeSingle();
  if (saved.error) throw new Error(saved.error.message);
  // Another request may already have prepared it; the conditional write preserves that design.
  if (!saved.data) {
    const concurrent = await supabase.from("collateral_items").select("document_json").eq("id", item.id).eq("agency_id", agency.id).neq("status", "archived").single();
    if (concurrent.error || !concurrent.data?.document_json) throw new Error("This social design changed. Refresh and try again.");
  }
  return result;
}
