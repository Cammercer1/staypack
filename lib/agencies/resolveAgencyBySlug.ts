import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agency } from "@/lib/types";

export async function resolveAgencyBySlug(
  client: SupabaseClient,
  agencySlug: string,
): Promise<Agency | null> {
  const slug = agencySlug.trim();
  if (!slug) return null;

  const { data: bySlug, error: slugError } = await client
    .from("agencies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (slugError) {
    throw new Error(slugError.message);
  }

  if (bySlug) {
    return bySlug as Agency;
  }

  const { data: byAlias, error: aliasError } = await client
    .from("agencies")
    .select("*")
    .contains("slug_aliases", [slug])
    .limit(1)
    .maybeSingle();

  if (aliasError) {
    throw new Error(aliasError.message);
  }

  return (byAlias as Agency | null) ?? null;
}

export function agencySlugNeedsRedirect(
  agency: Pick<Agency, "slug">,
  requestedSlug: string,
) {
  return agency.slug !== requestedSlug;
}
