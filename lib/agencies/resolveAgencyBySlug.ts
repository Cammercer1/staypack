import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agency } from "@/lib/types";

export async function resolveAgencyBySlug(
  client: SupabaseClient,
  agencySlug: string,
): Promise<Agency | null> {
  const { data, error } = await client
    .from("agencies")
    .select("*")
    .or(`slug.eq.${agencySlug},slug_aliases.cs.{${agencySlug}}`)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Agency | null;
}

export function agencySlugNeedsRedirect(
  agency: Pick<Agency, "slug">,
  requestedSlug: string,
) {
  return agency.slug !== requestedSlug;
}
