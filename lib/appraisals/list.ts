import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProposalError } from "@/lib/digital-proposals/errors";
import type { WorkspaceAppraisalKind, WorkspaceAppraisalRow } from "./workspaceTypes";

export async function listWorkspaceAppraisals(supabase: SupabaseClient, agencyId: string, filters: { q: string; status: string; listing_id?: string; page: number; kind?: WorkspaceAppraisalKind; pageSize?: number }) {
  const result = await supabase.rpc("list_appraisals", { p_agency_id: agencyId, p_search: filters.q, p_status: filters.status, p_listing_id: filters.listing_id ?? null, p_page: filters.page, p_page_size: filters.pageSize ?? 20, p_kind: filters.kind ?? null });
  if (result.error) throw new ProposalError("Unable to load appraisals.", 500);
  return result.data as { rows: WorkspaceAppraisalRow[]; total: number; counts: Record<string, number> };
}
