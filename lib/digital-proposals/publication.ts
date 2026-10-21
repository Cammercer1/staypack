import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const publicationLinkSchema = z.object({
  is_primary: z.boolean(),
  revoked_at: z.string().nullable(),
  version: z.object({ revoked_at: z.string().nullable() }).nullable(),
});

/** Publication lives on the share link, independently of the report's legacy JSON or newer draft edits. */
export async function hasPublishedProposal(
  supabase: SupabaseClient,
  agencyId: string,
  reportId: string,
): Promise<boolean> {
  const { data, error } = await supabase.from("digital_proposal_links")
    .select("is_primary,revoked_at,version:digital_proposal_versions!digital_proposal_links_agency_id_report_id_version_id_fkey(revoked_at)")
    .eq("agency_id", agencyId)
    .eq("report_id", reportId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  const links = z.array(publicationLinkSchema).parse(data ?? []);
  const primaryLinks = links.filter(link => link.is_primary);
  // A revoked primary must not make an older legacy URL the current publication again.
  const candidates = primaryLinks.length ? primaryLinks : links;
  return candidates.some(link => link.revoked_at === null && link.version?.revoked_at === null);
}
