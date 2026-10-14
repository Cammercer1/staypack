import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollateralItem, Listing } from "@/lib/types";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";

export const brochureTypeSchema = z.enum(["sales_brochure", "rental_brochure"]);
export type BrochureType = z.infer<typeof brochureTypeSchema>;
export const brochureLabels = { sales_brochure: "Sales brochure", rental_brochure: "Rental brochure" } as const;
export const brochureQuerySchema = z.object({ q: z.string().trim().max(160).default(""), type: z.enum(["all", "sales_brochure", "rental_brochure"]).default("all"), status: z.enum(["all", "draft", "generated", "published"]).default("all"), page: z.coerce.number().int().min(1).max(100000).default(1) });
export type BrochureQuery = z.infer<typeof brochureQuerySchema>;
export const createBrochureSchema = z.object({ listing_id: z.uuid(), type: brochureTypeSchema, restore_archived: z.boolean().default(false) }).strict();
export const BROCHURE_PAGE_SIZE = 20;
export type BrochureRow = Pick<CollateralItem, "id" | "status" | "updated_at" | "pdf_url" | "public_url"> & { type: BrochureType; listing: Pick<Listing, "id" | "property_address" | "hero_image_url" | "status"> };
export async function listBrochures(supabase: SupabaseClient, agencyId: string, filters: BrochureQuery) {
  let query = supabase.from("collateral_items")
    .select("id,type,status,updated_at,pdf_url,public_url,listing:listings!inner(id,property_address,hero_image_url,status)", { count: "exact" })
    .eq("agency_id", agencyId).eq("listing.agency_id", agencyId).in("type", ["sales_brochure", "rental_brochure"]).neq("status", "archived")
    .order("updated_at", { ascending: false }).order("id");
  if (filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.q) query = query.ilike("listing.property_address", `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data, error, count } = await query.range((filters.page - 1) * BROCHURE_PAGE_SIZE, filters.page * BROCHURE_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as BrochureRow[], total: count ?? 0 };
}

/** Reopening an existing brochure must never replace its design, content or PDF. */
export async function openOrCreateMarketingAsset(supabase: SupabaseClient, listing: Listing, type: BrochureType | "social_posts", restoreArchived = false) {
  if (listing.status === "archived") throw new Error("Restore this property before creating marketing.");
  const existing = () => supabase.from("collateral_items").select("id,status").eq("agency_id", listing.agency_id).eq("listing_id", listing.id).eq("type", type).maybeSingle();
  const found = await existing();
  if (found.error) throw new Error(found.error.message);
  if (found.data) {
    if (found.data.status === "archived") {
      if (!restoreArchived) return { archived: true as const, id: found.data.id as string };
      const restored = await supabase.from("collateral_items").update({ status: "draft" }).eq("id", found.data.id).eq("agency_id", listing.agency_id).eq("status", "archived");
      if (restored.error) throw new Error(restored.error.message);
    }
    return { archived: false as const, id: found.data.id as string };
  }
  const photoError = collateralPhotoRequirementError(listing, type);
  if (photoError) throw new Error(photoError);
  const created = await supabase.from("collateral_items").insert({ listing_id: listing.id, agency_id: listing.agency_id, type, status: "draft" }).select("id").single();
  if (created.error?.code === "23505") {
    const concurrent = await existing();
    if (concurrent.error) throw new Error(concurrent.error.message);
    if (concurrent.data) return { archived: concurrent.data.status === "archived", id: concurrent.data.id as string };
  }
  if (created.error) throw new Error(created.error.message);
  return { archived: false as const, id: created.data.id as string };
}

export function openOrCreateBrochure(supabase: SupabaseClient, listing: Listing, type: BrochureType, restoreArchived = false) {
  return openOrCreateMarketingAsset(supabase, listing, type, restoreArchived);
}
